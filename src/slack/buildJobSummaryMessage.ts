/* eslint-disable @typescript-eslint/no-explicit-any */
import {computeDuration} from '../utils/computeDuration'

export function buildJobSummary({
  completedJobs,
  includeJobsTime
}: {
  completedJobs: {
    conclusion: string
    name: string
    html_url: string
    started_at: string
    completed_at: string
  }[]
  includeJobsTime: boolean
}): {
  workflowColor: string
  jobFields: {title: string; short: boolean; value: string}[]
} {
  let workflowColor = 'good'

  if (completedJobs.some(job => job.conclusion === 'cancelled')) {
    workflowColor = 'warning'
  } else if (
    completedJobs.some(
      job => !['success', 'skipped', 'cancelled'].includes(job.conclusion)
    )
  ) {
    workflowColor = '#FF0000'
  }

  const jobFields = completedJobs.map(job => {
    let jobStatusIcon: string

    switch (job.conclusion) {
      case 'success':
        jobStatusIcon = '✓'
        break
      case 'cancelled':
      case 'skipped':
        jobStatusIcon = '⃠'
        break
      default:
        jobStatusIcon = '✗'
    }

    const jobDuration = includeJobsTime
      ? ` (${computeDuration({
          start: new Date(job.started_at),
          end: new Date(job.completed_at)
        })})`
      : ''

    return {
      title: '', // Slack requires this field but it can be empty
      short: true,
      value: `${jobStatusIcon} <${job.html_url}|${job.name}>${jobDuration}`
    }
  })

  return {workflowColor, jobFields}
}

export function buildJobSummaryMessage({
  workflowRun,
  completedJobs,
  includeJobsTime,
  actor,
  branchUrl,
  workflowRunUrl,
  repoUrl,
  commitMessage,
  pullRequests
}: {
  workflowRun: {name: string; created_at: string; updated_at: string}
  completedJobs: any[]
  includeJobsTime: boolean
  actor: string
  branchUrl: string
  workflowRunUrl: string
  repoUrl: string
  commitMessage?: string
  pullRequests?: {number: number; head: {ref: string}; base: {ref: string}}[]
}): {
  text: string
  attachments: any[]
} {
  const {workflowColor, jobFields} = buildJobSummary({
    completedJobs,
    includeJobsTime
  })

  const workflowDuration = computeDuration({
    start: new Date(workflowRun.created_at),
    end: new Date(workflowRun.updated_at)
  })

  let statusString = `${actor}'s \`${workflowRun.name}\` on \`${branchUrl}\``

  // Add pull request details if available
  if (pullRequests?.length) {
    const prDetails = pullRequests
      .map(
        pr =>
          `<${repoUrl}/pull/${pr.number}|#${pr.number}> from \`${pr.head.ref}\` to \`${pr.base.ref}\``
      )
      .join(', ')
    statusString = `${actor}'s \`pull_request\` ${prDetails}`
  }

  const detailsString = `${workflowRunUrl} completed in \`${workflowDuration}\``

  return {
    text: `${statusString}\n${detailsString}`,
    attachments: [
      {
        color: workflowColor,
        footer: commitMessage
          ? `${repoUrl} | commit: ${commitMessage}`
          : repoUrl,
        fields: jobFields
      }
    ]
  }
}

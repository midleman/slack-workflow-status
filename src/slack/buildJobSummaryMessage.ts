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
  workflowMsg: string
  jobFields: {title: string; short: boolean; value: string}[]
} {
  let workflowColor = 'good'
  let workflowMsg = ':tada: Workflow completed successfully!'

  if (completedJobs.some(job => job.conclusion === 'cancelled')) {
    workflowColor = 'warning'
    workflowMsg = '⚠️ Workflow partially cancelled!'
  } else if (
    completedJobs.some(
      job => !['success', 'skipped', 'cancelled'].includes(job.conclusion)
    )
  ) {
    workflowColor = '#FF0000'
    workflowMsg = ':sad_mac: Workflow encountered failures!'
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

  return {workflowColor, workflowMsg, jobFields}
}

export function buildJobSummaryMessage({
  workflowRun,
  completedJobs,
  includeJobsTime
}: {
  workflowRun: any
  completedJobs: any[]
  includeJobsTime: boolean
}): {
  text: string
  attachments: any[]
} {
  const {workflowColor, workflowMsg, jobFields} = buildJobSummary({
    completedJobs,
    includeJobsTime
  })

  return {
    text: `${workflowMsg}${workflowRun.name}`,
    attachments: [
      {
        color: workflowColor,
        text: `Workflow completed in ${computeDuration({
          start: new Date(workflowRun.created_at),
          end: new Date(workflowRun.updated_at)
        })}`,
        fields: jobFields
      }
    ]
  }
}

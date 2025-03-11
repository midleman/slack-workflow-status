/* eslint-disable @typescript-eslint/no-explicit-any */
import { computeDuration } from '../utils/computeDuration'
import { MessageAttachment } from '@slack/types'

export function buildJobSummary({
  completedJobs,
  includeJobs,
  includeJobsTime
}: {
  completedJobs: {
    conclusion: string
    name: string
    html_url: string
    started_at: string
    completed_at: string
  }[]
  includeJobs: 'true' | 'false' | 'on-failure'
  includeJobsTime: boolean
}): {
  workflowColor: string
  jobFields: SlackMessageAttachmentFields
} {
  let workflowColor: string
  let jobFields: SlackMessageAttachmentFields = []

  // eslint-disable-next-line no-console
  console.log('includeJobs', includeJobs)
  // If all jobs are successful, the workflow is successful
  if (
    completedJobs.every((job) =>
      ['success', 'skipped'].includes(job.conclusion)
    )
  ) {
    workflowColor = 'good'
    if (includeJobs === 'on-failure') {
      jobFields = [] // Don't report jobs if only reporting on failure
    }
  }
  // If any job is cancelled, the workflow is cancelled
  else if (completedJobs.some((job) => job.conclusion === 'cancelled')) {
    workflowColor = 'warning'
    if (includeJobs === 'on-failure') {
      jobFields = []
    }
  }
  // Otherwise, the workflow is failed
  else {
    workflowColor = '#FF0000' // Red
  }

  // If 'false', don't report jobs at all
  if (includeJobs === 'false') {
    jobFields = []
  }

  // eslint-disable-next-line no-console
  console.log('jobFields', jobFields)
  // Ensure jobFields is only populated when it should be
  if (includeJobs !== 'false' && jobFields.length === 0) {
    jobFields = completedJobs.map((job) => {
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
  }

  return { workflowColor, jobFields }
}

/**
 * Build a Slack message for a completed job
 * @param param
 * @returns
 */
export function buildJobSummaryMessage({
  workflowRun,
  completedJobs,
  includeJobs,
  includeJobsTime,
  actor,
  branchUrl,
  workflowRunUrl,
  repoUrl,
  commitMessage
}: {
  workflowRun: {
    name: string
    created_at: string
    updated_at: string
    pull_requests: []
    repository: { html_url: string; url: string }
  }
  completedJobs: any[]
  includeJobs: 'true' | 'false' | 'on-failure'
  includeJobsTime: boolean
  actor: string
  branchUrl: string
  workflowRunUrl: string
  repoUrl: string
  commitMessage?: string
}): {
  text: string
  attachments: any[]
} {
  const { workflowColor, jobFields } = buildJobSummary({
    completedJobs,
    includeJobs,
    includeJobsTime
  })

  const workflowDuration = computeDuration({
    start: new Date(workflowRun.created_at),
    end: new Date(workflowRun.updated_at)
  })

  let statusString = `${actor}'s \`${workflowRun.name}\` on \`${branchUrl}\``
  const detailsString = `${workflowRun.name} ${workflowRunUrl} completed in \`${workflowDuration}\``

  // Build Pull Request string if required
  const pull_requests = (workflowRun.pull_requests as PullRequest[])
    .filter(
      (pull_request) =>
        pull_request.base.repo.url === workflowRun.repository.url // exclude PRs from external repositories
    )
    .map(
      (pull_request) =>
        `<${workflowRun.repository.html_url}/pull/${pull_request.number}|#${pull_request.number}> from \`${pull_request.head.ref}\` to \`${pull_request.base.ref}\``
    )
    .join(', ')

  if (pull_requests !== '') {
    statusString = `${actor}'s \`pull_request\` ${pull_requests}`
  }

  return {
    text: statusString,
    attachments: [
      {
        text: detailsString,
        color: workflowColor,
        footer: commitMessage
          ? `*${repoUrl}* | commit: ${commitMessage}`
          : repoUrl,
        fields: jobFields
      }
    ]
  }
}

// HACK: https://github.com/octokit/types.ts/issues/205
interface PullRequest {
  url: string
  id: number
  number: number
  head: {
    ref: string
    sha: string
    repo: {
      id: number
      url: string
      name: string
    }
  }
  base: {
    ref: string
    sha: string
    repo: {
      id: number
      url: string
      name: string
    }
  }
}

type SlackMessageAttachmentFields = MessageAttachment['fields']

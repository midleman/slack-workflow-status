import * as core from '@actions/core'

export interface ActionInputs {
  githubToken: string
  jobsToFetch: number
  includeJobs: 'true' | 'false' | 'on-failure'
  includeCommitMessage: boolean
  includeJobsTime: boolean
  slackToken: string
  slackChannel: string
  notifyOn: string
  commentJunitFailures: boolean
  commentJunitFlakes: boolean
  commentJunitFailuresEmoji: string
  commentJunitFlakesEmoji: string
}

export function getActionInputs(): ActionInputs {
  return {
    githubToken: core.getInput('repo_token', {required: true}),
    jobsToFetch: parseInt(core.getInput('jobs_to_fetch', {required: true}), 30),
    includeJobs: core.getInput('include_jobs', {required: true}) as
      | 'true'
      | 'false'
      | 'on-failure',
    includeCommitMessage:
      core.getInput('include_commit_message', {required: true}) === 'true',
    includeJobsTime:
      core.getInput('include_jobs_time', {required: false})?.toLowerCase() !==
      'false',
    slackToken: core.getInput('slack_token', {required: true}),
    slackChannel: core.getInput('channel', {required: true}),
    notifyOn: core.getInput('notify_on', {required: false}) || 'always',
    commentJunitFailures:
      core.getInput('comment_junit_failures', {required: false}) === 'true',
    commentJunitFlakes:
      core.getInput('comment_junit_flakes', {required: false}) === 'true',
    commentJunitFailuresEmoji: core.getInput('comment_junit_failures_emoji', {
      required: true
    }),
    commentJunitFlakesEmoji: core.getInput('comment_junit_flakes_emoji', {
      required: true
    })
  }
}

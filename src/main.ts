/* eslint-disable no-console */
/******************************************************************************\
 * Main entrypoint for GitHib Action. Fetches information regarding the       *
 * currently running Workflow and it's Jobs. Sends individual job status and  *
 * workflow status as a formatted notification to the Slack Webhhok URL set   *
 * in the environment variables.                                              *
 *                                                                            *
 * Org: Gamesight <https://gamesight.io>                                      *
 * Author: Anthony Kinson <anthony@gamesight.io>                              *
 * Repository: https://github.com/Gamesight/slack-workflow-status             *
 * License: MIT                                                               *
 * Copyright (c) 2020 Gamesight, Inc                                          *
\******************************************************************************/

import * as core from '@actions/core'
import {context, getOctokit} from '@actions/github'
import {MessageAttachment} from '@slack/types'
import {WebClient} from '@slack/web-api'
import fs from 'fs'
import path from 'path'
import * as xml2js from 'xml2js'
import extract from 'extract-zip'

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

type IncludeJobs = 'true' | 'false' | 'on-failure'
type SlackMessageAttachementFields = MessageAttachment['fields']

process.on('unhandledRejection', handleError)
main().catch(handleError) // eslint-disable-line github/no-then

// Action entrypoint
async function main(): Promise<void> {
  // Collect Action Inputs
  const github_token = core.getInput('repo_token', {required: true})
  const jobs_to_fetch = core.getInput('jobs_to_fetch', {required: true})
  const include_jobs = core.getInput('include_jobs', {
    required: true
  }) as IncludeJobs
  const include_commit_message =
    core.getInput('include_commit_message', {
      required: true
    }) === 'true'
  const include_jobs_time =
    core.getInput('include_jobs_time', {required: false})?.toLowerCase() !==
    'false'

  const slack_token = core.getInput('slack_token', {required: true})
  const slack_channel = core.getInput('channel')
  const slack_name = core.getInput('name')
  const slack_icon = core.getInput('icon_url')
  const slack_emoji = core.getInput('icon_emoji') // https://www.webfx.com/tools/emoji-cheat-sheet/
  const notify_on = core.getInput('notify_on', {required: false}) || 'always'
  // Force as secret, forces *** when trying to print or log values
  core.setSecret(github_token)
  core.setSecret(slack_token)
  // core.setSecret(webhook_url)
  // Auth github with octokit module
  const octokit = getOctokit(github_token)

  // Fetch workflow run data
  const {data: workflow_run} = await octokit.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  // Fetch workflow job information
  const {data: jobs_response} = await octokit.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
    per_page: parseInt(jobs_to_fetch, 30)
  })

  const completed_jobs = jobs_response.jobs.filter(
    job => job.status === 'completed'
  )

  // Check if there are any job failures
  const hasFailures = completed_jobs.some(
    job => !['success', 'skipped'].includes(job.conclusion)
  )

  // Decide whether to send a notification
  const shouldNotify =
    notify_on === 'always' || (notify_on.includes('fail') && hasFailures)

  if (!shouldNotify) {
    core.info(
      'No notification sent: All jobs passed and "notify_on" is set to "fail-only".'
    )
    return // Exit without sending a notification
  }

  // Configure slack attachment styling
  let workflow_color // can be good, danger, warning or a HEX colour (#00FF00)
  let workflow_msg

  let job_fields: SlackMessageAttachementFields

  if (
    completed_jobs.every(job => ['success', 'skipped'].includes(job.conclusion))
  ) {
    workflow_color = 'good'
    workflow_msg = ':tada: '
    if (include_jobs === 'on-failure') {
      job_fields = []
    }
  } else if (completed_jobs.some(job => job.conclusion === 'cancelled')) {
    workflow_color = 'warning'
    workflow_msg = '⚠️ CANCELLED: '
    if (include_jobs === 'on-failure') {
      job_fields = []
    }
  } else {
    // (jobs_response.jobs.some(job => job.conclusion === 'failed')
    workflow_color = '#FF0000'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    workflow_msg = ':sad_mac: '
  }

  if (include_jobs === 'false') {
    job_fields = []
  }

  // Build Job Data Fields
  job_fields ??= completed_jobs.map(job => {
    let job_status_icon

    switch (job.conclusion) {
      case 'success':
        job_status_icon = '✓'
        break
      case 'cancelled':
      case 'skipped':
        job_status_icon = '⃠'
        break
      default:
        // case 'failure'
        job_status_icon = '✗'
    }

    const job_duration = compute_duration({
      start: new Date(job.started_at),
      end: new Date(job.completed_at)
    })

    return {
      title: '', // FIXME: it's required in slack type, we should workaround that somehow
      short: true,
      value: include_jobs_time
        ? `${job_status_icon} <${job.html_url}|${job.name}> (${job_duration})`
        : `${job_status_icon} <${job.html_url}|${job.name}>`
    }
  })

  // Payload Formatting Shortcuts
  const workflow_duration = compute_duration({
    start: new Date(workflow_run.created_at),
    end: new Date(workflow_run.updated_at)
  })
  const repo_url = `<${workflow_run.repository.html_url}|*${workflow_run.repository.full_name}*>`
  const branch_url = `<${workflow_run.repository.html_url}/tree/${workflow_run.head_branch}|*${workflow_run.head_branch}*>`
  const workflow_run_url = `<${workflow_run.html_url}|#${workflow_run.run_number}>`
  // Example: Success: AnthonyKinson's `push` on `master` for pull_request
  let status_string = `${context.actor}'s \`${context.eventName}\` on \`${branch_url}\``
  // Example: Workflow: My Workflow #14 completed in `1m 30s`
  const details_string = `${context.workflow} ${workflow_run_url} completed in \`${workflow_duration}\``

  // Build Pull Request string if required
  const pull_requests = (workflow_run.pull_requests as PullRequest[])
    .filter(
      pull_request => pull_request.base.repo.url === workflow_run.repository.url // exclude PRs from external repositories
    )
    .map(
      pull_request =>
        `<${workflow_run.repository.html_url}/pull/${pull_request.number}|#${pull_request.number}> from \`${pull_request.head.ref}\` to \`${pull_request.base.ref}\``
    )
    .join(', ')

  if (pull_requests !== '') {
    status_string = `${context.actor}'s \`pull_request\` ${pull_requests}`
  }

  const commit_message = `commit: ${
    workflow_run.head_commit.message.split('\n')[0]
  }`

  // We're using old style attachments rather than the new blocks because:
  // - Blocks don't allow colour indicators on messages
  // - Block are limited to 10 fields. >10 jobs in a workflow results in payload failure

  // Build our notification attachment
  const slack_attachment = {
    mrkdwn_in: ['text' as const],
    color: workflow_color,
    // pretext: status_string,
    text: [details_string]
      // .concat(include_commit_message ? [commit_message] : [])
      .join('\n'),
    footer: include_commit_message
      ? `${repo_url} | ${commit_message}`
      : repo_url,
    // footer_icon: 'https://github.githubassets.com/favicon.ico',
    fields: job_fields
  }
  // Build our notification payload
  const slack_payload_body = {
    attachments: [slack_attachment],
    ...(slack_name && {username: slack_name}),
    ...(slack_channel && {channel: slack_channel}),
    ...(slack_emoji && {icon_emoji: slack_emoji}),
    ...(slack_icon && {icon_url: slack_icon})
  }

  // Format and send Slack thread message
  const {failedTests, flakyTests} = await fetchWorkflowArtifacts(github_token)
  console.log('failed tests--->', failedTests)
  console.log('flaky tests--->', flakyTests)

  const formattedFailures = Object.entries(failedTests)
    .map(
      ([artifactName, tests]) =>
        `*${artifactName} - Failed Tests*\n${tests
          .map(test => `:x: ${test}`)
          .join('\n')}`
    )
    .join('\n\n')
  console.log('formattedFailures', formattedFailures)

  const formattedFlaky = Object.entries(flakyTests)
    .map(
      ([artifactName, tests]) =>
        `*${artifactName} - Flaky Tests*\n${tests
          .map(test => `:warning: ${test}`)
          .join('\n')}`
    )
    .join('\n\n')
  console.log('formattedFlaky', formattedFlaky)

  const formattedSlackMessage = [formattedFailures, formattedFlaky]
    .filter(section => section)
    .join('\n\n')

  const slackClient = new WebClient(slack_token)

  try {
    // Create the initial Slack message
    const initialMessage = await slackClient.chat.postMessage({
      channel: slack_channel,
      text: status_string,
      attachments: slack_payload_body.attachments
    })
    const threadTs = initialMessage.ts // Capture thread timestamp

    if (formattedSlackMessage) {
      await slackClient.chat.postMessage({
        channel: slack_channel,
        text: formattedSlackMessage,
        thread_ts: threadTs
      })
    }
    // const response = await slack_webhook.send(slack_payload_body)
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message)
    }
  }
}

// Converts start and end dates into a duration string
function compute_duration({start, end}: {start: Date; end: Date}): string {
  // FIXME: https://github.com/microsoft/TypeScript/issues/2361
  const duration = end.valueOf() - start.valueOf()
  let delta = duration / 1000
  const days = Math.floor(delta / 86400)
  delta -= days * 86400
  const hours = Math.floor(delta / 3600) % 24
  delta -= hours * 3600
  const minutes = Math.floor(delta / 60) % 60
  delta -= minutes * 60
  const seconds = Math.floor(delta % 60)
  // Format duration sections
  const format_duration = (
    value: number,
    text: string,
    hide_on_zero: boolean
  ): string => (value <= 0 && hide_on_zero ? '' : `${value}${text} `)

  return (
    format_duration(days, 'd', true) +
    format_duration(hours, 'h', true) +
    format_duration(minutes, 'm', true) +
    format_duration(seconds, 's', false).trim()
  )
}

function handleError(err: Error): void {
  core.error(err)
  if (err && err.message) {
    core.setFailed(err.message)
  } else {
    core.setFailed(`Unhandled Error: ${err}`)
  }
}

// Fetch Workflow Artifacts and Parse Results
async function fetchWorkflowArtifacts(
  github_token: string
): Promise<{
  failedTests: Record<string, string[]>
  flakyTests: Record<string, string[]>
}> {
  const octokit = getOctokit(github_token)

  const {data: artifacts} = await octokit.actions.listWorkflowRunArtifacts({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  const junitArtifacts = artifacts.artifacts.filter(artifact =>
    artifact.name.includes('e2e')
  )

  const failedTests: Record<string, string[]> = {}
  const flakyTests: Record<string, string[]> = {}

  for (const artifact of junitArtifacts) {
    const artifactZipPath = path.resolve('logs', `${artifact.name}.zip`)

    // Ensure the logs directory exists
    fs.mkdirSync('logs', {recursive: true})

    try {
      // Download the artifact
      const response = await octokit.actions.downloadArtifact({
        owner: context.repo.owner,
        repo: context.repo.repo,
        artifact_id: artifact.id,
        archive_format: 'zip'
      })

      // Convert the response data to a buffer and write it to a zip file
      const buffer = Buffer.from(response.data as ArrayBuffer)
      fs.writeFileSync(artifactZipPath, buffer)

      console.log(`Artifact ${artifact.name} saved to ${artifactZipPath}`)

      // Parse the JUnit reports
      const {
        failedTests: artifactFailed,
        flakyTests: artifactFlaky
      } = await parseJUnitReports(artifactZipPath)

      if (artifactFailed.length > 0) {
        failedTests[artifact.name] = artifactFailed
      }

      if (artifactFlaky.length > 0) {
        flakyTests[artifact.name] = artifactFlaky
      }
    } catch (error) {
      console.error(
        `Failed to download or process artifact '${artifact.name}':`,
        error
      )
    }
  }

  return {failedTests, flakyTests}
}

async function parseJUnitReports(
  zipPath: string
): Promise<{failedTests: string[]; flakyTests: string[]}> {
  const failedTests: string[] = []
  const flakyTests: string[] = []
  const tmpDir = path.resolve('logs', 'tmp') // Ensure this is an absolute path

  // Ensure the temporary directory exists
  fs.mkdirSync(tmpDir, {recursive: true})

  // Extract the zip file asynchronously
  await extract(zipPath, {dir: tmpDir}) // Pass the absolute path here

  // Read all XML files from the extracted directory
  const xmlFiles = fs.readdirSync(tmpDir).filter(file => file.endsWith('.xml'))

  for (const xmlFile of xmlFiles) {
    const xmlContent = fs.readFileSync(path.join(tmpDir, xmlFile), 'utf-8')
    const parser = new xml2js.Parser()

    await new Promise<void>((resolve, reject) => {
      parser.parseString(xmlContent, (err, result: TestSuite) => {
        if (err) {
          console.error(`Failed to parse XML file ${xmlFile}:`, err)
          reject(err)
          return
        }

        const testSuites = result.testsuites?.testsuite || [result.testsuite]
        for (const suite of testSuites) {
          const testCases = suite?.testcase || []
          for (const testCase of testCases) {
            const testName = testCase.$.name

            const hasFailure = Boolean(testCase.failure)
            const hasError = Boolean(testCase.error)

            // Check if retries are mentioned
            const failureMessages = Array.isArray(testCase.failure)
              ? testCase.failure.map(f => (f as {_?: string})._ || f)
              : [testCase.failure]

            const hasRetry = failureMessages.some(
              msg => typeof msg === 'string' && msg.includes('Retry')
            )

            console.log(testName)
            console.log('hasRetry', hasRetry)
            console.log('hasFailure', hasFailure)
            console.log('hasError', hasError)
            if (hasRetry && !hasError && !hasFailure) {
              // Test retried and eventually passed
              flakyTests.push(testName)
            } else if (hasFailure || hasError) {
              // Test failed without eventually passing
              failedTests.push(testName)
            }
          }
        }
        resolve()
      })
    })
  }

  return {failedTests, flakyTests}
}
interface TestCase {
  $: {name: string}
  failure?: unknown[]
  error?: unknown[]
}

interface TestSuite {
  testsuites?: {
    testsuite: {
      testcase: TestCase[]
    }[]
  }
  testsuite?: {
    testcase: TestCase[]
  }
}

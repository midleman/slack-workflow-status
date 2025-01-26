import * as core from '@actions/core'
import {fetchWorkflowArtifacts} from './github/fetchArtifacts'
import {handleError} from './utils/handleError'
import {buildTestSummaryThread} from './slack/buildTestSummaryThread'
import {getActionInputs} from './utils/inputs'
import {sendSlackMessage} from './slack/sendSlackMessage'
import {buildJobSummaryMessage} from './slack/buildJobSummaryMessage'
import {analyzeJobs} from './utils/analyzeJobs'

process.on('unhandledRejection', handleError)

async function main(): Promise<void> {
  try {
    const inputs = getActionInputs()

    const {
      githubToken,
      slackToken,
      slackChannel,
      notifyOn,
      jobsToFetch,
      includeJobsTime,
      commentJunitFailures,
      commentJunitFlakes
    } = inputs

    // Force as secret, forces *** when trying to print or log values
    core.setSecret(githubToken)
    core.setSecret(slackToken)

    // Fetch workflow run data and job information
    const {workflowRun, jobs} = await fetchWorkflowArtifacts(githubToken)

    const {completedJobs, shouldNotify} = await analyzeJobs({
      githubToken,
      workflowRun,
      notifyOn,
      jobsToFetch
    })

    if (!shouldNotify) {
      core.info(
        'No notification sent: All jobs passed and "notifyOn" is set to "fail-only".'
      )
      return
    }

    // Build and send initial message with job summary
    const jobSummaryMessage = buildJobSummaryMessage({
      workflowRun,
      completedJobs,
      includeJobsTime
    })

    const initialMessage = await sendSlackMessage({
      slackToken,
      channel: slackChannel,
      message: jobSummaryMessage.text,
      attachments: jobSummaryMessage.attachments
    })
    const threadTs = initialMessage.ts // Capture thread timestamp

    // Build test summary thread content
    if (commentJunitFailures || commentJunitFlakes) {
      const {failedTests, flakyTests} = jobs
      const testSummaryThread = buildTestSummaryThread({
        failedTests,
        flakyTests,
        commentFailures: commentJunitFailures,
        commentFlakes: commentJunitFlakes
      })

      // Comment on the initial message with the test summary
      if (testSummaryThread) {
        await sendSlackMessage({
          slackToken,
          channel: slackChannel,
          message: testSummaryThread,
          threadTs
        })
      }
    }
  } catch (err) {
    handleError(err as Error)
  }
}

main()

/* eslint-disable no-console */
import { context, getOctokit } from '@actions/github'
import { parseJUnitReports } from './parseJunitReports'
import { downloadArtifact } from './downloadArtifact'
import fs from 'fs'
import path from 'path'
import extract from 'extract-zip'

/**
 * Fetch and process workflow artifacts.
 *  1. Fetches workflow run data
 *  2. Fetches job information
 *  3. Processes JUnit reports
 *  4. Extracts report URLs
 * @param githubToken - GitHub token
 * @param jobsToFetch - max number of jobs to fetch
 * @returns Workflow run data and processed artifacts: flakes, failures, report URLs
 */
export async function fetchWorkflowArtifacts(
  githubToken: string,
  jobsToFetch = 30
): Promise<{
  workflowRun: any // eslint-disable-line @typescript-eslint/no-explicit-any
  jobs: {
    failedTests: Record<string, string[]>
    flakyTests: Record<string, string[]>
    reportUrls: Record<string, string>
  }
}> {
  const octokit = getOctokit(githubToken)

  // Fetch workflow run data
  const { data: workflowRun } = await octokit.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  // Fetch workflow job information
  const { data: jobsResponse } = await octokit.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
    per_page: jobsToFetch // Fetch up to 30 jobs
  })

  // Identify completed jobs
  const completedJobs = jobsResponse.jobs.filter(
    (job) => job.status === 'completed'
  )

  // Check if there are any job failures
  const hasFailures = completedJobs.some(
    (job) => !['success', 'skipped'].includes(job.conclusion)
  )

  // Decide whether to send a notification
  const notifyOn = process.env.NOTIFY_ON || 'always'
  const shouldNotify =
    notifyOn === 'always' || (notifyOn.includes('fail') && hasFailures)

  if (!shouldNotify) {
    console.info(
      'No notification sent: All jobs passed and "notify_on" is set to "fail-only".'
    )
    return {
      workflowRun,
      jobs: { failedTests: {}, flakyTests: {}, reportUrls: {} }
    } // Exit without processing artifacts
  }

  // Fetch and process artifacts
  const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  const failedTests: Record<string, string[]> = {}
  const flakyTests: Record<string, string[]> = {}
  const reportUrls: Record<string, string> = {}

  for (const artifact of artifacts.artifacts) {
    const artifactName = artifact.name

    if (artifactName.startsWith('junit-')) {
      // Process JUnit reports
      const artifactPath = await downloadArtifact({
        githubToken,
        owner: workflowRun.repository.owner.login,
        repo: workflowRun.repository.name,
        artifactId: artifact.id,
        artifactName
      })

      const { failed, flaky } = await parseJUnitReports(artifactPath)
      const cleanArtifactName = artifactName.replace(/^junit-/, '')

      if (failed.length > 0) failedTests[cleanArtifactName] = failed
      if (flaky.length > 0) flakyTests[cleanArtifactName] = flaky
    } else if (artifactName.startsWith('report-url-')) {
      // Extract report URL from the artifact
      const artifactPath = await downloadArtifact({
        githubToken,
        owner: workflowRun.repository.owner.login,
        repo: workflowRun.repository.name,
        artifactId: artifact.id,
        artifactName
      })

      // Extract the zip file
      const extractionDir = path.resolve('logs', artifactName)
      await extract(artifactPath, { dir: extractionDir })

      // Locate the `report-url.txt` file
      const reportFilePath = path.join(extractionDir, 'report-url.txt')

      // Check if the file exists
      if (!fs.existsSync(reportFilePath)) {
        throw new Error(`report-url.txt not found in artifact: ${artifactName}`)
      }

      // Read and parse the URL from the extracted file
      const reportUrl = await fs.promises.readFile(reportFilePath, 'utf-8')
      const cleanArtifactName = artifactName.replace(/^report-url-/, '')

      // Trim and store the URL
      reportUrls[cleanArtifactName] = reportUrl.trim()
    }
  }

  console.log('failedTests', failedTests)
  console.log('flakyTests', flakyTests)
  console.log('reportUrls', reportUrls)

  return { workflowRun, jobs: { failedTests, flakyTests, reportUrls } }
}

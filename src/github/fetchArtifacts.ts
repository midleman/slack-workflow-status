import {context, getOctokit} from '@actions/github'
import {parseJUnitReports} from './parseJunitReports'
import {downloadArtifact} from './downloadArtifact'
import fs from 'fs'

export async function fetchWorkflowArtifacts(
  githubToken: string
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
  const {data: workflowRun} = await octokit.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  // Fetch workflow job information
  const {data: jobsResponse} = await octokit.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
    per_page: 30 // Fetch up to 30 jobs
  })

  const completedJobs = jobsResponse.jobs.filter(
    job => job.status === 'completed'
  )

  // Check if there are any job failures
  const hasFailures = completedJobs.some(
    job => !['success', 'skipped'].includes(job.conclusion)
  )

  // Decide whether to send a notification
  const notifyOn = process.env.NOTIFY_ON || 'always'
  const shouldNotify =
    notifyOn === 'always' || (notifyOn.includes('fail') && hasFailures)

  if (!shouldNotify) {
    // eslint-disable-next-line no-console
    console.info(
      'No notification sent: All jobs passed and "notify_on" is set to "fail-only".'
    )
    return {
      workflowRun,
      jobs: {failedTests: {}, flakyTests: {}, reportUrls: {}}
    } // Exit without processing artifacts
  }

  // Fetch and process artifacts
  const {data: artifacts} = await octokit.actions.listWorkflowRunArtifacts({
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

      const {failed, flaky} = await parseJUnitReports(artifactPath)
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

      const reportUrl = await parseReportUrlTxt(artifactPath)
      const cleanArtifactName = artifactName.replace(/^report-url-/, '')

      reportUrls[cleanArtifactName] = reportUrl
    }
  }

  return {workflowRun, jobs: {failedTests, flakyTests, reportUrls}}
}

// Read report URL from a plain text file
async function parseReportUrlTxt(filePath: string): Promise<string> {
  const content = await fs.promises.readFile(filePath, 'utf-8')
  return content.trim() // Remove any extra whitespace or newlines
}

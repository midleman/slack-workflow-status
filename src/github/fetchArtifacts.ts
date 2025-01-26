/* eslint-disable no-console */
import {context, getOctokit} from '@actions/github'
import {parseJUnitReports} from './parseJunitReports'
import {downloadArtifact} from './downloadArtifact'

export async function fetchWorkflowArtifacts(
  githubToken: string
): Promise<{
  workflowRun: any // eslint-disable-line @typescript-eslint/no-explicit-any
  jobs: {
    failedTests: Record<string, {jobName: string; tests: string[]}[]>
    flakyTests: Record<string, {jobName: string; tests: string[]}[]>
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
    console.info(
      'No notification sent: All jobs passed and "notify_on" is set to "fail-only".'
    )
    return {
      workflowRun,
      jobs: {failedTests: {}, flakyTests: {}} // exit without fetching artifacts
    }
  }

  // Fetch and process artifacts
  const {data: artifacts} = await octokit.actions.listWorkflowRunArtifacts({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId
  })

  const failedTests: Record<string, {jobName: string; tests: string[]}[]> = {}
  const flakyTests: Record<string, {jobName: string; tests: string[]}[]> = {}

  for (const artifact of artifacts.artifacts) {
    if (artifact.name.includes('junit')) {
      const artifactPath = await downloadArtifact({
        githubToken,
        owner: workflowRun.repository.owner.login,
        repo: workflowRun.repository.name,
        artifactId: artifact.id,
        artifactName: artifact.name
      })

      const {failed, flaky} = await parseJUnitReports(artifactPath)

      // Match artifact with its associated job name
      const jobName =
        completedJobs.find(job => job.name.includes(artifact.name))?.name ||
        'Unknown Job'

      if (failed.length > 0) {
        if (!failedTests[artifact.name]) {
          failedTests[artifact.name] = []
        }
        failedTests[artifact.name].push({jobName, tests: failed})
      }

      if (flaky.length > 0) {
        if (!flakyTests[artifact.name]) {
          flakyTests[artifact.name] = []
        }
        flakyTests[artifact.name].push({jobName, tests: flaky})
      }
    }
  }

  return {workflowRun, jobs: {failedTests, flakyTests}}
}

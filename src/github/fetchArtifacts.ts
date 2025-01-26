import {context, getOctokit} from '@actions/github'
import {parseJUnitReports} from './parseJunitReports'

export async function fetchWorkflowArtifacts(
  githubToken: string
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflowRun: any
  jobs: {
    failedTests: Record<string, string[]>
    flakyTests: Record<string, string[]>
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
    return {workflowRun, jobs: {failedTests: {}, flakyTests: {}}} // Exit without processing artifacts
  }

  // Fetch artifacts
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
    const {failed, flaky} = await parseJUnitReports(artifact.name)
    failedTests[artifact.name] = failed
    flakyTests[artifact.name] = flaky
  }

  return {workflowRun, jobs: {failedTests, flakyTests}}
}

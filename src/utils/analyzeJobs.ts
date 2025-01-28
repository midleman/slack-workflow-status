import { getOctokit } from '@actions/github'

export async function analyzeJobs({
  githubToken,
  workflowRun,
  notifyOn,
  jobsToFetch
}: {
  githubToken: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflowRun: any
  notifyOn: string
  jobsToFetch: number
}): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completedJobs: any[]
  //   hasFailures: boolean
  shouldNotify: boolean
}> {
  const octokit = getOctokit(githubToken)
  const { data: jobsResponse } = await octokit.actions.listJobsForWorkflowRun({
    owner: workflowRun.repository.owner.login,
    repo: workflowRun.repository.name,
    run_id: workflowRun.id,
    per_page: jobsToFetch
  })

  const completedJobs = jobsResponse.jobs.filter(
    (job) => job.status === 'completed'
  )

  const hasFailures = completedJobs.some(
    (job) => !['success', 'skipped'].includes(job.conclusion)
  )

  const shouldNotify =
    notifyOn === 'always' || (notifyOn.includes('fail') && hasFailures)

  return { completedJobs, shouldNotify }
}

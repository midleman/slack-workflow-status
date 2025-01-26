/* eslint-disable no-console */
export function buildTestSummaryThread({
  failedTests,
  flakyTests,
  commentFailures,
  commentFlakes
}: {
  failedTests: Record<string, {jobName: string; tests: string[]}[]>
  flakyTests: Record<string, {jobName: string; tests: string[]}[]>
  commentFailures: boolean
  commentFlakes: boolean
}): string {
  console.log('failedTests', failedTests)
  console.log('flakyTests', flakyTests)

  // Combine all tests grouped by jobName
  const allTestsByJob: Record<string, string[]> = {}

  // Process failed tests grouped by job name
  if (commentFailures) {
    for (const [, jobTestGroups] of Object.entries(failedTests)) {
      for (const {jobName, tests} of jobTestGroups) {
        allTestsByJob[jobName] = allTestsByJob[jobName] || []
        allTestsByJob[jobName].push(...tests.map(test => `:x: ${test}`))
      }
    }
  }

  // Process flaky tests grouped by job name
  if (commentFlakes) {
    for (const [, jobTestGroups] of Object.entries(flakyTests)) {
      for (const {jobName, tests} of jobTestGroups) {
        allTestsByJob[jobName] = allTestsByJob[jobName] || []
        allTestsByJob[jobName].push(...tests.map(test => `:warning: ${test}`))
      }
    }
  }

  // Format the summary thread grouped by job name
  const formattedSummary = Object.entries(allTestsByJob)
    .map(
      ([jobName, tests]) => `*${jobName}*\n${tests.join('\n')}` // Group tests under each job name
    )
    .join('\n\n') // Separate job summaries with a double newline

  console.log('formattedSummary', formattedSummary)
  return formattedSummary
}

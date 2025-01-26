/* eslint-disable no-console */
export function buildTestSummaryThread({
  failedTests,
  flakyTests,
  commentFailures,
  commentFlakes
}: {
  failedTests: Record<string, string[]>
  flakyTests: Record<string, string[]>
  commentFailures: boolean
  commentFlakes: boolean
}): string {
  console.log('failedTests', failedTests)
  console.log('flakyTests', flakyTests)

  // Combine failed and flaky tests into one object
  const allTests: Record<string, string[]> = {}

  // Add failed tests
  if (commentFailures) {
    for (const [artifactName, tests] of Object.entries(failedTests)) {
      allTests[artifactName] = allTests[artifactName] || []
      allTests[artifactName].push(...tests.map(test => `:x: ${test}`))
    }
  }

  // Add flaky tests
  if (commentFlakes) {
    for (const [artifactName, tests] of Object.entries(flakyTests)) {
      allTests[artifactName] = allTests[artifactName] || []
      allTests[artifactName].push(...tests.map(test => `:warning: ${test}`))
    }
  }

  // Format the summary thread grouped by artifact
  const formattedSummary = Object.entries(allTests)
    .map(
      ([artifactName, tests]) => `*${artifactName}*\n${tests.join('\n')}` // Group tests under the job name
    )
    .join('\n\n') // Separate jobs with a double newline

  console.log('formattedSummary', formattedSummary)
  return formattedSummary
}

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
  const formattedFailures = commentFailures
    ? Object.entries(failedTests)
        .map(([artifactName, tests]) =>
          [`*${artifactName}*`, ...tests.map(test => `:x: ${test}`)].join('\n')
        )
        .join('\n\n')
    : ''
  console.log('formattedFailures', formattedFailures)

  const formattedFlakes = commentFlakes
    ? Object.entries(flakyTests)
        .map(([artifactName, tests]) =>
          [`*${artifactName}*`, ...tests.map(test => `:warning: ${test}`)].join(
            '\n'
          )
        )
        .join('\n\n')
    : ''
  console.log('formattedFlakes', formattedFlakes)

  return [formattedFailures, formattedFlakes].filter(Boolean).join('\n\n')
}

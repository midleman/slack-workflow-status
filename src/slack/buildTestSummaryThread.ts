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
  const formattedFailures = commentFailures
    ? Object.entries(failedTests)
        .map(([artifactName, tests]) =>
          [`*${artifactName}*`, ...tests.map(test => `:x: ${test}`)].join('\n')
        )
        .join('\n\n')
    : ''

  const formattedFlakes = commentFlakes
    ? Object.entries(flakyTests)
        .map(([artifactName, tests]) =>
          [`*${artifactName}*`, ...tests.map(test => `:warning: ${test}`)].join(
            '\n'
          )
        )
        .join('\n\n')
    : ''

  return [formattedFailures, formattedFlakes].filter(Boolean).join('\n\n')
}

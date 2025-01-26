/* eslint-disable no-console */
export function buildTestSummaryThread({
  failedTests,
  flakyTests,
  reportUrls,
  commentFailures,
  commentFlakes,
  commentJunitFailuresEmoji,
  commentJunitFlakesEmoji
}: {
  failedTests: Record<string, string[]>
  flakyTests: Record<string, string[]>
  reportUrls: Record<string, string>
  commentFailures: boolean
  commentFlakes: boolean
  commentJunitFailuresEmoji: string
  commentJunitFlakesEmoji: string
}): string {
  console.log('failedTests', failedTests)
  console.log('flakyTests', flakyTests)
  console.log('reportUrls', reportUrls)

  // Combine failed and flaky tests into one object
  const allTests: Record<string, string[]> = {}

  // Add failed tests
  if (commentFailures) {
    for (const [artifactName, tests] of Object.entries(failedTests)) {
      const cleanArtifactName = artifactName.replace(/^junit-/, '') // Remove "junit-" prefix
      allTests[cleanArtifactName] = allTests[cleanArtifactName] || []
      allTests[cleanArtifactName].push(
        ...tests.map(test => `${commentJunitFailuresEmoji} ${test}`)
      )
    }
  }

  // Add flaky tests
  if (commentFlakes) {
    for (const [artifactName, tests] of Object.entries(flakyTests)) {
      const cleanArtifactName = artifactName.replace(/^junit-/, '') // Remove "junit-" prefix
      allTests[cleanArtifactName] = allTests[cleanArtifactName] || []
      allTests[cleanArtifactName].push(
        ...tests.map(test => `${commentJunitFlakesEmoji} ${test}`)
      )
    }
  }

  // Format the summary thread grouped by artifact
  const formattedSummary = Object.entries(allTests)
    .map(([artifactName, tests]) => {
      const reportUrl = reportUrls[artifactName] || null
      const jobTitle = reportUrl
        ? `<${reportUrl}|*${artifactName}*>` // Hyperlink the artifact name
        : `*${artifactName}*` // Fallback to plain text if no URL exists
      return `${jobTitle}\n${tests.join('\n')}` // Group tests under the job name
    })
    .join('\n\n') // Separate jobs with a double newline

  console.log('formattedSummary', formattedSummary)
  return formattedSummary
}

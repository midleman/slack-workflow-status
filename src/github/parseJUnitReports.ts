import fs from 'fs'
import path from 'path'
import extract from 'extract-zip'
import * as xml2js from 'xml2js'

export async function parseJUnitReports(
  artifactName: string
): Promise<{failed: string[]; flaky: string[]}> {
  const failed: string[] = []
  const flaky: string[] = []

  const tmpDir = path.resolve('logs', 'tmp')
  fs.mkdirSync(tmpDir, {recursive: true})

  await extract(artifactName, {dir: tmpDir})
  const xmlFiles = fs.readdirSync(tmpDir).filter(file => file.endsWith('.xml'))

  for (const file of xmlFiles) {
    const content = fs.readFileSync(path.join(tmpDir, file), 'utf-8')
    const result = await xml2js.parseStringPromise(content)

    for (const suite of result.testsuites.testsuite) {
      for (const testCase of suite.testcase) {
        if (testCase.failure) {
          failed.push(testCase.$.name)
        } else if (
          testCase['system-out']?.some((out: string) => /retry/i.test(out))
        ) {
          flaky.push(testCase.$.name)
        }
      }
    }
  }

  return {failed, flaky}
}

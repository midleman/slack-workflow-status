import {getOctokit} from '@actions/github'
import fs from 'fs'
import path from 'path'

export async function downloadArtifact({
  githubToken,
  owner,
  repo,
  artifactId,
  artifactName
}: {
  githubToken: string
  owner: string
  repo: string
  artifactId: number
  artifactName: string
}): Promise<string> {
  const octokit = getOctokit(githubToken)
  const artifactPath = path.resolve('logs', `${artifactName}.zip`)
  fs.mkdirSync('logs', {recursive: true})

  const {data} = await octokit.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: 'zip'
  })

  fs.writeFileSync(artifactPath, Buffer.from(data as ArrayBuffer))
  return artifactPath
}

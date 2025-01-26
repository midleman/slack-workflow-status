import * as core from '@actions/core'

export function handleError(err: Error): void {
  core.error(err)
  core.setFailed(err.message || 'Unhandled error occurred')
}

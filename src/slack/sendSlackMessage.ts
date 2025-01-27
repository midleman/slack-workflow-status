import { ChatPostMessageResponse, WebClient } from '@slack/web-api'

export async function sendSlackMessage({
  slackToken,
  channel,
  message,
  attachments,
  threadTs
}: {
  slackToken: string
  channel: string
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments?: any
  threadTs?: string
}): Promise<ChatPostMessageResponse> {
  const client = new WebClient(slackToken)
  return client.chat.postMessage({
    channel,
    text: message,
    attachments,
    thread_ts: threadTs,
    unfurl_links: false,
    unfurl_media: false
  })
}

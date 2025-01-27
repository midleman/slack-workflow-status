# Slack Workflow Status
This action posts workflow status notifications into your Slack channel. The notification includes details such as the Actor, Event, Branch, Workflow Name, Status, and Run Durations. 
**NEW** Additionally, this action supports uploading and referencing Playwright artifacts (e.g., JUnit test results and report URLs) to provide detailed context about your workflow's execution.

<img src="./docs/images/example.png" title="Slack Example">

## Key Features

- Posts workflow notifications to Slack.
- Includes individual job statuses and durations (optional).
- Supports Playwright (Junit) test result summaries with failure and flake details. (optional)
- Includes a report URL for Playwright-based jobs. (optional)

## Action Inputs

| Name                       | Required  | Default         | Description |
|----------------------------|-----------|-----------------|-------------|
| **repo_token**             | Yes       | -               | A token is automatically available in your workflow secrets var: `${{secrets.GITHUB_TOKEN}}`. You can optionally send an alternative self-generated token. |
| **slack_token**            | Yes       | -               | Your Slack token for posting notifications. |
| **channel**                | No        | -               | The Slack channel to send notifications to. |
| **include_jobs**           | No        | `true`          | When set to `true`, includes individual job statuses and durations in the Slack notification. Use `false` to exclude them or `on-failure` to include only when the workflow fails. |
| **include_jobs_time**      | No        | `true`          | When `true`, includes job run times in the Slack notification. |
| **include_commit_message** | No        | `true`          | When `true`, includes the head commit message in the notification. |
| **jobs_to_fetch**          | No        | `30`            | Sets the number of jobs to fetch for workflows with a large number of jobs. |
| **notify_on**              | No        | `always`        | Controls when notifications are sent: `always`, `fail-only`, `never`. |
| **junit_path**             | No        | `test-results/junit.xml` | Path to the JUnit test results. Needed in order to add test result details in comment thread. |
| **report_url**             | Yes       | -               | The report URL to save and upload as an artifact. This will be hyperlinked in the comment thread. |
| **comment_junit_failures** | No        | `false`         | When `true`, includes JUnit test failures in the Slack notification comment thread. |
| **comment_junit_flakes**   | No        | `false`         | When `true`, includes JUnit test flakes in the Slack notification comment thread. |
| **comment_junit_fail_emoji** | No      | `:x:`           | Emoji used for JUnit test failures. |
| **comment_junit_flakes_emoji** | No    | `:warning:`     | Emoji used for JUnit test flakes. |

## Usage

To use this action properly, you should create a new `job` at the end of your workflow that `needs` all other jobs in the workflow. This ensures that this action is only run once all jobs in your workflow are complete.

This action requires `read` permission of `actions` scope. You should assign a job level `actions` permission if workflow level `actions` permission is set `none`.

See example workflow [here](https://github.com/midleman/slack-workflow-status/tree/master/.github/workflows/action.yml).

```yaml
name: Workflow Example
on:
  push:
    branches: [ main ]

jobs:
  job-1:
  # implement job 1 here

  job-2:
  # implement job 2 here

  job-3-playwright:
    container:
      image: mcr.microsoft.com/playwright:v1.50.0-noble
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright test

    # use this composite action to upload playwright artifacts. these will
    # be used downstream to comment on the initial workflow summary slack message.
    - name: Save and Upload Artifacts for Slack Notification
      uses: ./.github/actions/upload-artifacts
      if: ${{ !cancelled() }}
      with:
        job_name: ${{ github.job }}
        junit_path: 'test-results/junit.xml'
        report_url: 'http://www.my-url.html'

  slack-notifications:
    if: always()
    name: Post Workflow Notifications
    needs: 
      - job-1
      - job-2
      - job-3-playwright
    runs-on: ubuntu-latest

    steps:
    # sends the initial slack message. and depending on configuration, it can
    # also comment in a thread with the playwright test results and report hyperlink.
      - name: Post Workflow Status to Slack
        uses: midleman/slack-workflow-status@master
        with:
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          slack_token: ${{ secrets.SLACK_TOKEN }}
          channel: '#test-results'
          comment_junit_failures: true
          comment_junit_flakes: true
```
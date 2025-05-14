import { test, expect } from '@playwright/test'

test('this test should pass', async ({ page }) => {
  expect(2).toBe(2)
})

test('this test should fail', async () => {
  expect(1).toBe(2)
})

test('this test should flake', async ({}, testInfo) => {
  if (testInfo.retry) {
    expect(2).toBe(2)
  } else {
    expect(1).toBe(2)
  }
})

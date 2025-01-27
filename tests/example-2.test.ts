import { test, expect } from '@playwright/test'

test('this test should pass also', async ({ page }) => {
  expect(2).toBe(2)
})

test.skip('this test should fail also', async () => {
  expect(1).toBe(2)
})

test('this test should flake also', async ({}, testInfo) => {
  if (testInfo.retry) {
    expect(2).toBe(2)
  } else {
    expect(1).toBe(2)
  }
})

import { test, expect } from '@playwright/test'

test('this test should pass too', async ({ page }) => {
  expect(2).toBe(2)
})

test.skip('this test should fail too', async () => {
  expect(1).toBe(2)
})

test('this test should flake too', async ({}, testInfo) => {
  if (testInfo.retry) {
    expect(2).toBe(2)
  } else {
    expect(1).toBe(2)
  }
})

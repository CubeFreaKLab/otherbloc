const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Authentication traces capture request bodies. Do not retain credentials in artifacts.
    trace: 'off', video: 'off', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})

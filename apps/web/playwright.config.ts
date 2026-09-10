import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.WEB_PORT ?? '3000';
const baseURL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Deliberately not the site's timezone: the screens must read the same either way.
    timezoneId: 'America/New_York',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- -p ${webPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

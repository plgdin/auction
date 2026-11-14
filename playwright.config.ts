import { defineConfig } from "@playwright/test";

const port = 5180;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${port}`,
    channel: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

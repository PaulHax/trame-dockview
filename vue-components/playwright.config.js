/* eslint-env node */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "@playwright/test";

const localPython = resolve(process.cwd(), "../.venv/bin/python");
const python =
  process.env.TRAME_E2E_PYTHON ||
  (existsSync(localPython) ? localPython : "python");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: `"${python}" e2e/app.py`,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});

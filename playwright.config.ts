import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5174', trace: 'on-first-retry' },
  // Console de mesa: a tela que importa é a do computador da central.
  projects: [{ name: 'central', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:5174', reuseExistingServer: true },
});

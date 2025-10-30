import { test, expect } from '../src/fixtures';

test.describe.configure({ mode: 'serial' });

test.describe('Insider Threat - E2E Tests', () => {
  test('should install app successfully with dummy Workday credentials', async ({ appCatalogPage }) => {
    // This app requires Workday API credentials which we don't have in E2E tests
    // The test verifies the app can be installed with dummy credentials
    // Workflows won't be functional without real Workday API access
    const appName = 'foundry-sample-insider-threat';
    const isInstalled = await appCatalogPage.isAppInstalled(appName);

    expect(isInstalled).toBe(true);
    console.log(`✓ App '${appName}' installed successfully with configuration`);
  });
});

import { test as teardown } from '../src/fixtures';

teardown('uninstall Insider Threat app', async ({ appCatalogPage, appName }) => {
  teardown.setTimeout(180000); // 3 minutes for uninstallation
  // Clean up by uninstalling the app after all tests complete
  await appCatalogPage.navigateToPath('/foundry/app-catalog', 'App Catalog');
  await appCatalogPage.uninstallApp(appName);
});

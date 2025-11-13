import { test, test as setup } from '../src/fixtures';

setup('install Insider Risk Workday app', async ({ appCatalogPage, appBuilderPage, appName }) => {
  // Extend timeout for this test - disabling workflow provisioning + deploy/release takes time
  test.setTimeout(300000); // 5 minutes

  // Check if app is already installed (this navigates to the app page)
  const isInstalled = await appCatalogPage.isAppInstalled(appName);

  if (!isInstalled) {
    console.log(`App '${appName}' is not installed. Disabling workflow provisioning and installing...`);

    // Disable workflow provisioning before installing
    await appBuilderPage.disableWorkflowProvisioning(appName);

    // Install the app
    const installed = await appCatalogPage.installApp(appName);

    if (!installed) {
      throw new Error(`Failed to install app '${appName}'`);
    }
  } else {
    console.log(`App '${appName}' is already installed`);
  }
});

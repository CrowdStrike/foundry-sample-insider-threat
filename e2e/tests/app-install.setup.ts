import { test as setup } from '../src/fixtures';

setup('install Insider Threat app', async ({ appCatalogPage, appBuilderPage, appName }) => {
  // Check if app is already installed (this navigates to the app page)
  const isInstalled = await appCatalogPage.isAppInstalled(appName);

  if (!isInstalled) {
    console.log(`App '${appName}' is not installed. Disabling workflow provisioning and installing...`);

    // Disable workflow provisioning before installation
    await appBuilderPage.disableWorkflowProvisioning(appName);

    // Now install the app
    const installed = await appCatalogPage.installApp(appName);

    if (!installed) {
      throw new Error(`Failed to install app '${appName}'`);
    }
  } else {
    console.log(`App '${appName}' is already installed`);
  }
});

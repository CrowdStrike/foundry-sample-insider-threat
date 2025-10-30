import { test as setup } from '../src/fixtures';

setup('install Insider Threat app', async ({ appCatalogPage, appName }) => {
  setup.setTimeout(180000); // 3 minutes for installation
  // Check if app is already installed (this navigates to the app page)
  const isInstalled = await appCatalogPage.isAppInstalled(appName);

  if (!isInstalled) {
    console.log(`App '${appName}' is not installed. Installing...`);
    const installed = await appCatalogPage.installApp(appName);

    if (!installed) {
      throw new Error(
        `Failed to install app '${appName}'. The app may need to be deployed first.\n` +
        `See the README for deployment instructions.`
      );
    }
  } else {
    console.log(`App '${appName}' is already installed`);
  }
});

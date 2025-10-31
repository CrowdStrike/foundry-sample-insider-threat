/**
 * AppCatalogPage - App installation and management
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RetryHandler } from '../utils/SmartWaiter';
import { config } from '../config/TestConfig';

export class AppCatalogPage extends BasePage {
  constructor(page: Page) {
    super(page, 'AppCatalogPage');
  }

  protected getPagePath(): string {
    return '/foundry/app-catalog';
  }

  protected async verifyPageLoaded(): Promise<void> {
    // Use the heading which is unique
    await this.waiter.waitForVisible(
      this.page.locator('h1:has-text("App catalog")'),
      { description: 'App Catalog page' }
    );

    this.logger.success('App Catalog page loaded successfully');
  }

  /**
   * Search for app in catalog and navigate to its page
   */
  private async searchAndNavigateToApp(appName: string): Promise<void> {
    this.logger.info(`Searching for app '${appName}' in catalog`);

    await this.navigateToPath('/foundry/app-catalog', 'App catalog page');

    const searchBox = this.page.getByRole('searchbox', { name: 'Search' });
    await searchBox.fill(appName);
    await this.page.keyboard.press('Enter');
    await this.page.waitForLoadState('networkidle');

    const appLink = this.page.getByRole('link', { name: appName, exact: true });

    try {
      await this.waiter.waitForVisible(appLink, {
        description: `App '${appName}' link in catalog`,
        timeout: 10000
      });
      this.logger.success(`Found app '${appName}' in catalog`);
      await this.smartClick(appLink, `App '${appName}' link`);
      await this.page.waitForLoadState('networkidle');
    } catch (error) {
      throw new Error(`Could not find app '${appName}' in catalog. Make sure the app is deployed.`);
    }
  }

  /**
   * Check if app is installed
   */
  async isAppInstalled(appName: string): Promise<boolean> {
    this.logger.step(`Check if app '${appName}' is installed`);

    // Search for and navigate to the app's catalog page
    await this.searchAndNavigateToApp(appName);

    // Simple check: if "Install now" link exists, app is NOT installed
    const installLink = this.page.getByRole('link', { name: 'Install now' });
    const hasInstallLink = await this.elementExists(installLink, 3000);

    const isInstalled = !hasInstallLink;
    this.logger.info(`App '${appName}' installation status: ${isInstalled ? 'Installed' : 'Not installed'}`);

    return isInstalled;
  }

  /**
   * Install app if not already installed
   */
  async installApp(appName: string): Promise<boolean> {
    this.logger.step(`Install app '${appName}'`);

    const isInstalled = await this.isAppInstalled(appName);
    if (isInstalled) {
      this.logger.info(`App '${appName}' is already installed`);
      return false;
    }

    // Click Install now link
    this.logger.info('App not installed, looking for Install now link');
    const installLink = this.page.getByRole('link', { name: 'Install now' });

    await this.waiter.waitForVisible(installLink, { description: 'Install now link' });
    await this.smartClick(installLink, 'Install now link');
    this.logger.info('Clicked Install now, waiting for install page to load');

    // Wait for URL to change to install page and page to stabilize
    await this.page.waitForURL(/\/foundry\/app-catalog\/[^\/]+\/install$/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');

    // Handle permissions dialog
    await this.handlePermissionsDialog();

    // Handle app configuration if present
    await this.handleAppConfiguration();

    // Click final install button
    await this.clickInstallAppButton();

    // Wait for installation to complete
    await this.waitForInstallation(appName);

    // Verify the app is actually installed by checking catalog
    await this.waiter.delay(2000);
    const verifyInstalled = await this.isAppInstalled(appName);
    if (!verifyInstalled) {
      this.logger.error(`App '${appName}' installation completed but app is not showing as installed in catalog`);
      return false;
    }

    this.logger.success(`App '${appName}' installed successfully`);
    return true;
  }

  /**
   * Handle permissions dialog if present
   */
  private async handlePermissionsDialog(): Promise<void> {
    const acceptButton = this.page.getByRole('button', { name: /accept.*continue/i });

    if (await this.elementExists(acceptButton, 3000)) {
      this.logger.info('Permissions dialog detected, accepting');
      await this.smartClick(acceptButton, 'Accept and continue button');
      await this.waiter.delay(2000);
    }
  }

  /**
   * Get field context by looking at nearby labels and text
   */
  private async getFieldContext(input: any): Promise<string> {
    try {
      // Try to find the label element
      const id = await input.getAttribute('id');
      if (id) {
        const label = this.page.locator(`label[for="${id}"]`);
        if (await label.isVisible({ timeout: 1000 }).catch(() => false)) {
          const labelText = await label.textContent();
          if (labelText) return labelText.toLowerCase();
        }
      }

      // Look at parent container for context
      const parent = input.locator('xpath=ancestor::div[contains(@class, "form") or contains(@class, "field") or contains(@class, "input")][1]');
      if (await parent.isVisible({ timeout: 1000 }).catch(() => false)) {
        const parentText = await parent.textContent();
        if (parentText) return parentText.toLowerCase();
      }
    } catch (error) {
      // Continue if we can't get context
    }
    return '';
  }

  /**
   * Get value for a field based on its context
   */
  private getFieldValue(context: string, name: string, placeholder: string, inputType: string): string {
    const combined = `${context} ${name} ${placeholder}`.toLowerCase();

    // OAuth credentials need realistic base64-like formats
    if (combined.includes('clientid') || combined.includes('client_id') || combined.includes('client id')) {
      return 'MjkzZWY0NWEtZTNiNy00YzJkLWI5ZjYtOGE3YmMxZDIzNDU2';
    }

    if (inputType === 'password' && (combined.includes('clientsecret') || combined.includes('client_secret') || combined.includes('client secret'))) {
      return 'NGY1ZDYyYzgtOTM0Yi00YWUzLWJhNzItMWQ4ZjdhNjhiOWNm';
    }

    if (combined.includes('host') || combined.includes('url')) {
      return 'https://wd2-impl.workday.com';
    }

    if (combined.includes('name') && !combined.includes('host') && !combined.includes('user')) {
      return 'Test Config';
    }

    // Default values
    return inputType === 'password' ? 'test-secret' : 'test-value';
  }

  /**
   * Handle app configuration settings during installation
   * Fills in dummy values for all configuration fields and clicks through settings
   */
  private async handleAppConfiguration(): Promise<void> {
    let configCount = 0;
    let hasNextSetting = true;

    // Keep filling configs until we can't find either "Next setting" or more empty fields
    while (hasNextSetting) {
      configCount++;
      this.logger.info(`Configuration screen ${configCount} detected, filling fields...`);

      // Fill visible inputs
      const inputs = this.page.locator('input[type="text"], input[type="url"], input:not([type="password"]):not([type])');
      const count = await inputs.count();
      this.logger.info(`Found ${count} text input fields`);

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const name = await input.getAttribute('name') || '';
          const placeholder = await input.getAttribute('placeholder') || '';
          const context = (await this.getFieldContext(input)).trim().replace(/\s+/g, ' ');

          const value = this.getFieldValue(context, name, placeholder, 'text');
          await input.fill(value);
          this.logger.info(`Filled input [${name || 'unnamed'}] context:"${context}" -> "${value}"`);
        }
      }

      // Fill password inputs
      const passwordInputs = this.page.locator('input[type="password"]');
      const passwordCount = await passwordInputs.count();
      this.logger.info(`Found ${passwordCount} password input fields`);

      for (let i = 0; i < passwordCount; i++) {
        const input = passwordInputs.nth(i);
        if (await input.isVisible()) {
          const name = await input.getAttribute('name') || '';
          const placeholder = await input.getAttribute('placeholder') || '';
          const context = (await this.getFieldContext(input)).trim().replace(/\s+/g, ' ');

          const value = this.getFieldValue(context, name, placeholder, 'password');
          await input.fill(value);
          this.logger.info(`Filled password [${name || 'unnamed'}] context:"${context}"`);
        }
      }

      // Check for "Next setting" button
      const nextSettingButton = this.page.getByRole('button', { name: /next setting/i });
      hasNextSetting = await this.elementExists(nextSettingButton, 2000);

      if (hasNextSetting) {
        this.logger.info(`Filled configuration screen ${configCount}, clicking Next setting`);
        await this.smartClick(nextSettingButton, 'Next setting button');
        await this.page.waitForLoadState('networkidle');
        await this.waiter.delay(3000);
      } else {
        this.logger.info(`No more "Next setting" button found after ${configCount} screen(s)`);
        break;
      }
    }

    this.logger.info(`Completed ${configCount} configuration screen(s)`);
  }

  /**
   * Click the final "Save and install" or "Install app" button
   */
  private async clickInstallAppButton(): Promise<void> {
    // Try both button texts - different apps use different wording
    const installButton = this.page.getByRole('button', { name: 'Save and install' })
      .or(this.page.getByRole('button', { name: 'Install app' }));

    await this.waiter.waitForVisible(installButton, { description: 'Install button' });

    // Wait for button to be enabled
    await installButton.waitFor({ state: 'visible', timeout: 10000 });
    await installButton.waitFor({ state: 'attached', timeout: 5000 });

    // Simple delay for form to enable button
    await this.waiter.delay(1000);

    await this.smartClick(installButton, 'Install button');
    this.logger.info('Clicked install button');
  }

  /**
   * Wait for installation to complete
   */
  private async waitForInstallation(appName: string): Promise<void> {
    this.logger.info('Waiting for installation to complete...');

    // Wait for the "installing" toast to appear
    const installingToast = this.page.getByText(/installing/i).first();
    try {
      await installingToast.waitFor({ state: 'visible', timeout: 10000 });
      this.logger.info('Installation started - "installing" toast visible');
    } catch (error) {
      this.logger.warn('Installing toast not visible, checking for installed toast');
    }

    // Wait for the "installed" toast (appears up to 10 seconds after installing toast)
    const installedToast = this.page.getByText(/installed/i).first();
    try {
      await installedToast.waitFor({ state: 'visible', timeout: 15000 });
      this.logger.success('Installation completed - "installed" toast visible');
    } catch (error) {
      this.logger.warn('Installed toast not visible, will verify installation status in next step');
    }
  }

  /**
   * Navigate to app via Custom Apps menu
   */
  async navigateToAppViaCustomApps(appName: string): Promise<void> {
    this.logger.step(`Navigate to app '${appName}' via Custom Apps`);

    return RetryHandler.withPlaywrightRetry(
      async () => {
        // Navigate to Foundry home
        await this.navigateToPath('/foundry/home', 'Foundry home page');

        // Open hamburger menu
        const menuButton = this.page.getByRole('button', { name: 'Menu' });
        await this.smartClick(menuButton, 'Menu button');

        // Click Custom apps
        const customAppsButton = this.page.getByRole('button', { name: 'Custom apps' });
        await this.smartClick(customAppsButton, 'Custom apps button');

        // Find and click the app
        const appButton = this.page.getByRole('button', { name: appName, exact: false }).first();
        if (await this.elementExists(appButton, 3000)) {
          await this.smartClick(appButton, `App '${appName}' button`);
          await this.waiter.delay(1000);

          this.logger.success(`Navigated to app '${appName}' via Custom Apps`);
          return;
        }

        throw new Error(`App '${appName}' not found in Custom Apps menu`);
      },
      `Navigate to app via Custom Apps`
    );
  }

  /**
   * Uninstall app
   */
  async uninstallApp(appName: string): Promise<void> {
    this.logger.step(`Uninstall app '${appName}'`);

    try {
      // Search for and navigate to the app's catalog page
      await this.searchAndNavigateToApp(appName);

      // Check if app is actually installed by looking for "Install now" link
      // If "Install now" link exists, app is NOT installed
      const installLink = this.page.getByRole('link', { name: 'Install now' });
      const hasInstallLink = await this.elementExists(installLink, 3000);

      if (hasInstallLink) {
        this.logger.info(`App '${appName}' is already uninstalled`);
        return;
      }

      // Click the 3-dot menu button
      const openMenuButton = this.page.getByRole('button', { name: 'Open menu' });
      await this.waiter.waitForVisible(openMenuButton, { description: 'Open menu button' });
      await this.smartClick(openMenuButton, 'Open menu button');

      // Click "Uninstall app" menuitem
      const uninstallMenuItem = this.page.getByRole('menuitem', { name: 'Uninstall app' });
      await this.waiter.waitForVisible(uninstallMenuItem, { description: 'Uninstall app menuitem' });
      await this.smartClick(uninstallMenuItem, 'Uninstall app menuitem');

      // Confirm uninstallation in modal
      const uninstallButton = this.page.getByRole('button', { name: 'Uninstall' });
      await this.waiter.waitForVisible(uninstallButton, { description: 'Uninstall confirmation button' });
      await this.smartClick(uninstallButton, 'Uninstall button');

      // Wait for uninstall to complete by checking if "Install now" link appears
      // This is more reliable than waiting for toast message
      await this.waiter.delay(2000); // Brief delay for uninstall to start

      await this.waiter.waitForVisible(installLink, {
        description: 'Install now link (indicating uninstall completed)',
        timeout: 15000
      });

      this.logger.success(`App '${appName}' uninstalled successfully`);

    } catch (error) {
      this.logger.warn(`Failed to uninstall app '${appName}': ${error.message}`);
      throw error;
    }
  }
}
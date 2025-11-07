import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RetryHandler } from '../utils/SmartWaiter';

/**
 * Page Object for Foundry App Builder
 * Handles app configuration before installation
 */
export class AppBuilderPage extends BasePage {
  constructor(page: Page) {
    super(page, 'AppBuilderPage');
  }

  /**
   * Navigate to App Builder from App Manager
   * This method assumes we're starting from somewhere in Foundry
   */
  private async navigateToAppBuilder(appName: string): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        // Open the main menu
        const menuButton = this.page.locator('button:has-text("Menu"), button[aria-label*="menu"]').first();
        await menuButton.click();

        // Wait for menu to appear and click "App manager"
        const appManagerLink = this.page.locator('text=/App manager/i').first();
        await appManagerLink.waitFor({ state: 'visible' });
        await appManagerLink.click();
        await this.page.waitForLoadState('networkidle');

        // Click on the app name
        const appLink = this.page.locator(`a:has-text("${appName}")`).first();
        await appLink.waitFor({ state: 'visible' });
        await appLink.click();
        await this.page.waitForLoadState('networkidle');

        // Click "Edit app" link to enter App Builder
        const editAppLink = this.page.locator('a:has-text("Edit app")').first();
        await editAppLink.waitFor({ state: 'visible' });
        await editAppLink.click();

        // Wait for App Builder to load
        await this.page.waitForURL(/.*\/foundry\/app-builder\/.*\/draft\/.*/, { timeout: 10000 });
        await this.page.waitForLoadState('networkidle');

        this.logger.info('Navigated to App Builder');
      },
      'Navigate to App Builder'
    );
  }

  /**
   * Navigate to the Logic section in App Builder using the lightbulb icon
   */
  private async navigateToLogicSection(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        // Check if we're already in Logic section
        const workflowTemplatesHeading = this.page.locator('heading:has-text("Workflow templates")');

        if (await workflowTemplatesHeading.isVisible({ timeout: 2000 })) {
          this.logger.info('Already in Logic section');
          return;
        }

        // Click the lightbulb icon in the left navigation for Logic
        // The lightbulb is a navigation item that links to the logic section
        const logicNavButton = this.page.locator('[data-test-selector="collapsible-nav-item"]').filter({
          has: this.page.locator('a[href*="/logic"]')
        }).first();

        await logicNavButton.waitFor({ state: 'visible' });

        // Click the link within the nav item
        const logicLink = logicNavButton.locator('a[href*="/logic"]').first();
        await logicLink.click();

        // Wait for workflow templates section to load
        await this.page.waitForSelector('text=/Workflow templates/i', { timeout: 10000 });
        await this.page.waitForLoadState('networkidle');

        this.logger.info('Navigated to Logic section');
      },
      'Navigate to Logic section'
    );
  }

  /**
   * Deploy the current app changes
   */
  private async deployApp(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Deploying app changes');

        // Click the Deploy button
        const deployButton = this.page.locator('button:has-text("Deploy")').first();
        await deployButton.waitFor({ state: 'visible' });
        await deployButton.click();

        // Wait for the deploy modal to appear
        await this.page.waitForSelector('heading:has-text("Commit deployment")', { timeout: 5000 });

        // Fill the Change log field (required)
        const changeLogField = this.page.locator('textbox[aria-label*="Change log"], textarea[placeholder*="change"]').first();
        await changeLogField.waitFor({ state: 'visible' });
        await changeLogField.fill('E2E test: Disabled workflow provisioning');

        // Click the Deploy button in the modal
        const deployModalButton = this.page.locator('button:has-text("Deploy")').nth(1);
        await deployModalButton.click();

        // Wait for deployment to complete - look for success indicator
        await this.page.waitForSelector('text=/Deployed|deployment.*successful/i', { timeout: 60000 });

        this.logger.success('App deployed successfully');
      },
      'Deploy app'
    );
  }

  /**
   * Release the deployed app version
   */
  private async releaseApp(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Releasing app version');

        // Look for Release button
        const releaseButton = this.page.locator('button:has-text("Release")').first();
        await releaseButton.waitFor({ state: 'visible', timeout: 10000 });
        await releaseButton.click();

        // Wait for the release modal to appear
        await this.page.waitForSelector('heading:has-text("Commit release")', { timeout: 5000 });

        // Fill the Release notes field (required)
        const releaseNotesField = this.page.locator('textbox[aria-label*="Release notes"], textarea[placeholder*="release"]').first();
        await releaseNotesField.waitFor({ state: 'visible' });
        await releaseNotesField.fill('E2E test: Disabled workflow provisioning');

        // Click the Release button in the modal
        const releaseModalButton = this.page.locator('button:has-text("Release")').nth(1);
        await releaseModalButton.click();

        // Wait for release to complete
        await this.page.waitForSelector('text=/Released|release.*successful/i', { timeout: 60000 });

        this.logger.success('App released successfully');
      },
      'Release app'
    );
  }

  /**
   * Disable workflow provisioning for all workflow templates
   * This should be called before installing an app in E2E tests
   */
  async disableWorkflowProvisioning(appName: string): Promise<void> {
    this.logger.info('Starting to disable workflow provisioning for all templates');

    // Navigate to App Builder
    await this.navigateToAppBuilder(appName);

    // Navigate to Logic section
    await this.navigateToLogicSection();

    // Get all workflow rows from the Workflow templates table
    const workflowRows = this.page.locator('table tbody tr, [role="row"]').filter({
      has: this.page.locator('[role="gridcell"] a')
    });

    const workflowCount = await workflowRows.count();
    this.logger.info(`Found ${workflowCount} workflow template(s)`);

    if (workflowCount === 0) {
      this.logger.warn('No workflow templates found - skipping provisioning disable');
      return;
    }

    // Process each workflow
    for (let i = 0; i < workflowCount; i++) {
      // Re-query workflows each time since DOM changes after saves
      const currentWorkflowRows = this.page.locator('table tbody tr, [role="row"]').filter({
        has: this.page.locator('[role="gridcell"] a')
      });
      const row = currentWorkflowRows.nth(i);

      // Get workflow name for logging
      const workflowNameLink = row.locator('[role="gridcell"] a').first();
      const workflowName = await workflowNameLink.textContent() || `Workflow ${i + 1}`;
      this.logger.info(`Processing workflow: ${workflowName.trim()}`);

      await RetryHandler.withPlaywrightRetry(
        async () => {
          // Click the workflow name link
          await workflowNameLink.click();

          // Wait for workflow editor to load
          await this.page.waitForLoadState('networkidle');

          // Click "Edit" button to enter edit mode
          const editButton = this.page.locator('button:has-text("Edit")').first();
          await editButton.waitFor({ state: 'visible' });
          await editButton.click();

          // Click "Settings" button to open settings panel
          const settingsButton = this.page.locator('button:has-text("Settings")').first();
          await settingsButton.waitFor({ state: 'visible' });
          await settingsButton.click();

          // Wait for settings panel with the toggle
          const provisionToggle = this.page.locator('switch[aria-label*="Provision on install"]').first();
          await provisionToggle.waitFor({ state: 'visible' });

          // Check if toggle is currently ON
          const isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';

          if (isChecked) {
            this.logger.info(`Disabling provisioning for: ${workflowName.trim()}`);
            await provisionToggle.click();

            // Wait for toggle to update
            await this.page.waitForFunction(
              (toggle) => toggle.getAttribute('aria-checked') === 'false',
              provisionToggle
            );

            // Click "Save and exit" since we made a change
            const saveButton = this.page.locator('button:has-text("Save and exit")').first();
            await saveButton.waitFor({ state: 'visible' });
            await saveButton.click();

            // Wait for toast notification confirming save
            const toast = this.page.locator('text=/Workflow template updated/i');
            await toast.waitFor({ state: 'visible', timeout: 5000 });

            this.logger.success(`Successfully disabled provisioning for: ${workflowName.trim()}`);
          } else {
            this.logger.info(`Provisioning already disabled for: ${workflowName.trim()}`);

            // Close the settings panel without saving (click outside or close button)
            const closeButton = this.page.locator('button[aria-label*="Close"], button:has-text("Cancel")').first();
            if (await closeButton.isVisible({ timeout: 2000 })) {
              await closeButton.click();
            } else {
              // If no close button, press Escape key
              await this.page.keyboard.press('Escape');
            }
          }

          // Navigate back to Logic overview
          const logicBreadcrumb = this.page.locator('button:has-text("Logic")').first();
          if (await logicBreadcrumb.isVisible({ timeout: 2000 })) {
            await logicBreadcrumb.click();
            await this.page.waitForLoadState('networkidle');
          }
        },
        `Disable provisioning for workflow: ${workflowName.trim()}`
      );
    }

    this.logger.success(`Disabled provisioning for all ${workflowCount} workflow template(s)`);

    // Deploy and release the changes so they're available for installation
    await this.deployApp();
    await this.releaseApp();
  }

}

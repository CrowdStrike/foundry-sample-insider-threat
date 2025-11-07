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
   * Ensure we're on the Logic overview page (with workflow templates grid)
   * Uses direct navigation to the Logic URL to avoid dialog issues
   */
  private async ensureLogicOverview(): Promise<void> {
    const workflowTemplatesHeading = this.page.getByRole('heading', { name: 'Workflow templates' });
    const workflowGrid = this.page.getByRole('grid').first();

    // Check if we're already on the Logic overview page with grid loaded
    if (await workflowTemplatesHeading.isVisible({ timeout: 2000 })) {
      // Ensure the grid is also loaded and visible
      await workflowGrid.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      return;
    }

    // Navigate directly to Logic page URL - this is more reliable than clicking breadcrumbs
    const currentUrl = this.page.url();
    const logicUrl = currentUrl.replace(/\/draft\/.*$/, '/draft/logic');

    await this.page.goto(logicUrl);
    await this.page.waitForLoadState('networkidle');
    await workflowTemplatesHeading.waitFor({ state: 'visible', timeout: 10000 });
    await workflowGrid.waitFor({ state: 'visible', timeout: 10000 });
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

        const deployModalHeading = this.page.getByRole('heading', { name: 'Commit deployment' });

        // Check if the deploy modal is already open (from a previous attempt)
        const isModalOpen = await deployModalHeading.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isModalOpen) {
          // Click the Deploy button to open the modal
          const deployButton = this.page.locator('button:has-text("Deploy")').first();
          await deployButton.waitFor({ state: 'visible' });
          await deployButton.click();

          // Wait for the deploy modal to appear
          await deployModalHeading.waitFor({ state: 'visible', timeout: 10000 });
          await this.page.waitForLoadState('networkidle');
        }

        // Wait for modal content to be fully loaded
        const modal = this.page.locator('dialog, [role="dialog"]').filter({ hasText: 'Commit deployment' });
        await modal.waitFor({ state: 'attached', timeout: 10000 });

        // Fill the Change type field - find the input within the modal
        const changeTypeInput = modal.locator('input').first();
        await changeTypeInput.waitFor({ state: 'visible', timeout: 10000 });
        const changeTypeValue = await changeTypeInput.inputValue().catch(() => '');

        if (!changeTypeValue) {
          await changeTypeInput.click();
          // Wait for dropdown listbox to appear
          await this.page.locator('[role="listbox"], [role="menu"]').waitFor({ state: 'visible', timeout: 5000 });
          await this.page.keyboard.press('ArrowDown');
          await this.page.keyboard.press('Enter');
        }

        // Fill the Change log field
        const changeLogField = this.page.locator('textarea').last();
        await changeLogField.waitFor({ state: 'visible', timeout: 10000 });
        const changeLogValue = await changeLogField.inputValue().catch(() => '');

        if (!changeLogValue) {
          await changeLogField.fill('E2E test: Disabled workflow provisioning');
        }

        // Click the Deploy button in the modal
        const deployModalButton = this.page.getByRole('button', { name: 'Deploy' }).last();
        await deployModalButton.click();

        // Wait for deployment to complete - look for success indicator
        await this.page.waitForSelector('text=/Deployed|deployment.*successful/i', { timeout: 120000 });

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

    // Get all workflow rows from the Workflow templates grid
    // It's a table element with role="grid"
    const workflowRowsContainer = this.page.getByRole('grid').first();

    // Wait for the grid to be visible
    await workflowRowsContainer.waitFor({ state: 'visible', timeout: 10000 });

    const workflowRows = workflowRowsContainer.locator('tbody tr');

    const workflowCount = await workflowRows.count();
    this.logger.info(`Found ${workflowCount} workflow template(s)`);

    if (workflowCount === 0) {
      this.logger.warn('No workflow templates found - skipping provisioning disable');
      return;
    }

    // Track if any changes were successfully saved
    let changesSaved = false;

    // Process each workflow
    for (let i = 0; i < workflowCount; i++) {
      // Re-query workflows each time since DOM changes after saves
      const currentWorkflowRowsContainer = this.page.getByRole('grid').first();
      const currentWorkflowRows = currentWorkflowRowsContainer.locator('tbody tr');
      const row = currentWorkflowRows.nth(i);

      // Get workflow name for logging
      const workflowNameLink = row.locator('a[data-test-selector="workflow-name-link"]').first();
      const workflowName = await workflowNameLink.textContent() || `Workflow ${i + 1}`;
      this.logger.info(`Processing workflow: ${workflowName.trim()}`);

      try {
        await RetryHandler.withPlaywrightRetry(
          async () => {
            // Ensure we're at the Logic overview page before trying to click workflow link
            // This is critical for retry attempts - we might be inside the workflow editor
            await this.ensureLogicOverview();

            // Re-query the workflow link to avoid stale element
            // Get workflow links directly instead of trying to navigate via tbody tr
            const workflowLinks = this.page.locator('a[data-test-selector="workflow-name-link"]');
            const currentWorkflowNameLink = workflowLinks.nth(i);

            // Wait for the link to be actionable
            await currentWorkflowNameLink.waitFor({ state: 'visible', timeout: 10000 });

            // Click the workflow name link
            await currentWorkflowNameLink.click();

          // Wait for workflow editor to load
          await this.page.waitForLoadState('networkidle');

          // Check if Settings dialog is already open (auto-opens in view-only mode)
          const settingsDialog = this.page.locator('heading:has-text("Workflow template details")');
          const isSettingsOpen = await settingsDialog.isVisible({ timeout: 2000 }).catch(() => false);

          // Find the provision toggle using a more flexible selector that works with disabled state
          const provisionToggle = this.page.locator('[role="switch"][aria-label="Provision on install"]');

          let isChecked = false;

          if (isSettingsOpen) {
            // Settings is already open in view-only mode - check current state
            await provisionToggle.waitFor({ state: 'visible', timeout: 5000 });
            isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';

            if (!isChecked) {
              // Already disabled - close dialog and navigate back
              this.logger.info(`Provisioning already disabled for: ${workflowName.trim()}`);
              const closeButton = this.page.getByRole('button', { name: 'Close' });
              await closeButton.click();
              // Navigate back to Logic overview
              await this.ensureLogicOverview();
              return;
            }

            // Need to disable - close dialog first
            this.logger.info(`Disabling provisioning for: ${workflowName.trim()}`);
            const closeButton = this.page.getByRole('button', { name: 'Close' });
            await closeButton.click();
            await provisionToggle.waitFor({ state: 'hidden' });
          } else {
            // Settings not open - open it to check current state
            const settingsButton = this.page.getByRole('button', { name: 'Settings' });
            await settingsButton.waitFor({ state: 'visible' });
            await settingsButton.click();

            await provisionToggle.waitFor({ state: 'visible', timeout: 5000 });
            isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';

            if (!isChecked) {
              // Already disabled
              this.logger.info(`Provisioning already disabled for: ${workflowName.trim()}`);
              const closeButton = this.page.getByRole('button', { name: 'Close' });
              await closeButton.click();
              await this.ensureLogicOverview();
              return;
            }

            // Close settings to enter edit mode
            this.logger.info(`Disabling provisioning for: ${workflowName.trim()}`);
            const closeButton = this.page.getByRole('button', { name: 'Close' });
            await closeButton.click();
            await provisionToggle.waitFor({ state: 'hidden' });
          }

          // Now enter edit mode to actually toggle the switch
          const editButton = this.page.getByRole('button', { name: 'Edit', exact: true });
          await editButton.waitFor({ state: 'visible' });
          await editButton.click();

          // Wait for page to transition to edit mode
          await this.page.waitForLoadState('networkidle');

          // Click "Settings" button in edit mode
          const settingsButton = this.page.getByRole('button', { name: 'Settings' });
          await settingsButton.click();

          // Wait for the provision toggle to be visible and enabled
          await provisionToggle.waitFor({ state: 'visible' });

          // Click the toggle to disable provisioning
          await provisionToggle.click();

          // Wait for toggle to update to unchecked state
          await this.page.waitForSelector('[role="switch"][aria-label="Provision on install"][aria-checked="false"]', { timeout: 5000 });

          // Close the Settings dialog
          const closeButton = this.page.getByRole('button', { name: 'Close' });
          await closeButton.click();

          // Click "Save and exit" to save the changes
          const saveButton = this.page.getByRole('button', { name: 'Save and exit' });
          await saveButton.waitFor({ state: 'visible' });
          await saveButton.click();

          // Check if Issues panel appeared (indicates validation errors)
          const issuesPanel = this.page.locator('heading:has-text("Issues")');
          const hasIssues = await issuesPanel.isVisible({ timeout: 3000 }).catch(() => false);

          if (hasIssues) {
            // Extract error messages from the Issues panel
            const errorButtons = this.page.locator('button[type="button"]').filter({ hasText: /property.*contains unknown variable|error|invalid/i });
            const errorCount = await errorButtons.count();
            const errors: string[] = [];

            for (let j = 0; j < Math.min(errorCount, 10); j++) {
              const errorText = await errorButtons.nth(j).textContent();
              if (errorText) {
                errors.push(errorText.trim());
              }
            }

            const errorMessage = `Workflow "${workflowName.trim()}" has validation errors that prevent saving:\n${errors.map(e => `  - ${e}`).join('\n')}`;
            this.logger.error(errorMessage);

            throw new Error(errorMessage);
          }

          // Wait for toast notification confirming save
          const toast = this.page.locator('text=/Workflow template updated/i');
          await toast.waitFor({ state: 'visible', timeout: 10000 });

          this.logger.success(`Successfully disabled provisioning for: ${workflowName.trim()}`);

          // Navigate back to Logic overview using direct URL navigation
          await this.ensureLogicOverview();
        },
        `Disable provisioning for workflow: ${workflowName.trim()}`
      );
      } catch (error) {
        this.logger.warn(`Skipping workflow due to error: ${workflowName.trim()} - ${error.message}`);

        // Ensure we're back at Logic overview page before continuing to next workflow
        await this.ensureLogicOverview();
      }
    }

    this.logger.success(`Disabled provisioning for all ${workflowCount} workflow template(s)`);

    // Ensure we're on Logic overview page before deploying
    await this.ensureLogicOverview();

    // Deploy and release the changes so they're available for installation
    await this.deployApp();
    await this.releaseApp();
  }

}

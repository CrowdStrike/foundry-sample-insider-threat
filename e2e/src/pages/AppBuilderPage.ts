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
   * Check if the latest release notes indicate that workflow provisioning has already been disabled
   * Returns true if the release notes contain "E2E test: Disabled workflow provisioning"
   */
  private async hasWorkflowProvisioningAlreadyBeenDisabled(appName: string): Promise<boolean> {
    return await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Checking if workflow provisioning has already been disabled in latest release');

        // Navigate to App Catalog to check release notes
        await this.navigateToPath('/foundry/app-catalog', 'App Catalog');
        await this.page.waitForLoadState('networkidle');

        // Search for the app
        const searchBox = this.page.locator('input[type="search"], input[placeholder*="Search"]').first();
        await searchBox.waitFor({ state: 'visible', timeout: 10000 });
        await searchBox.fill(appName);
        await this.page.waitForLoadState('networkidle');

        // Click on the app link
        const appLink = this.page.locator(`a:has-text("${appName}")`).first();
        await appLink.waitFor({ state: 'visible', timeout: 10000 });
        await appLink.click();
        await this.page.waitForLoadState('networkidle');

        // Click on the "Releases" tab
        const releasesTab = this.page.getByRole('tab', { name: /Releases/i });
        await releasesTab.waitFor({ state: 'visible', timeout: 10000 });
        await releasesTab.click();
        await this.page.waitForLoadState('networkidle');

        // Get the first (latest) release notes
        // The release notes are in a table with columns: Version, Release notes, Released on
        const releaseNotesCell = this.page.locator('table tbody tr:first-child td:nth-child(2)').first();
        await releaseNotesCell.waitFor({ state: 'visible', timeout: 10000 });

        const releaseNotesText = await releaseNotesCell.textContent();
        const hasMarker = releaseNotesText?.includes('E2E test: Disabled workflow provisioning') || false;

        if (hasMarker) {
          this.logger.info('Latest release notes indicate workflow provisioning already disabled - skipping disable process');
        } else {
          this.logger.info('Latest release notes do not contain provisioning marker - will check and disable if needed');
        }

        return hasMarker;
      },
      'Check release notes for workflow provisioning marker'
    );
  }

  /**
   * Navigate to App Manager and open app details page
   * This method assumes we're starting from somewhere in Foundry
   */
  private async navigateToAppDetailsPage(appName: string): Promise<void> {
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

        // Click on the app name to go to app details page
        const appLink = this.page.locator(`a:has-text("${appName}")`).first();
        await appLink.waitFor({ state: 'visible' });
        await appLink.click();
        await this.page.waitForLoadState('networkidle');

        this.logger.info('Navigated to App details page');
      },
      'Navigate to App details page'
    );
  }

  /**
   * Deploy the current app changes from App Builder
   */
  private async deployAppFromBuilder(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Deploying app changes');

        // Check if we're on App Builder page or App Manager page
        const currentUrl = this.page.url();
        if (currentUrl.includes('/foundry/app-manager/')) {
          // Navigate to App Builder first
          const editAppLink = this.page.locator('a:has-text("Edit app")').first();
          await editAppLink.waitFor({ state: 'visible', timeout: 10000 });
          await editAppLink.click();
          await this.page.waitForURL(/.*\/foundry\/app-builder\/.*\/draft\/.*/, { timeout: 10000 });
          await this.page.waitForLoadState('networkidle');
        }

        const deployModalHeading = this.page.getByRole('heading', { name: 'Commit deployment' });

        // Check if the deploy modal is already open (from a previous attempt)
        const isModalOpen = await deployModalHeading.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isModalOpen) {
          // Navigate to draft overview by clicking "App builder" breadcrumb
          const appBuilderLink = this.page.locator('nav[aria-label="Breadcrumb"] a:has-text("App builder")').first();
          await appBuilderLink.waitFor({ state: 'visible', timeout: 10000 });
          await appBuilderLink.click();
          await this.page.waitForLoadState('networkidle');

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
        await modal.waitFor({ state: 'visible', timeout: 15000 });

        // The Change type field is a button, not an input
        const changeTypeButton = modal.getByRole('button', { name: 'Change type' });
        await changeTypeButton.waitFor({ state: 'visible', timeout: 15000 });

        // Click to open the dropdown
        await changeTypeButton.click();

        // Wait for dropdown listbox to appear
        await this.page.locator('[role="listbox"], [role="menu"]').waitFor({ state: 'visible', timeout: 5000 });

        // Select first option with keyboard
        await this.page.keyboard.press('ArrowDown');
        await this.page.keyboard.press('Enter');

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

        // Wait for the "Deployment in progress" screen to go away if present
        // The page may show a progress screen that auto-refreshes when done
        const progressScreen = this.page.locator('text="Deployment in progress"');
        const isProgressVisible = await progressScreen.isVisible().catch(() => false);
        if (isProgressVisible) {
          this.logger.info('Waiting for deployment progress screen to complete');
          await progressScreen.waitFor({ state: 'hidden', timeout: 60000 });
        }

        // Ensure we're back on the app builder overview page
        await this.page.waitForURL(/.*\/foundry\/app-builder\/.*\/draft\/.*/, { timeout: 30000 });
        await this.page.waitForLoadState('networkidle');

        this.logger.success('App deployed successfully');
      },
      'Deploy app'
    );
  }

  /**
   * Release the deployed app version from App Builder
   */
  private async releaseAppFromBuilder(): Promise<void> {
    await RetryHandler.withPlaywrightRetry(
      async () => {
        this.logger.info('Releasing app version');

        // Ensure we're on the overview page and wait for it to be ready
        await this.page.waitForLoadState('networkidle');
        this.logger.info('Page loaded and ready');

        // Scroll to the top of the page to ensure Release button is visible
        // The page sometimes auto-scrolls down, so we need to explicitly scroll to top
        await this.page.evaluate(() => window.scrollTo(0, 0));
        this.logger.info('Scrolled to top of page');

        // Wait for the success toast to be hidden before clicking Release
        // The toast blocks the Release button and prevents the modal from opening
        const successToast = this.page.locator('text="App deployed successfully"');
        const isToastVisible = await successToast.isVisible().catch(() => false);
        if (isToastVisible) {
          this.logger.info('Waiting for success toast to disappear');
          await successToast.waitFor({ state: 'hidden', timeout: 30000 });
          this.logger.info('Success toast disappeared');
        }

        // Look for Release button - it doesn't have a test-id, so use role with exact match
        // We need to be specific to avoid matching the "Released" status or version dropdown
        const releaseButton = this.page.getByRole('button', { name: 'Release', exact: true });
        await releaseButton.waitFor({ state: 'visible', timeout: 15000 });
        this.logger.info('Release button found');

        // Use JavaScript to click the button directly to ensure the event handler fires
        await releaseButton.evaluate((button: HTMLElement) => button.click());
        this.logger.info('Release button clicked via JavaScript');

        // Wait for the release modal to appear
        const releaseModalHeading = this.page.getByRole('heading', { name: 'Commit release' });
        await releaseModalHeading.waitFor({ state: 'visible', timeout: 15000 });
        this.logger.info('Release modal opened');

        // Wait for modal content to be fully loaded
        const modal = this.page.locator('dialog, [role="dialog"]').filter({ hasText: 'Commit release' });
        await modal.waitFor({ state: 'visible', timeout: 15000 });

        // The Change type field is a button, not an input
        const changeTypeButton = modal.getByRole('button', { name: 'Change type' });
        await changeTypeButton.waitFor({ state: 'visible', timeout: 15000 });
        this.logger.info('Change type button found');

        // Click to open the dropdown
        await changeTypeButton.click();
        this.logger.info('Change type dropdown opened');

        // Wait for dropdown listbox to appear
        const listbox = this.page.locator('[role="listbox"]');
        await listbox.waitFor({ state: 'visible', timeout: 5000 });

        // Use JavaScript keyboard events to select the first option
        // This is more reliable than Playwright's keyboard.press() or clicking for this component
        await this.page.evaluate(() => {
          const event1 = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true });
          document.activeElement?.dispatchEvent(event1);
        });

        await this.page.evaluate(() => {
          const event2 = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
          document.activeElement?.dispatchEvent(event2);
        });
        this.logger.info('Change type selected');

        // Fill the Release notes field (required)
        const releaseNotesField = this.page.getByRole('textbox', { name: 'Release notes' });
        await releaseNotesField.waitFor({ state: 'visible', timeout: 10000 });
        await releaseNotesField.fill('E2E test: Disabled workflow provisioning');
        this.logger.info('Release notes filled');

        // Click the Release button in the modal
        const releaseModalButton = this.page.getByRole('button', { name: 'Release' }).last();
        await releaseModalButton.click();
        this.logger.info('Release button in modal clicked - waiting for completion...');

        // Wait for release to complete - look for the success toast message
        // Two toasts appear: "Releasing deployment" (first) and "Deployment released successfully" (second)
        // Releases are fast (usually < 10 seconds), so 30 second timeout is appropriate
        await this.page.waitForSelector('text="Deployment released successfully"', { timeout: 30000 });

        //Wait for the release success toast to disappear and page to fully settle
        const releaseToast = this.page.locator('text="Deployment released successfully"');
        await releaseToast.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});

        // Ensure the page is fully settled after release
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForLoadState('domcontentloaded');

        this.logger.success('App released successfully');
      },
      'Release app'
    );
  }

  /**
   * Disable workflow provisioning for all workflow templates
   * Uses App Manager > App details > Logic table > 3-dot menu > Edit approach
   * This opens workflows directly in edit mode, avoiding view-only mode issues
   */
  async disableWorkflowProvisioning(appName: string): Promise<void> {
    this.logger.info('Starting to disable workflow provisioning for all templates');

    // Check if workflow provisioning has already been disabled in a previous release
    const alreadyDisabled = await this.hasWorkflowProvisioningAlreadyBeenDisabled(appName);
    if (alreadyDisabled) {
      this.logger.success('Workflow provisioning already disabled in previous release - skipping');
      return;
    }

    // Navigate to App details page in App Manager
    await this.navigateToAppDetailsPage(appName);

    // Find the Logic section on the app details page
    // The Logic heading is an h3 element
    const logicSectionHeading = this.page.getByRole('heading', { name: 'Logic', level: 3 });
    await logicSectionHeading.scrollIntoViewIfNeeded();
    await logicSectionHeading.waitFor({ state: 'visible', timeout: 10000 });

    // Get the Logic table grid (contains both workflows and functions)
    // The grid is a sibling of the Logic heading, wrapped in a parent container
    const logicGrid = logicSectionHeading.locator('../..').getByRole('grid').first();
    await logicGrid.waitFor({ state: 'visible', timeout: 10000 });

    // Find all workflow template rows by filtering for rows with "Workflow template" text
    const workflowRows = logicGrid.locator('tbody tr').filter({ hasText: 'Workflow template' });
    const workflowCount = await workflowRows.count();
    this.logger.info(`Found ${workflowCount} workflow template(s)`);

    if (workflowCount === 0) {
      this.logger.warn('No workflow templates found - skipping provisioning disable');
      return;
    }

    // Track processed workflows by name to avoid duplicates
    const processedWorkflows = new Set<string>();
    // Track whether any workflows actually needed changes
    let changesMade = false;

    // Process each workflow
    for (let i = 0; i < workflowCount; i++) {
      // Process workflow without try-catch - any failure should fail the test
      await RetryHandler.withPlaywrightRetry(
        async () => {
          // Ensure we're on the app details page
          if (!this.page.url().includes('/foundry/app-manager/')) {
            await this.navigateToAppDetailsPage(appName);
          }

          // Re-query the Logic section heading (avoid stale reference after navigation)
          const currentLogicHeading = this.page.getByRole('heading', { name: 'Logic', level: 3 });
          await currentLogicHeading.scrollIntoViewIfNeeded();
          await currentLogicHeading.waitFor({ state: 'visible', timeout: 10000 });

          // Re-query the workflow row
          const currentLogicGrid = currentLogicHeading.locator('../..').getByRole('grid').first();
          const currentWorkflowRows = currentLogicGrid.locator('tbody tr').filter({ hasText: 'Workflow template' });
          const currentRow = currentWorkflowRows.nth(i);

          // Get workflow name from the link
          const workflowLink = currentRow.locator('a').first();
          const workflowName = await workflowLink.textContent() || `Workflow ${i + 1}`;
          const trimmedName = workflowName.trim();

          // Skip if we've already processed this workflow
          if (processedWorkflows.has(trimmedName)) {
            this.logger.info(`Skipping already processed workflow: ${trimmedName}`);
            return;
          }

          this.logger.info(`Processing workflow: ${trimmedName}`);
          processedWorkflows.add(trimmedName);

            // Click the 3-dot menu button
            const menuButton = currentRow.getByLabel('Open menu');
            await menuButton.waitFor({ state: 'visible', timeout: 10000 });
            await menuButton.click();

            // Click the "Edit" menu item
            const editMenuItem = this.page.getByRole('menuitem', { name: 'Edit' });
            await editMenuItem.waitFor({ state: 'visible', timeout: 5000 });
            await editMenuItem.click();

            // Wait for workflow editor to load in edit mode
            // The URL should change to /app-builder/.../automation/workflows/.../edit
            await this.page.waitForURL(/.*\/app-builder\/.*\/automation\/workflows\/.*\/edit/, { timeout: 15000 });
            await this.page.waitForLoadState('networkidle');

            // Wait for workflow canvas to be fully rendered
            // This ensures the complex workflow graph visualization has loaded
            const workflowCanvas = this.page.getByRole('heading', { name: /Graphical representation area/ });
            await workflowCanvas.waitFor({ state: 'attached', timeout: 15000 });

            // Wait for Settings button to be visible and clickable
            const settingsButton = this.page.getByRole('button', { name: 'Settings' });
            await settingsButton.waitFor({ state: 'visible', timeout: 15000 });

            // Click Settings to open the dialog
            await settingsButton.click();

            // Wait for the Settings dialog to appear
            const settingsDialog = this.page.getByRole('heading', { name: 'Workflow template details' });
            await settingsDialog.waitFor({ state: 'visible', timeout: 15000 });

            // Find the provision toggle
            const provisionToggle = this.page.locator('[role="switch"][aria-label="Provision on install"]');
            await provisionToggle.waitFor({ state: 'visible', timeout: 10000 });

            // Wait for the dialog content to fully load and settle
            await this.page.waitForLoadState('networkidle');

            // Wait for the toggle state to stabilize by checking multiple times
            // The dialog may open with a default state before loading the actual saved value
            let isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';
            let stableCheckCount = 0;
            let previousState = isChecked;

            // Check up to 5 times with 500ms between checks to detect if state changes
            for (let attempt = 0; attempt < 5; attempt++) {
              await this.waiter.delay(500);
              isChecked = await provisionToggle.getAttribute('aria-checked') === 'true';

              if (isChecked === previousState) {
                stableCheckCount++;
                // If state is stable for 2 consecutive checks, we're confident it's the real value
                if (stableCheckCount >= 2) {
                  break;
                }
              } else {
                // State changed, reset counter
                this.logger.info(`Toggle state changed from ${previousState} to ${isChecked}, waiting for stability`);
                stableCheckCount = 0;
                previousState = isChecked;
              }
            }

            this.logger.info(`Final toggle state: aria-checked="${isChecked}" for workflow: ${trimmedName}`);

            if (!isChecked) {
              // Already disabled
              this.logger.info(`Provisioning already disabled for: ${workflowName.trim()}`);
              // Close the Settings dialog - scope to dialog to avoid ambiguity
              const dialog = this.page.getByRole('dialog');
              const closeButton = dialog.getByRole('button', { name: 'Close' });
              await closeButton.click();
              return;
            }

            // Click the toggle to disable provisioning
            this.logger.info(`Disabling provisioning for: ${workflowName.trim()}`);
            await provisionToggle.click();
            changesMade = true;

            // Wait for toggle to update to unchecked state
            await this.page.waitForSelector('[role="switch"][aria-label="Provision on install"][aria-checked="false"]', { timeout: 5000 });

            // Close the Settings dialog - scope to dialog to avoid ambiguity
            const dialog = this.page.getByRole('dialog');
            const closeButton = dialog.getByRole('button', { name: 'Close' });
            await closeButton.click();

            // Click "Save and exit" to save the changes
            const saveButton = this.page.getByRole('button', { name: 'Save and exit' });
            await saveButton.waitFor({ state: 'visible' });
            await saveButton.click();

            // Wait for EITHER success toast OR Issues panel to appear
            // Use Promise.race to check which appears first
            const result = await Promise.race([
              this.page.locator('text=/Workflow template updated/i').waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
              this.page.locator('text="Issues"').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'errors')
            ]).catch(() => 'timeout');

            if (result === 'errors') {
              // Extract error messages from the Issues panel
              // Look for elements containing property validation errors
              const errorItems = this.page.locator('text=/property.*contains/i');
              const errorCount = await errorItems.count();
              const errors: string[] = [];

              for (let j = 0; j < errorCount; j++) {
                const errorText = await errorItems.nth(j).textContent();
                if (errorText) {
                  // Clean up the error text by removing excessive whitespace and newlines
                  const cleanedError = errorText.trim().replace(/\s+/g, ' ');
                  // Only include if it starts with "property" to avoid extra UI text
                  if (cleanedError.toLowerCase().startsWith('property') && !errors.includes(cleanedError)) {
                    errors.push(cleanedError);
                  }
                }
              }

              // If no property errors found, look for any error indicators
              if (errors.length === 0) {
                const fallbackErrors = this.page.locator('text=/contains unknown variable|invalid|failed/i');
                const fallbackCount = await fallbackErrors.count();
                for (let j = 0; j < Math.min(fallbackCount, 5); j++) {
                  const errorText = await fallbackErrors.nth(j).textContent();
                  if (errorText) {
                    const cleanedError = errorText.trim().replace(/\s+/g, ' ');
                    if (cleanedError && !errors.includes(cleanedError)) {
                      errors.push(cleanedError);
                    }
                  }
                }
              }

              const errorMessage = `Workflow "${workflowName.trim()}" has validation errors that prevent saving:\n${errors.map(e => `  - ${e}`).join('\n')}`;
              this.logger.error(errorMessage);

              throw new Error(errorMessage);
            } else if (result === 'timeout') {
              throw new Error(`Timeout waiting for save confirmation or error panel for workflow "${trimmedName}"`);
            }

            // Success! The workflow was saved
            this.logger.success(`Successfully disabled provisioning for: ${trimmedName}`);

            // Wait for the page to settle after save
            await this.page.waitForLoadState('networkidle');

            // Navigate back to App Details page for next workflow
            await this.navigateToAppDetailsPage(appName);
          },
          `Disable provisioning for workflow ${i + 1}`
        );
    }

    this.logger.success(`Disabled provisioning for ${processedWorkflows.size} unique workflow template(s)`);

    // Deploy and release only if changes were actually made
    if (changesMade) {
      this.logger.info('Changes were made - deploying and releasing app');
      await this.deployAppFromBuilder();
      await this.releaseAppFromBuilder();
    } else {
      this.logger.info('No changes needed - provisioning already disabled for all workflows');
    }
  }

}

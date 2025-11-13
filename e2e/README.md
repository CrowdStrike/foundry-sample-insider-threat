# E2E Tests

End-to-end tests for the Insider Threat Foundry app using Playwright.

## Tests Included

- **Workflow Verification**: Verifies that the app's workflows are deployed and accessible in Fusion SOAR

## About This App

This app monitors employees leaving an organization who may pose a high risk of insider threat. It integrates with Workday to sync employee data and includes workflows for managing watchlists and AD groups. The E2E tests verify that both workflows are properly deployed and discoverable.

## Setup

```bash
npm ci
npx playwright install chromium
cp .env.sample .env
# Edit .env with your credentials
```

## Run Tests

```bash
npm test              # All tests
npm run test:debug    # Debug mode
npm run test:ui       # Interactive UI
```

## Environment Variables

```env
APP_NAME=foundry-sample-insider-threat
FALCON_BASE_URL=https://falcon.us-2.crowdstrike.com
FALCON_USERNAME=your-username
FALCON_PASSWORD=your-password
FALCON_AUTH_SECRET=your-mfa-secret
```

**Important:** The `APP_NAME` must exactly match the app name as deployed in Falcon.

## Test Flow

1. **Setup**: Authenticates and installs the app
2. **Workflow Verification**:
   - Searches for both workflows
   - Verifies both workflows are discoverable in Fusion SOAR
3. **Teardown**: Uninstalls the app

## CI/CD

Tests run automatically in GitHub Actions on push/PR to main. The workflow deploys the app, runs tests, and cleans up.

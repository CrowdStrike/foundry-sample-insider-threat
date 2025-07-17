# Foundry Sample Insider Threat

Organizations face critical security challenges when employees leave and have elevated access to sensitive data. 
The sample Foundry Insider Threat helps automate the process of monitoring leaving employees.
This application helps teams:

* Monitor high-risk individuals who may pose insider threats.
* Automatically track employees during their departure process.
* Enhance protection of sensitive data during critical transition periods.
* Maintain security oversight for users with privileged access.

This app illustrates the following functionality amongst other components:
* Fetch Leaving/departing employees data from [Workday](https://www.workday.com/).
* Add employees to Identity Protection watchlist and AD group using Workflow built-in actions for enhanced monitoring capabilities.
* Remove employees from Identity Protection watchlist and AD group using Workflow built-in actions after 30 days of their departure date.

## Foundry capabilities used

* **API-Integration** Used to connect to Workday API to get leaving employee data.
* **Function** To fetch employee linked accounts. If a departing user is an admin, they have a regular account with email and an administrative account without the email.
* **Saved-Search** Query departing employees data
* **Workflow templates** Workflow to execute API-Integrations to get leaving employees data from Workday and add/remove employees to/from Identity Protection watchlist.

## Install App Configuration

When you install this app, you will be prompted for app configuration. Your configuration should look similar to the following.
* (API-Integration) Workday generate access token configuration:
   * **Workday host**: Your Workday host name with protocol (https/http)
   * **ClientId** Your Workday API client Id
   * **ClientSecret** Your Workday API client secret

Example:
<p><img width="500px" src="/docs/asset/workday-creds.png?raw=true">

* (Workflow) 'Add leavers to watchlist and AD group' & 'Remove leavers from watchlist and AD group' configuration:
   * **Workday Tenant Id**: Your Workday tenant id
   * **Refresh Token**: Your API client refresh token
   * **Target Group**: Active directory group name

Example:
<p><img width="500px" src="/docs/asset/workflow-config.png?raw=true">

## Usage

After installing the app, go to **Fusion SOAR** > **Workflows** to see the workflows for Insider Threat. 

The source code for this app can be found on GitHub: <https://github.com/CrowdStrike/foundry-sample-insider-threat>. 
## Description

Organizations face critical security challenges when employees leave and have elevated access to sensitive data. 
The sample Foundry Insider Threat helps automate the process of monitoring leaving employees.
This application helps teams:

* Monitor high-risk individuals who may pose insider threats.
* Automatically track employees during their departure process.
* Enhance protection of sensitive data during critical transition periods.
* Maintain security oversight for users with privileged access.

This app illustrates the following functionality amongst other components:
* Fetch Leaving/departing employees data from [Workday](https://www.workday.com/).
* Add employees to Identity Protection watchlist using Workflow built-in actions for enhanced monitoring capabilities.
* Remove employees from Identity Protection watchlist using Workflow built-in actions after 30 days of their departure date.

### Foundry capabilities used

* **API-Integration.** Used to connect to Workday API to get leaving employee data.
* **Workflow templates.** Workflow to execute API-Integrations to get leaving employees data from Workday and add/remove employees to/from Identity Protection watchlist.
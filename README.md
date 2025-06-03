![CrowdStrike Falcon](/docs/asset/cs-logo.png?raw=true)

# Insider Threat sample Foundry app

The Insider Threat sample Foundry app is a community-driven, open source project which serves as an example of an app which can be built using CrowdStrike's Foundry ecosystem.
`foundry-sample-insider-threat` is an open source project, not a CrowdStrike product. As such, it carries no formal support, expressed or implied.

This app is one of several App Templates included in Foundry that you can use to jumpstart your development. It comes complete with a set of
preconfigured capabilities aligned to its business purpose. Deploy this app from the Templates page with a single click in the Foundry UI, or
create an app from this template using the CLI.

> [!IMPORTANT]  
> To view documentation and deploy this sample app, you need access to the Falcon console.

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


## Prerequisites

* The Foundry CLI (instructions below)
* Workday Configuration
* Update API-Integration and Workflow artifacts

### Install the Foundry CLI

You can install the Foundry CLI with Scoop on Windows or Homebrew on Linux/macOS.

**Windows**:

Install [Scoop](https://scoop.sh/). Then, add the Foundry CLI bucket and install the Foundry CLI.

```shell
scoop bucket add foundry https://github.com/crowdstrike/scoop-foundry-cli.git
scoop install foundry
```

Or, you can download the [latest Windows zip file](https://assets.foundry.crowdstrike.com/cli/latest/foundry_Windows_x86_64.zip), expand it, and add the install directory to your PATH environment variable.

**Linux and macOS**:

Install [Homebrew](https://docs.brew.sh/Installation). Then, add the Foundry CLI repository to the list of formulae that Homebrew uses and install the CLI:

```shell
brew tap crowdstrike/foundry-cli
brew install crowdstrike/foundry-cli/foundry
```

Run `foundry version` to verify it's installed correctly.

### Workday Configuration
* Create and configure API Client:
  * Register a new `API Client for integrations`
  * Enable `Non-Expiring Refresh Tokens` option
  * Securely store the generated `Client ID` and `Client Secret`
* Set up required user and security:
  * Create an Integration System User (ISU)
  * Create a `Security Group` with type `Integration System Security Group`
  * Generate a `Refresh Token` for the API Client using the created ISU

## Getting Started

Clone this sample to your local system, or [download as a zip file](https://github.com/CrowdStrike/foundry-sample-insider-threat/archive/refs/heads/main.zip).

```shell
git clone https://github.com/CrowdStrike/foundry-sample-insider-threat
cd foundry-sample-insider-threat
```

Log in to Foundry:

```shell
foundry login
```

Select the following permissions:

- [ ] Create and run RTR scripts
- [x] Create, execute and test workflow templates
- [x] Create, run and view API integrations
- [ ] Create, edit, delete, and list queries

Deploy the app:

```shell
foundry apps deploy
```

> [!TIP]
> If you get an error that the name already exists, change the name to something unique to your CID in `manifest.yml`.

Once the deployment has finished, you can update the app with your Workday configuration:

### App Configuration
* Configure Workday API Integrations:
  * In `Workday_Generate_Access_Token`:
    * Update `Host` with your Workday hostname
    * Modify `Path` in `Generate_Access_Token` operation: `/ccx/oauth2/{your-tenant-id}/token`
  * In `Workday_Get_Leavers`:
    * Update `Host` with your Workday hostname
    * Modify `Path` in `Get_Leavers` operation: `/api/wql/v1/{your-tenant-id}/data`
* Update Workflow Configurations:
  * In both `Add_Leavers_to_Identity_Protection_Watchlist` and `Remove_Leavers_From_Identity_Protection_Watchist`:
    * Locate the `Workday_Generate_Access_Token` action
    * Update the `Refresh token` field with your Workday refresh token

Re-deploy the app:

```shell
foundry apps deploy
```

Once the deployment has finished, you can release the app:

```shell
foundry apps release
```

Next, go to **Foundry** > **App catalog**, find your app, and install it. Select the **Open App** button in the success dialog.

> [!TIP]
> If the app doesn't load, reload the page.

You should be able to create a job and save it.

## About this sample app

### Foundry capabilities used

* **API-Integration.** Used to connect to Workday API to get leaving employee data.
* **Workflow templates.** Workflow to execute API-Integrations to get leaving employees data from Workday and add/remove employees to/from Identity Protection watchlist.


### Directory structure

* [`api-integrations`](api-integrations). API-Integrations used to call Workday APIs.
  * [`Workday_Generate_Token.json`](api-integrations/Workday_Generate_Token.json):  API-Integration to generate `access_token` using pre-generated Workday `API Client for Integrations` that uses `clientId`, `clientSecret` & `refresh_token`.
  * [`Workday_Get_Leavers.json`](api-integrations/Workday_Get_Leavers.json): API-Integration to get leaving employees data from Workday using WQL.
* [`workflows`](workflows): Workflow template definitions. Fusion workflows are created from the templates in this directory.
    * [`Add_Leavers_to_Identity_Protection_Watchlist.yml`](workflows/Add_Leavers_to_Identity_Protection_Watchlist.yml)[Add_Leavers_to_Identity_Protection_Watchlist.yml]`: This makes a call to Workday APIs to get leaving employees data and add employees to Identity Protection watchlist using built-in actions.
    * [`Remove_Leavers_From_Identity_Protection_Watchist.yml`](workflows/Remove_Leavers_From_Identity_Protection_Watchist.yml)`: This makes a call to Workday APIs to get employees data who left 30 days ago and removes from Identity Protection watchlist using built-in actions.

> [!NOTE]
> * The workflow `Add_Leavers_to_Identity_Protection_Watchlist` runs daily and processes both:
>   * Newly identified employees who have given notice of future departure.
>   * Previously identified employees whose departure dates are still in the future.
>   
>   The workflow will continue to add/maintain these employees on the Identity Protection watchlist until their actual departure date. This ensures monitoring of all employees who have given notice but haven't yet left the company.
> * The workflow `Remove_Leavers_From_Identity_Protection_Watchist.yml` automatically removes employees from the watchlist 30 days after their departure date. This automation helps maintain a clean and up-to-date watchlist by removing outdated entries.

## Foundry resources

- Foundry documentation: [US-1](https://falcon.crowdstrike.com/documentation/category/c3d64B8e/falcon-foundry) | [US-2](https://falcon.us-2.crowdstrike.com/documentation/category/c3d64B8e/falcon-foundry) | [EU](https://falcon.eu-1.crowdstrike.com/documentation/category/c3d64B8e/falcon-foundry)
- Foundry learning resources: [US-1](https://falcon.crowdstrike.com/foundry/learn) | [US-2](https://falcon.us-2.crowdstrike.com/foundry/learn) | [EU](https://falcon.eu-1.crowdstrike.com/foundry/learn)

---

<p align="center"><img src="https://raw.githubusercontent.com/CrowdStrike/falconpy/main/docs/asset/cs-logo-footer.png"><BR/><img width="300px" src="https://raw.githubusercontent.com/CrowdStrike/falconpy/main/docs/asset/adversary-goblin-panda.png"></P>
<h3><p align="center">WE STOP BREACHES</p></h3>
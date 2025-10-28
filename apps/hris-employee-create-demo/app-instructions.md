# HRIS Employee Create Demo overview

## Demo goal

Showcase the capabilities of using StackOne's Platform and Unified APIs to enable employee creation in various 3rd party HRIS APIs (UKG Pro, Workday, ADP, SAP).

## Example use case in mind

A prospect's software allows users to complete new hire paperwork in their onboarding tool. The employee information subsequently needs to be sent to an HRIS system to enable payroll automations etc. The complexity here comes from customer defined integration fields which vary from customer to customer, so mappings are necessary on a per-customer basis.

## End to end flow

### 1. Mock user login

```
{ 
    "username": 'demo-user',
    "password": "demo"
}
```

### 2. Integrations page - show activatable integrations - UKG Pro, Workday, ADP, SAP, Hibob, Personio. Store local JSON file for available integrations, pull metadata from StackOne:

ukgpro, workday, adpworkforcenow, sapsuccessfactors, hibob, personio

### 3. Auth connect for each integration
--- Store integration data in a JSON file. Store account ID created in StackOne along with provider key

### 4. Actions page
--- This page shows a list of actions. We'll only show 1 action for now, "Create employee".

--- When a user clicks on "Create employee", the app will show a new interface, which itself is a choice of two ways to create an employee (the user can toggle between): Unified (default), Custom.

--- In the Unified interface, the app will use the Get Connector Metadata endpoint (https://docs.stackone.com/platform/api-reference/connectors/get-connector-meta-information) and the List Employee Custom Fields endpoint (https://docs.stackone.com/hris/api-reference/custom-field-definitions/list-employee-custom-field-definitions) in order to render a user interface showing all the fields they can write to on an employee. Required fields need to show first. Fields with object structures need to show correctly nested, for instance address line items. Optional fields should be shown at the bottom of the form, under a toggle, and hidden by default.

---- When a user submits the form, keep the answers up, execute the call using the Create Employee endpoint (https://docs.stackone.com/hris/api-reference/employees/create-employee) and show the feedback to the user (success/ failure with reason).

--- In the Custom interface, in addition to calling the Get Connector Metadata endpoint (https://docs.stackone.com/platform/api-reference/connectors/get-connector-meta-information) to discover which fields we've marked as required, the app will use the Proxy endpoint (https://docs.stackone.com/platform/api-reference/proxy/proxy-request) using the url to fetch the metadata for the specific provider. It will then use the mapping function defined for the provider to transform the result into a standardised JSON schema which the app will then use to render the form.

---- I've included an example response from the Get Connector Metadata endpoint in the get_connector_metadata_response.json file.

---- When a user submits the form, keep the answers up, execute the call using the Proxy endpoint, using the path defined in the employee_creation.json schema for the provider, and show the feedback to the user (success/ failure with reason).

--- Only show the Custom interface if we've defined a custom schema transformation. For instance, for Personio and Hibob this isn't the case.

--- An override should be applied to determining required fields: email, first name and last name are always required.

--- If the call fails, notify the user and let them update the form. If success, show the created employee name and email.

### 5. Logs page
--- This page shows the logs history for this user. Use the List Step Logs endpoint (https://docs.stackone.com/platform/api-reference/request-logs/list-step-logs) and filter for account IDs belonging to the user to show a history of logs, paginated with up to 25 results per page.

### Notes

A .env.local file contains environment variables, including the StackOne API key under the variable name "STACKONE_API_KEY".

Build the app in Next JS React, with Typescript.

You can copy the styling of the app in react-nextjs-knowledge-agent, however you should use the StackOne Typescript SDK where possible to invoke the StackOne API (https://www.npmjs.com/package/@stackone/stackone-client-ts).
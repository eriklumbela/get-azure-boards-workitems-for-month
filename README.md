**NOTE**: this is a very rough script and may need to be adapted to your specific needs. It's meant to be a starting point to discover what's possible with the Azure DevOps REST API.

# Get azure boards work items

**This script fetches work items assigned to a user in sprints for a specific month in Azure DevOps.**

It retrieves the work items, their details, and the parent work item title if they have a parent.
It then sorts the work items by the date they entered the "In Progress" state.

## Prerequisites: 
- `Node.js` installed on your machine.
- Install dependencies using `npm install`.

## How to run:
1. Replace the placeholders in the `app.js` script with your Azure DevOps organization, project, team, email, and Personal Access Token.
2. In `app.js` set the `targetMonth` variable to desired month
3. Run the script using `node app.js`. or `npm start`
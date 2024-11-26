/* 
  **NOTE**: this is a very rough script and may need to be adapted to your specific needs. It's meant to be a starting point to discover what's possible with the Azure DevOps REST API.

  # This script fetches work items assigned to a user in sprints for a specific month in Azure DevOps.
  It retrieves the work items, their details, and the parent work item title if they have a parent.
  It then sorts the work items by the date they entered the "In Progress" state.

  **Prerequisites**: 
  - `Node.js` installed on your machine.
  - Install dependencies using `npm install`.
  - Replace the placeholders in the script with your Azure DevOps organization, project, team, email, and Personal Access Token.

  **How to run**:
  - Run the script using `node app.js`. or `npm start`
*/



const axios = require('axios');

// Set up Azure DevOps parameters
const organization = 'REPLACE_WITH_ORG';                        // Replace with your organization
const project = 'REPLACE_WITH_PROJECT';                         // Replace with your project
const team = 'REPLACE_WITH_TEAM';                               // Replace with your team name
const userEmail = 'REPLACE_WITH_EMAIL';                         // Replace with your email
const pat = 'REPLACE_WITH_PERSONAL_ACCESS_TOKEN';               // Replace with your Personal Access Token
const base64PAT = Buffer.from(`:${pat}`).toString('base64');

// Desired year and month for sprint
const targetMonth = '2024-11';

async function getSprintsForMonth() {
  try {
      // Get the sprints for the team
      const sprintsUrl = `https://dev.azure.com/${organization}/${project}/${team}/_apis/work/teamsettings/iterations?api-version=7.0`;
      const sprintsResponse = await axios.get(sprintsUrl, {
          headers: {
              'Authorization': `Basic ${base64PAT}`
          }
      });

      // Filter sprints by the target month
      const sprints = sprintsResponse.data.value.filter(sprint => {
          const sprintStartDate = new Date(sprint.attributes.startDate);
          const sprintEndDate = new Date(sprint.attributes.finishDate);
          return (
              sprintStartDate.getFullYear() === parseInt(targetMonth.split('-')[0]) &&
              (sprintStartDate.getMonth() + 1) === parseInt(targetMonth.split('-')[1])
          );
      });

      return sprints;
  } catch (error) {
      console.error('Error fetching sprints:', error);
      return [];
  }
}

async function getWorkItemsInSprint(iterationPath) {
  try {
      // WIQL query for work items in a sprint assigned to you
      const query = {
          query: `
              SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.CreatedDate], [System.ChangedDate]
              FROM workitems
              WHERE [System.IterationPath] = '${iterationPath}'
                AND [System.AssignedTo] = '${userEmail}'
          `
      };

      const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql?api-version=7.0`;
      const response = await axios.post(url, query, {
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${base64PAT}`
          }
      });

      return response.data.workItems;
  } catch (error) {
      console.error('Error fetching work items in sprint:', error);
      return [];
  }
}

async function getWorkItemDetails(workItemId) {
  const url = `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.0`;

  const response = await axios.get(url, {
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64PAT}`
      }
  });

  const workItem = response.data;
  const updatesUrl = `https://dev.azure.com/${organization}/_apis/wit/workitems/${workItemId}/updates?api-version=7.0`;

  const updatesResponse = await axios.get(updatesUrl, {
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64PAT}`
      }
  });

  const updates = updatesResponse.data.value;
  let inProgressDate = null;
  let latestStatusDate = null;
  let latestState = null;

  // Loop through the updates to find when the status changed to "In Progress" and the latest state
  updates.forEach(update => {
      if (update.fields && update.fields['System.State']) {
          const stateChange = update.fields['System.State'];

          // Check if the state changed to "In Progress"
          if (stateChange.newValue === "In Progress" && !inProgressDate) {
              inProgressDate = update.revisedDate;
          }

          // Track the latest state and date
          latestState = stateChange.newValue;
          latestStatusDate = update.revisedDate;
      }
  });

  // Check if this work item has a parent
  let parentId = null;
  if (workItem.relations) {
      const parentRelation = workItem.relations.find(rel => rel.rel === 'System.LinkTypes.Hierarchy-Reverse');
      if (parentRelation) {
          parentId = parentRelation.url.split('/').pop();
      }
  }

  return {
      id: workItemId,
      title: workItem.fields['System.Title'],
      inProgressDate,
      latestState,
      latestStatusDate,
      parentId
  };
}

async function getParentTitle(parentId) {
  if (!parentId) return null;

  const url = `https://dev.azure.com/${organization}/_apis/wit/workitems/${parentId}?api-version=7.0`;

  const response = await axios.get(url, {
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64PAT}`
      }
  });

  return response.data.fields['System.Title'];
}

async function fetchDataForMonth() {
  const sprints = await getSprintsForMonth();
  const workItemsWithDetails = [];

  for (const sprint of sprints) {
      const iterationPath = sprint.path;

      console.log(`Sprint: ${sprint.name} (Start: ${sprint.attributes.startDate}, End: ${sprint.attributes.finishDate})`);

      const workItems = await getWorkItemsInSprint(iterationPath);

      for (const workItem of workItems) {
          const details = await getWorkItemDetails(workItem.id);
          const parentTitle = details.parentId ? await getParentTitle(details.parentId) : null;

          // Add parent title to the details object
          details.parentTitle = parentTitle;

          // Add the detailed work item to the array
          workItemsWithDetails.push(details);
      }
  }

  // Sort the work items by inProgressDate
  workItemsWithDetails.sort((a, b) => {
      const dateA = new Date(a.inProgressDate);
      const dateB = new Date(b.inProgressDate);
      return dateA - dateB; // Ascending order
  });

  // Display sorted work items
  workItemsWithDetails.forEach(details => {
      console.log(`- Work Item ID: ${details.id}`);
      console.log(`  Title: "${details.title}"`);
      console.log(`  In Progress Date: ${details.inProgressDate}`);
      console.log(`  Latest Status: "${details.latestState}"`);
      console.log(`  Latest Status Change Date: ${details.latestStatusDate}`);
      if (details.parentTitle) {
          console.log(`  Parent Title: "${details.parentTitle}"`);
      }
      console.log('\n');
  });
}

fetchDataForMonth();
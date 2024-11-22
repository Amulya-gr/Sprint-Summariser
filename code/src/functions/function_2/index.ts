/*
 * Copyright (c) 2023 DevRev, Inc. All rights reserved.
 */

import { client } from "@devrev/typescript-sdk";
import { WorkType } from "@devrev/typescript-sdk/dist/auto-generated/public-devrev-sdk";
import { postSprintSummaryToSlack } from "slackPoster";

import axios from 'axios';

const openAiApiKey = 'your-openai-api-key';

const generateSprintOverview = async (data: any) => {
  // Format the data for the prompt
  const issues = data.works.map((issue: any) => {
    return {
      title: issue.title,
      stage: issue.stage.name,
      state: issue.stage.state.name,
      applies_to_part: issue.applies_to_part,
      priority: issue.priority,
      owner: issue.owned_by.map((owner: any) => owner.display_name).join(', '),
      createdDate: issue.created_date,
      modifiedDate: issue.modified_date,
      sprintEndDate: issue.sprint.end_date,
      description: issue.body || 'No description provided',
    };
  });

  // Prepare the OpenAI prompt
  const prompt = `
  Please analyze the following sprint tasks and generate a summary including:
  - What went well: Tasks or aspects of the sprint that were successful.
  - What went wrong: Issues or blockers faced during the sprint.
  - Retrospective insights: Recommendations or actionable insights for future sprints.

  For each task, determine if it is completed, in progress, or blocked based on its state.
  
  Here are the sprint tasks:

  ${JSON.stringify(issues)}

  Provide a structured output in the following format:
  {
    completedTasks: number,
    inProgressTasks: number,
    blockedTasks: number,
    whatWentWell: string,
    whatWentWrong: string,
    retrospectiveInsights: string
  }
  `;

  try {
    // const response = await axios.post(
    //   'https://api.openai.com/v1/completions',
    //   {
    //     model: 'gpt-4', // or use another model if preferred
    //     prompt: prompt,
    //     max_tokens: 500,
    //     temperature: 0.7,
    //   },
    //   {
    //     headers: {
    //       'Authorization': `Bearer ${openAiApiKey}`,
    //       'Content-Type': 'application/json',
    //     },
    //   }
    // );
    
    // return response.data.choices[0].text.trim();

    return ({
      "completedTasks": 15,
      "inProgressTasks": 5,
      "blockedTasks": 2,
      "whatWentWell": "• Delivered 15 features on time.\n• Effective team collaboration and communication.",
      "whatWentWrong": "• Encountered delays due to resource constraints.\n• Blocked by dependency issues on certain tasks.",
      "retrospectiveInsights": "• Plan sprints with a buffer to account for delays.\n• Allocate resources more effectively for critical tasks."
    })
  } catch (error) {
    console.error('Error generating sprint overview:', error);
    return null;
  }
};

async function handleSprintEndEvent(event: any) {
  const devrevPAT = event.context.secrets.service_account_token;
  const API_BASE = event.execution_metadata.devrev_endpoint;
  const devrevSDK = client.setup({
    endpoint: API_BASE,
    token: devrevPAT,
  });

  const queryParams = {
    type: [WorkType.Issue], // Filters work items of type 'Issue'
    "issue.sprint": event.payload.object_id, // Filter by a specific sprint
  };

  // Call the API with parameters
  const response = await devrevSDK.worksList(queryParams);
  console.log(response.data);

  const sprintSummary = await generateSprintOverview(response.data);
  if (sprintSummary) {
    const webhookUrl = event.input_data.global_values['webhookUrl'];
    await postSprintSummaryToSlack(webhookUrl, sprintSummary);
  } else {
    console.error('Failed to generate sprint summary');
  }
}

export const run = async (events: any[]) => {
  console.info("events", JSON.stringify(events), "\n\n\n");
  for (let event of events) {
    await handleSprintEndEvent(event);
  }
};

export default run;

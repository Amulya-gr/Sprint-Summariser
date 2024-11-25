import { client } from "@devrev/typescript-sdk";
import { WorkType } from "@devrev/typescript-sdk/dist/auto-generated/public-devrev-sdk";
import { OpenAI } from "openai";
import { postSprintSummaryToSlack } from "../../sprintEndSlackPoster";
import { postMidSprintAlertToSlack } from "../../midSprintSlackPoster";

import config from '../../config.json';

const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

// Priority-to-effort mapping
const priorityToEffort: Record<string, number> = {
  P0: 8, // Critical tasks
  P1: 5, // High priority
  P2: 3, // Medium priority
  P3: 1  // Low priority
};

const SPRINT_EVENTS = {
  END: "sprint-end-event",
  MID: "mid-sprint-alert-event",
};

interface SprintData {
  sprintName: string;
  startDate: string;
  endDate: string;
  sprintVelocity: number;
  plannedVelocity: number;
  closedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  whatWentWell: string;
  whatWentWrong: string;
  retrospectiveInsights: string;
  issuesSummary: IssueSummary[];
}

interface IssueSummary {
  status: string; // e.g., "Closed", "In Progress", "Blocked"
  issueCount: number;
  issues: Issue[]; // Array of issues with their details
}

interface Issue {
  issueKey: string; // Unique identifier for the issue
  name: string; // Name of the issue (e.g., "Fix UI Bug", "API Optimization")
  priority: string; // e.g., "High", "Medium", "Low"
  part: string; // Part of the project the issue is related to, e.g., "Frontend", "Backend"
}

// Helper function to format issues
const formatIssues = (issues: any[]) => {
  return issues.map((issue: any) => ({
    title: issue.title,
    issueDisplayId: issue.display_id,
    stage: issue.stage.name,
    state: issue.stage.state,
    applies_to_part: issue.applies_to_part,
    priority: issue.priority,
    owner: issue.owned_by.map((owner: any) => owner.display_name).join(", "),
    actualStartDate: issue.actual_start_date,
    actualCloseDate: issue.actual_close_date,
    sprintStartDate: issue.sprint.start_date,
    sprintEndDate: issue.sprint.end_date,
    sprintName: issue.sprint.name,
    description: issue.body || "No description provided",
  }));
};

// Helper function to construct OpenAI prompt
const constructPrompt = (issues: any[], sprintVelocity: number, plannedVelocity: number) => {
  return `
    You are tasked with analyzing and summarizing the DevRev sprint data to support effective sprint retrospectives. The goal is to provide a concise yet comprehensive overview that highlights successes, challenges, and actionable future insights, which will be shared with the team via Slack.

    A DevRev sprint issue is equivalent to a sprint story.

    Your summary must include:
    
    - **What went well**: Identify tasks or aspects of the sprint that were successful. Use the data from all sprint issues to determine which tasks were completed successfully, any that were particularly well-executed, or any that had a significant positive impact. Consider the priority of the issues, their state, and whether they were completed on time.
    - **What went wrong**: Highlight issues or blockers faced during the sprint. Use the data to identify any issues that were blocked, delayed, or faced significant challenges. Consider the state of the issue, its stage, and whether it was completed or remained in progress beyond expectations.
    - **Retrospective insights**: Provide recommendations or actionable insights for future sprints based on the issues' statuses, priorities, owners, and other details. Reflect on patterns or trends, such as which types of issues were more prone to delays or blockages, and suggest improvements for future sprint planning and execution.
    - **Issue Summary**: Offer a breakdown of issues by status (Closed, In Progress, Blocked).

    For each issue, determine if it is closed, in progress, or blocked based on its stage.

    Closed category includes: completed, won't_fix, duplicate stages
    In progress category includes: in_development, in_review, in_testing, in_deployment
    Blocked category includes: triage, backlog, prioritised

    Sprint Velocity: ${sprintVelocity}, Planned Velocity: ${plannedVelocity}

    Here are the sprint issues:

    ${JSON.stringify(issues, null, 2)}

    Provide a structured output strictly in the following JSON string format:

    {
      sprintName: string, 
      startDate: string, 
      endDate: string, 
      sprintVelocity: number,
      closedIssues: number, 
      inProgressIssues: number, 
      blockedIssues: number, 
      whatWentWell: string, 
      whatWentWrong: string, 
      retrospectiveInsights: string, 
      issuesSummary: [
        {
          status: "Closed" | "In Progress" | "Blocked", 
          issueCount: number, 
          issues: [
            {
              issueKey: string, 
              name: string, 
              priority: "P0" | "P1" | "P2" | "P3", 
              part: string
            }
          ]
        }
      ]
    }
    
    The output should only contain JSON string
  `;
};

// Function to make OpenAI API call to generate sprint overview
const generateSprintOverview = async (
  data: any
): Promise<SprintData | null> => {
  const issues = formatIssues(data);
  const {actualVelocity, plannedVelocity} = calculateSprintVelocity(issues);
  const prompt = constructPrompt(issues, actualVelocity, plannedVelocity);

  try {
    console.info("Sending request to OpenAI for sprint overview generation...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that helps generate sprint retrospectives.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    if (
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message?.content
    ) {
      const content = response.choices[0].message.content.trim();
      console.info("Sprint overview generated successfully.", content);
      const sanitizedContent = content.replace(/```json/g, '').replace(/```/g, '');
      return JSON.parse(sanitizedContent); // Safely parse the content into SprintData
    } else {
      console.error("No valid response or message content from OpenAI API");
      return null;
    }
  } catch (error) {
    console.error("Error generating sprint overview:", error);
    return null;
  }
};

async function handleMidSprintAlertEvent(event: any): Promise<void> {
  console.info("Handling mid-sprint alert event...");
  
  // Fetch all sprint issues
  const sprintIssues = await fetchSprintIssues(event);
  const formatedIssues = formatIssues(sprintIssues);
  const { actualVelocity, plannedVelocity } = calculateSprintVelocity(formatedIssues);

  const filteredStages = ["triage", "backlog", "prioritized"];
  const filteredIssues = formatedIssues.filter(issue =>
    filteredStages.includes(issue.stage.toLowerCase())
  );

  if (sprintIssues && sprintIssues.length > 0) {
    console.info("Posting mid-sprint alert to Slack...");
    const webhookUrl = event.input_data.global_values["webhook_url"];
    const remainingVelocity = plannedVelocity - actualVelocity;

    // Generate issue list for the message
    let issueList = filteredIssues.map(
      (issue) =>
        `- ${issue.title} (ID: ${issue.issueDisplayId}, Stage: ${issue.stage || "Unknown"}, Priority: ${issue.priority || "None"})`
    ).join("\n");
    
    if (!issueList) {
      issueList = "*None of the issues are open.*";
    }

    // Construct the Slack message
    const message = `
      🚨 *Mid-Sprint Alert* 🚨
      The following issues are in Open state:

      ${issueList}

      *Sprint Velocity Update:*
      - Planned Velocity: ${plannedVelocity}
      - Velocity Achieved So Far: ${actualVelocity}
      - Remaining Velocity Needed: ${remainingVelocity}
      
      Keep pushing to meet the sprint goals! 💪
    `;
    await postMidSprintAlertToSlack(webhookUrl, message);
  } else {
    console.info("No issues found in specified stages for mid-sprint alert.");
  }
}

async function fetchSprintIssues(event: any): Promise<any[]> {
  const devrevPAT = event.context.secrets.service_account_token;
  const API_BASE = event.execution_metadata.devrev_endpoint;
  const devrevSDK = client.setup({
    endpoint: API_BASE,
    token: devrevPAT,
  });

  const queryParams = {
    type: [WorkType.Issue],
    "issue.sprint": event.payload.object_id, // Filter by sprint ID
  };

  try {
    console.info("Fetching sprint issues from DevRev...");
    const response = await devrevSDK.worksList(queryParams);
    console.info("Fetched issues:", response.data?.works);
    return response.data?.works || [];
  } catch (error) {
    console.error("Error fetching sprint issues:", error);
    return [];
  }
}

// Function to handle the sprint end event and post the summary
async function handleSprintEndEvent(event: any): Promise<void> {
  try {
    const sprintIssues = await fetchSprintIssues(event);

    const sprintSummary = await generateSprintOverview(sprintIssues);

    if (sprintSummary) {
      console.info("Posting sprint summary to Slack...");
      const webhookUrl = event.input_data.global_values["webhook_url"];
      await postSprintSummaryToSlack(webhookUrl, sprintSummary); // Post summary to Slack
    } else {
      console.error("Failed to generate sprint summary");
    }
  } catch (error) {
    console.error("Error handling sprint end event:", error);
  }
}

function calculateSprintVelocity(issues: any[]): { actualVelocity: number, plannedVelocity: number } {
  let actualVelocity = 0;
  let plannedVelocity = 0;

  issues.forEach((issue) => {
    const effort = priorityToEffort[issue.priority] || 0; // Default to 0 if priority is not mapped
    plannedVelocity += effort; // Add all issues to planned velocity

    // Add effort of completed issues to actual velocity
    if (issue.stage.toLowerCase() === "completed") {
      actualVelocity += effort;
    }
  });

  console.info(`Calculated actual velocity: ${actualVelocity}, planned velocity: ${plannedVelocity}`);
  return { actualVelocity, plannedVelocity };
}

// Main entry point
export const run = async (events: any[]): Promise<void> => {
  console.info("Processing events:", JSON.stringify(events));

  for (const event of events) {
    switch (event.event_type) {
      case SPRINT_EVENTS.END:
        await handleSprintEndEvent(event);
        break;
      case SPRINT_EVENTS.MID:
        await handleMidSprintAlertEvent(event);
        break;
      default:
        console.warn(`Unhandled event type: ${event.event_type}`);
    }
  }
};

export default run;
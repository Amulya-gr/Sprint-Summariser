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
  "p0": 8, // Critical tasks
  "p1": 5, // High priority
  "p2": 3, // Medium priority
  "p3": 1  // Low priority
};

const SPRINT_EVENTS = {
  END: "custom:sprint-end-event",
  MID: "custom:mid-sprint-alert-event",
};

interface SprintData {
  sprintName: string;
  startDate: string;
  endDate: string;
  sprintVelocity: number;
  plannedVelocity: number;
  sprintGrade: string;
  openIssues: number;
  closedIssues: number;
  inProgressIssues: number;
  blockedIssues: number;
  whatWentWell: string[];
  whatWentWrong: string[];
  retrospectiveInsights: string[];
  issuesSummary: IssueSummary[];
  comparisonWithPreviousSprints: {
    velocityTrend: string;
    issueCompletionTrend: string;
    blockerTrend: string;
    recommendations: string;
};
}

interface IssueSummary {
  status: string; // e.g., "Open", "Closed", "In Progress", "Blocked"
  issueCount: number;
  issues: Issue[];
}

interface Issue {
  issueKey: string;
  name: string;
  priority: string;
  part: string;
}

const sprintSummaries: Record<string, SprintData> = {};
const MAX_SUMMARIES = 3;

// Save a sprint summary, ensuring the maximum limit of 3 records
function saveSprintSummary(sprintId: string, summary: SprintData): void {
    if (Object.keys(sprintSummaries).length >= MAX_SUMMARIES) {
        const oldestSprintId = Object.keys(sprintSummaries).sort(
            (a, b) =>
                new Date(sprintSummaries[a].endDate).getTime() -
                new Date(sprintSummaries[b].endDate).getTime()
        )[0];
        console.info(`Removing oldest sprint summary: ${oldestSprintId}`);
        delete sprintSummaries[oldestSprintId];
    }
    sprintSummaries[sprintId] = summary;
    console.info(`Saved summary for sprint: ${sprintId}`);
}

function getLastThreeSprintSummaries(): SprintData[] {
    return Object.values(sprintSummaries);
}

const formatIssues = (issues: any[]) => {
  return issues.map((issue: any) => {
    // Determine if the issue is blocked by checking tags
    const hasBlockedTag = issue.tags?.some((tag: any) => tag.tag.name.toLowerCase() === "blocked");

    return {
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
      hasBlockedTag: hasBlockedTag
    };
  });
};

const constructPrompt = (issues: any[], sprintVelocity: number, plannedVelocity: number, sprintGrade: string, previousSprints: SprintData[]) => {
  // Extract relevant data for the last three sprints
  const previousSprintsData = previousSprints.map((sprint) => ({
    sprintName: sprint.sprintName,
    sprintEndDate: sprint.endDate,
    sprintVelocity: sprint.sprintVelocity,
    plannedVelocity: sprint.plannedVelocity,
    sprintGrade: sprint.sprintGrade,
    openIssues: sprint.openIssues,
    closedIssues: sprint.closedIssues,
    inProgressIssues: sprint.inProgressIssues,
    blockedIssues: sprint.blockedIssues,
  }));

  return `
    You are tasked with analyzing and summarizing the DevRev sprint data to support effective sprint retrospectives. The goal is to provide a concise yet comprehensive overview that highlights successes, challenges, and actionable future insights, which will be shared with the team via Slack.

    Your summary must include:
    
    - **What went well**: Identify tasks or aspects of the sprint that were successful. Look for completed issues that had a significant positive impact, or any issues that were particularly well-executed. Consider the priority, state, and whether the issues were completed on time. Give 4 insightful bullet points as an array of strings.
    
    - **What went wrong**: Identify open issues or blockers faced during the sprint. Look for issues that were blocked, delayed, or encountered significant challenges. Analyze their state, stages, and whether they were completed or remained in progress beyond expectations. Give 4 insightful bullet points as an array of strings.
    
    - **Retrospective insights**: Provide actionable insights for future sprints. Reflect on patterns such as types of issues more prone to delays or blockages, and recommend improvements for future planning and execution. Give 4 insightful bullet points as an array of strings.

    - **Issue Summary**: Provide a breakdown of issues by status: "Open", "Closed", "In Progress", and "Blocked". Make sure to categorize issues accurately. Also sort them by category (p0 has highest priority).
    
    - **Comparison with Previous Sprints**: Analyze trends or regressions by comparing the current sprint's performance with the last three sprints. Focus on areas like velocity, issue resolution rates, blockers, and overall sprint outcomes.

    **Categorization**:
    - First check if an issue has the \`hasBlockedTag\` set to \`true\`, categorize it as "Blocked".
    - For remaining issues, determine its status based on the following stages:
      - **Open**: Issues in stages such as triage, backlog, prioritized.
      - **Closed**: Issues in stages such as completed, won't_fix, duplicate.
      - **In Progress**: Issues in stages such as in_development, in_review, in_testing, in_deployment.

    Current Sprint Data:
        - Sprint Velocity: ${sprintVelocity}
        - Planned Velocity: ${plannedVelocity}
        - Sprint Grade: ${sprintGrade}
        - Sprint Issues: ${JSON.stringify(issues, null, 2)}

    Last 3 Sprints Data:
    ${JSON.stringify(previousSprintsData, null, 2)}

    Sum of issues in all the categories should be equal to total number of issues.

    Please provide the summary in the following strict JSON format:

    {
      "sprintName": string,
      "startDate": string,
      "endDate": string,
      "sprintVelocity": number,
      "plannedVelocity": number,
      "sprintGrade": string,
      "openIssues": number,
      "closedIssues": number,
      "inProgressIssues": number,
      "blockedIssues": number,
      "whatWentWell": string[],
      "whatWentWrong": string[],
      "retrospectiveInsights": string[],
      "comparisonWithPreviousSprints": {
            "velocityTrend": string,
            "issueCompletionTrend": string,
            "blockerTrend": string,
            "recommendations": string
      },
      "issuesSummary": [
        {
          "status": "Open" | "Closed" | "In Progress" | "Blocked",
          "issueCount": number,
          "issues": [
            {
              "issueKey": string,
              "name": string,
              "priority": "P0" | "P1" | "P2" | "P3",
              "part": string
            }
          ]
        }
      ]
    }

    Ensure the output is strictly in the JSON format mentioned above.
  `;
};

const generateSprintOverview = async (data: any, currentSprintId: string): Promise<SprintData | null> => {
  const issues = formatIssues(data);
  const { actualVelocity, plannedVelocity } = calculateSprintVelocity(issues);
  const sprintGrade = calculateSprintGrade(actualVelocity, plannedVelocity);

  // Retrieve historical data for comparison
  const previousSprints = getLastThreeSprintSummaries();
  const prompt = constructPrompt(issues, actualVelocity, plannedVelocity, sprintGrade, previousSprints);

  try {
      const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
              { role: "system", content: "You are an assistant that helps generate sprint retrospectives." },
              { role: "user", content: prompt },
          ],
          temperature: 0.7,
      });

      if (response.choices?.[0]?.message?.content) {
          const content = response.choices[0].message.content.trim();
          const sanitizedContent = content.replace(/```json/g, "").replace(/```/g, "");
          const sprintSummary = JSON.parse(sanitizedContent) as SprintData;
          console.info(sprintSummary);
          // Save the current sprint summary
          saveSprintSummary(currentSprintId, sprintSummary);

          return sprintSummary;
      } else {
          console.error("No valid response from OpenAI API");
          return null;
      }
  } catch (error) {
      console.error("Error generating sprint overview:", error);
      return null;
  }
};

function calculateSprintGrade(actualVelocity: number, plannedVelocity: number): string {
  const percentageAchieved = (actualVelocity / plannedVelocity) * 100;

  if (percentageAchieved >= 95) {
    return "Exceptional";
  } else if (percentageAchieved >= 80) {
    return "Good";
  } else if (percentageAchieved >= 60) {
    return "Satisfactory";
  } else if (percentageAchieved >= 40) {
    return "Needs Improvement";
  } else {
    return "Poor";
  }
}

async function handleMidSprintAlertEvent(event: any): Promise<void> {
  console.info("Handling mid-sprint alert event...");

  // Fetch all sprint issues
  const sprintIssues = await fetchSprintIssues(event);
  const formattedIssues = formatIssues(sprintIssues);
  const { actualVelocity, plannedVelocity } = calculateSprintVelocity(formattedIssues);

  const filteredStages = ["triage", "backlog", "prioritized"];
  const filteredIssues = formattedIssues.filter(issue =>
    filteredStages.includes(issue.stage.toLowerCase())
  );

  if (sprintIssues && sprintIssues.length > 0) {
    console.info("Posting mid-sprint alert to Slack...");
    const webhookUrl = event.input_data.global_values["webhook_url"];
    const remainingVelocity = plannedVelocity - actualVelocity;
    
    await postMidSprintAlertToSlack(webhookUrl, filteredIssues, plannedVelocity, actualVelocity, remainingVelocity);
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

async function handleSprintEndEvent(event: any): Promise<void> {
  try {
    const sprintIssues = await fetchSprintIssues(event);

    const sprintSummary = await generateSprintOverview(sprintIssues, event.payload.object_id);

    if (sprintSummary) {
      console.info("Posting sprint summary to Slack...");
      const webhookUrl = event.input_data.global_values["webhook_url"];
      await postSprintSummaryToSlack(webhookUrl, sprintSummary);
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
    const effort = priorityToEffort[issue.priority] || 0;
    plannedVelocity += effort; // Add all issues to planned velocity

    // Add effort of completed issues to actual velocity
    if (issue.stage.toLowerCase() === "completed") {
      actualVelocity += effort;
    }
  });

  console.info(`Calculated actual velocity: ${actualVelocity}, planned velocity: ${plannedVelocity}`);
  return { actualVelocity, plannedVelocity };
}

export const run = async (events: any[]): Promise<void> => {
  console.info("Processing events:", JSON.stringify(events));

  for (const event of events) {
    switch (event.execution_metadata.event_type) {
      case SPRINT_EVENTS.END:
        await handleSprintEndEvent(event);
        break;
      case SPRINT_EVENTS.MID:
        await handleMidSprintAlertEvent(event);
        break;
      default:
        console.warn(`Unhandled event type: ${event.execution_metadata.event_type}`);
    }
  }
};

export default run;
import axios from "axios";

/**
 * Generates the Block Kit message for mid-sprint alert.
 * 
 * @param {any[]} formattedIssues - The formatted sprint issues.
 * @param {number} plannedVelocity - The planned velocity for the sprint.
 * @param {number} actualVelocity - The actual velocity achieved so far.
 * @param {number} remainingVelocity - The remaining velocity to be achieved.
 * @returns {object} - The Block Kit message payload.
 */
function generateMidSprintAlertMessage(formattedIssues: any[], plannedVelocity: number, actualVelocity: number, remainingVelocity: number): any {
    const priorityOrder = ["p0", "p1", "p2", "p3"];

    // Group issues by priority
    const groupedIssues: Record<string, string[]> = {
      "p0": [],
      "p1": [],
      "p2": [],
      "p3": []
    };
  
    formattedIssues.forEach(issue => {
      const issueDisplay = `${issue.issueDisplayId} - ${issue.title} (${issue.stage || "Unknown"})`;
      groupedIssues[issue.priority].push(issueDisplay);
    });
  
    // Construct the issue list for each priority group
    let issueListBlocks = [];
    priorityOrder.forEach(priority => {
      if (groupedIssues[priority].length > 0) {
        issueListBlocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Priority ${priority.toUpperCase()}:*\n${groupedIssues[priority].join("\n")}`
          }
        });
      }
    });
  
    if (issueListBlocks.length === 0) {
      issueListBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*None of the issues are open.*"
        }
      });
    }
  
    // Construct the Slack message using Block Kit
    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: ":rotating_light: *Mid-Sprint Alert* :rotating_light:\nThe following issues are still in Open state:"
          }
        },
        ...issueListBlocks,
        {
          type: "divider"
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Planned Velocity:*\n${plannedVelocity}`
            },
            {
              type: "mrkdwn",
              text: `*Velocity Achieved So Far:*\n${actualVelocity}`
            },
            {
              type: "mrkdwn",
              text: `*Remaining Velocity Needed:*\n${remainingVelocity}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Keep pushing to meet the sprint goals! :muscle:"
          }
        }
      ]
    };
  }

/**
 * Sends a mid-sprint alert message to a Slack channel using a webhook URL.
 * 
 * @param {string} webhookUrl - The Slack webhook URL.
 * @param {any[]} formattedIssues - The formatted sprint issues.
 * @param {number} plannedVelocity - The planned velocity for the sprint.
 * @param {number} actualVelocity - The actual velocity achieved so far.
 * @param {number} remainingVelocity - The remaining velocity to be achieved.
 */
export async function postMidSprintAlertToSlack(webhookUrl: string, formattedIssues: any[], plannedVelocity: number, actualVelocity: number, remainingVelocity: number): Promise<void> {
  try {
    console.info("Posting mid-sprint alert to Slack...");
    
    // Generate the Block Kit message
    const message = generateMidSprintAlertMessage(formattedIssues, plannedVelocity, actualVelocity, remainingVelocity);

    const response = await axios.post(webhookUrl, message, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 200) {
      console.info("Mid-sprint alert posted successfully.");
    } else {
      console.error(`Failed to post mid-sprint alert. Status: ${response.status}, Data: ${response.data}`);
    }
  } catch (error) {
    console.error("Error posting mid-sprint alert to Slack:", error);
  }
}
import axios from 'axios';

interface SprintData {
    completedTasks: number;
    inProgressTasks: number;
    blockedTasks: number;
    whatWentWell: string;
    whatWentWrong: string;
    retrospectiveInsights: string;
}

/**
 * Sends a sprint summary to Slack via a webhook.
 * 
 * @param webhookUrl - The Slack webhook URL.
 * @param sprintData - The sprint data to include in the summary.
 */
export async function postSprintSummaryToSlack(webhookUrl: string, sprintData: SprintData): Promise<void> {
    const payload = {
        text: "🏁 *Sprint Summary* 🏁",
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "🚀 Sprint Overview"
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Completed Tasks:*\n${sprintData.completedTasks}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*In-Progress Tasks:*\n${sprintData.inProgressTasks}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Blocked Tasks:*\n${sprintData.blockedTasks}`
                    }
                ]
            },
            {
                type: "divider"
            },
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "✨ What Went Well"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: sprintData.whatWentWell
                }
            },
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "⚠️ What Went Wrong"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: sprintData.whatWentWrong
                }
            },
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "💡 Retrospective Insights"
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: sprintData.retrospectiveInsights
                }
            }
        ]
    };

    try {
        const response = await axios.post(webhookUrl, payload);
        if (response.status === 200) {
            console.log('Sprint summary posted to Slack successfully.');
        } else {
            console.error('Failed to post to Slack. Status:', response.status);
        }
    } catch (error: any) {
        console.error('Error posting to Slack:', error.message);
    }
}
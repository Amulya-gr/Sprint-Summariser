import axios from 'axios';

interface SprintData {
    sprintName: string;
    startDate: string;
    endDate: string;
    sprintVelocity: number,
    plannedVelocity: number,
    closedIssues: number;
    inProgressIssues: number;
    blockedIssues: number;
    whatWentWell: string;
    whatWentWrong: string;
    retrospectiveInsights: string;
    issuesSummary: IssueSummary[];
    comparisonWithPreviousSprints: {
        velocityTrend: string;
        issueCompletionTrend: string;
        blockerTrend: string;
        recommendations: string;
    };
}

interface IssueSummary {
    status: string;  // e.g., "Closed", "In Progress", "Blocked"
    issueCount: number;
    issues: Issue[];  // Array of issues with their details
}

interface Issue {
    issueKey: string;  // Unique identifier for the issue
    name: string;      // Name of the issue (e.g., "Fix UI Bug", "API Optimization")
    priority: string;  // e.g., "High", "Medium", "Low"
    part: string;      // Part of the project the issue is related to, e.g., "Frontend", "Backend"
}

/**
 * Sends a sprint summary to Slack via a webhook.
 * 
 * @param webhookUrl - The Slack webhook URL.
 * @param sprintData - The sprint data to include in the summary.
 */
export async function postSprintSummaryToSlack(webhookUrl: string, sprintData: SprintData): Promise<void> {
    // Create issue status sections based on provided summaries
    const issueStatusSections = sprintData.issuesSummary.map((issueStatus) => {
        return {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `*${issueStatus.status} Issues:*`
                },
                {
                    type: "mrkdwn",
                    text: `*Total:* ${issueStatus.issueCount}\n*Issues:*\n${issueStatus.issues.map(issue => `• ${issue.issueKey} - ${issue.name} (Priority: ${issue.priority}, Part: ${issue.part})`).join("\n")}`
                }
            ]
        };
    });

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
            // Sprint Meta-data Section
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Sprint Name:*\n${sprintData.sprintName}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Start Date:*\n${new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }).format(new Date(sprintData.startDate))}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*End Date:*\n${new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }).format(new Date(sprintData.endDate))}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Sprint Velocity (Actual):*\n${sprintData.sprintVelocity}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Planned Velocity:*\n${sprintData.plannedVelocity}`
                    }
                ]
            },
            {
                type: "divider"
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Closed Issues:*\n${sprintData.closedIssues}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*In-Progress Issues:*\n${sprintData.inProgressIssues}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Blocked Issues:*\n${sprintData.blockedIssues}`
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
            },
            {
                type: "divider"
            },
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "📊 Sprint Comparison (vs. Previous Sprints)"
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Velocity Trend:* ${sprintData.comparisonWithPreviousSprints.velocityTrend}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Issue Completion Trend:* ${sprintData.comparisonWithPreviousSprints.issueCompletionTrend}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Blocker Trend:* ${sprintData.comparisonWithPreviousSprints.blockerTrend}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Recommendations:* ${sprintData.comparisonWithPreviousSprints.recommendations}`
                    }
                ]
            },
            {
                type: "divider"
            },
            ...issueStatusSections,
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `_P.S. The sprint velocity is calculated as the sum of efforts for completed issues during the sprint. Effort values are assigned based on priority:_\n\n• *P0 (Critical):* 8 effort points\n• *P1 (High Priority):* 5 effort points\n• *P2 (Medium Priority):* 3 effort points\n• *P3 (Low Priority):* 1 effort point`
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
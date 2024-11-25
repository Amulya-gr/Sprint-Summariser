import axios from "axios";

/**
 * Sends a mid-sprint alert message to a Slack channel using a webhook URL.
 * 
 * @param {string} webhookUrl - The Slack webhook URL.
 * @param {string} message - The message to post.
 */
export async function postMidSprintAlertToSlack(webhookUrl: string, message: string): Promise<void> {
  try {
    console.info("Posting mid-sprint alert to Slack...");
    const payload = {
      text: message,
    };

    const response = await axios.post(webhookUrl, payload, {
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
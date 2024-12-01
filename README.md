##For decumentation page click here : https://amulya-gr.github.io/Documentation-Sprint-Summariser/index.html


# Sprint Summarizer Snap-in Documentation

## Overview
The Sprint Summarizer automates the generation of detailed sprint summaries at the conclusion of each sprint. These summaries capture the highlights of the sprint, focusing on successes, challenges encountered, and actionable insights, and automatically deliver this information to a pre-configured Slack channel.

This tool eliminates the manual effort associated with compiling sprint reviews, facilitating quick and informed evaluations of team progress. With its structured design and scalable utilities, the Sprint Summarizer Snap-In helps teams focus on what matters most—achieving their goals while staying aligned and informed. Perfect for agile teams aiming to optimize their sprint retrospectives and communications.

## Objective
To streamline the retrospective process for development teams by providing automated, efficient, and informative sprint summaries. The goal is to reduce the time it takes to gather feedback after each sprint, thereby allowing teams to focus more on reflection and continuous improvement.

## Core Features
- **Sprint Overview Generation:** Collects and categorizes tasks as complete, in-progress, open or blocked throughout the sprint.
- **Summarization:** Generates clear and actionable sprint summaries.
- **What Went Well:** Highlights aspects of the sprint that were particularly successful.
- **What Went Wrong:** Identifies challenges and blockers experienced during the sprint.
- **Retrospective Insights:** Offers actionable recommendations for enhancing future sprints.
- **Slack Integration:** Posts the sprint summary to a configurable Slack channel using the Slack API.

## Additional Features
- **Sprint Velocity:** Planned Sprint velocity and actual attained sprint velocity is calculated based on the number of issues present and priorities of each issue.
- **Sprint Grade:** Based on the percentage of actual velocity achieved compared to the planned velocity, categorizing it into “Exceptional,” “Good,” “Satisfactory,” “Needs Improvement,” or “Poor.” It helps evaluate sprint performance by mapping velocity completion to qualitative feedback.
- **Mid Sprint Alert:** A checkpoint conducted midway through a sprint to review progress based on the so far obtained velocity and assess the status of tasks or issues, then list open issues based on priority. It helps ensure the sprint is on track to achieve its goals.
- **Sprint Comparison:** Additional insights on Velocity, Blockers and Issue Completion Trends, including Recommendations in comparison to the previous sprints.

## Technical Details

### Inputs
| Field Name  | Description                | Required | Default Value                                      |
|-------------|----------------------------|----------|----------------------------------------------------|
| webhook_url | Slack channel webhook URL  | Yes      | https://hooks.slack.com/services/T0000/B0000/XXXX  |

### Event Sources
| Source Name       | Description                              | Event Types                                      |
|-------------------|------------------------------------------|--------------------------------------------------|
| devrev-webhook    | Tracks DevRev work item creation and updates. | work_created, work_updated                        |
| scheduled-events  | Custom events triggered by snap-in.      | custom:sprint-end-event, custom:mid-sprint-alert-event |

## Prerequisites
- Obtain a Slack channel webhook URL to specify where sprint summaries should be posted.
- Access DevRev API to monitor and gather sprint data. Ensure you have necessary roles and permissions.
- A valid API key for OpenAI for creating the summarized content.

## Setup Instructions
1. **Clone the repository:**
    ```sh
    git clone https://github.com/Amulya-gr/Sprint-Summariser
    ```
2. **Install Dependencies:** Ensure you have Node.js installed, then run:
    ```sh
    npm install
    ```
3. Go to `config.json` file located at `code/src/config.json` and put your OpenAI API key.
4. Deploy the snap-in. Please refer to [DevRev Docs](https://developer.devrev.ai/public/snapin-development/concepts#function).

## Workflow
![arc-with-bg(1)](https://github.com/user-attachments/assets/2b9c966c-fd17-4d89-bb44-08cd78875e44)

1. **User Action in DevRev System:** A user creates or updates an issue in an active sprint, triggering a `work_created` or `work_updated` event via the DevRev-webhook event source.
2. **Event Sent to Snap-in:** The triggered event is sent to the Snap-in for processing.
3. **Snap-in Event Handling:**
    - Schedules two key events: *Mid-Sprint Alert* and *Sprint End Event*.
    - Begins data aggregation when the events are triggered.
4. **Retrieving Sprint Data:** The Snap-in fetches details of all the issues in the sprint using DevRev's `works.list API`.
5. **Send Mid-Sprint Alert:** Filter open issues from the list and sort them by priority. Then, calculate the velocity achieved so far and the remaining velocity for the sprint, and send the alert to Slack.
6. **Formats Data and Constructs Prompt:** Relevant data is extracted and formatted from the `works.list` API. Sprint velocity and grade are calculated, followed by retrieving the previous sprint summary. Then, the prompt is constructed using the formatted data.
7. **Data Processing with OpenAI API:** The Snap-in sends the sprint data to the OpenAI API, which:
    - Analyzes the data.
    - Generates a formatted summary with insights (e.g., progress, areas for improvement).
8. **Summary Delivery:** The generated summary is sent via:
    - **Slack Webhook:** Posts the summary to a Slack channel.
9. **External Systems Integration:** The Snap-in ensures seamless collaboration using Slack and OpenAI for AI-enhanced sprint management.

## Automation Handling
- **Automations:**
    1. **Schedule Sprint End Event with Sprint Data:** Triggered by events `work_created` and `work_updated`, calling **function_1**.
    2. **Generate Sprint Summary on Sprint End:** Triggered by `custom:sprint-end-event` and `custom:mid-sprint-alert-event`, calling **function_2**.

## Sprint Summary Storage Documentation

### Current Implementation
- **Storage:** Sprint summaries are stored in an in-memory object within the application code.
- **Reason:** Simplifies prototyping and avoids external dependencies during early development.

### Limitations
- **No Persistence:** Data is lost on application restarts.
- **Limited Scalability:** Hard to manage as the data grows.
- **Restricted Access:** Summaries are not shareable across systems.

### Future Plan
- **Database Migration:**
    - Store summaries in a database (e.g., PostgreSQL, MongoDB).
    - Allow persistent, scalable, and queryable data storage.

### Conclusion
The current approach is temporary and will transition to a database for better scalability and persistence.

## Snap-In Demo Video
For a comprehensive demonstration of the Sprint Summarizer Snap-In in action, including its setup, configuration, functionality, and working please watch the following video:

[Sprint Summarizer Snap-In Demo](https://youtu.be/uNc25YdwNLI)

This video provides an in-depth look at how the Snap-In automates the generation of sprint summaries, integrates with Slack, and enhances the sprint retrospective process for development teams.

## Slack Message Screenshots

### Mid Sprint Alert

![WhatsApp Image 2024-12-01 at 21 06 47](https://github.com/user-attachments/assets/57dc3bbd-c0fe-4718-9c85-4935f999d794)

### Sprint End Summary

![WhatsApp Image 2024-12-01 at 21 32 26](https://github.com/user-attachments/assets/febab20c-9fe2-4f06-9e9e-d501152fd826)
![WhatsApp Image 2024-12-01 at 21 32 27](https://github.com/user-attachments/assets/b8eb42b7-e60e-4357-93f8-7c142d36f15c)
![WhatsApp Image 2024-12-01 at 21 32 27 (1)](https://github.com/user-attachments/assets/98d294a5-0291-41a9-92e8-a6937a8c7579)
![WhatsApp Image 2024-12-01 at 21 32 28](https://github.com/user-attachments/assets/8b4cd974-84df-4de1-bacb-dfab71b74bbf)






import axios from "axios";
import { postSprintSummaryToSlack } from "../../slackPoster";

interface SprintDetails {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

let sprintStore: Map<string, SprintDetails> = new Map();

// Cleanup function to remove old sprints periodically
function cleanupOldSprints() {
  const now = Date.now();
  sprintStore.forEach((sprint, sprintId) => {
    const sprintEndDate = new Date(sprint.endDate).getTime();
    // Remove sprint if it has ended more than 1 day ago
    if (sprintEndDate < now - 86400000) { // 86400000 ms = 1 day
      sprintStore.delete(sprintId);
      console.log(`Deleted sprint details for sprint ID: ${sprintId}`);
    }
  });
}

// Periodically clean up old sprints every 24 hours
setInterval(cleanupOldSprints, 86400000); // 1 day in ms

async function handleWorkEvent(event: any) {
  const devrevPAT = event.context.secrets.service_account_token;
  const work = event.payload.work_created
    ? event.payload.work_created.work
    : event.payload.work_.work;

  // Storing sprint details
  const sprint = work.sprint;
  if (sprint) {
    if (!sprintStore.has(sprint.id)) {
      const sprintDetails: SprintDetails = {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.start_date,
        endDate: sprint.end_date,
      };

      sprintStore.set(sprint.id, sprintDetails);
      // Scheduling the sprint end event
      await scheduleSprintEndEvent(sprintDetails, devrevPAT, event.input_data);
    }
  }
}

// Schedule an event using DevRev API
async function scheduleSprintEndEvent(
  sprint: SprintDetails,
  devrevPAT: string,
  inputData: any
): Promise<void> {
  const url = "https://api.devrev.ai/event-sources.schedule";
  const delaySecs = Math.floor(
    (new Date(sprint.endDate).getTime() - Date.now()) / 1000
  );
  const eventPayload = {
    object_id: sprint.id,
    name: sprint.name,
  };

  const payloadBytes = Buffer.from(JSON.stringify(eventPayload)).toString(
    "base64"
  );
  const publishAt = new Date(Date.now() + 1000 * delaySecs).toISOString();

  const req = {
    id: inputData.event_sources["scheduled-events"],
    payload: payloadBytes,
    event_type: "work-created-scheduled-event",
    publish_at: publishAt,
    event_key: `delayed-run-${sprint.id}`,
  };

  try {
    const response = await axios.post(url, req, {
      headers: {
        "Content-Type": "application/json",
        authorization: devrevPAT,
      },
    });
    console.log("Scheduled event response:", response.data);
  } catch (error) {
    console.error("Error scheduling sprint end event:", error);
  }
}

// Fetch sprint-related work items using works.list API
async function gatherSprintData(
  sprintId: string,
  devrevPAT: string
): Promise<any> {
  const url = `https://api.devrev.ai/works.list?issue.sprint=${encodeURIComponent(
    sprintId
  )}&type=issue`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: devrevPAT,
      },
    });
    const workItems = response.data.items;
    const completedTasks = workItems.filter(
      (item: any) => item.status === "completed"
    ).length;
    const inProgressTasks = workItems.filter(
      (item: any) => item.status === "in-progress"
    ).length;
    const blockedTasks = workItems.filter(
      (item: any) => item.status === "blocked"
    ).length;

    return {
      completedTasks,
      inProgressTasks,
      blockedTasks,
      whatWentWell:
        "• Delivered features on time.\n• Effective team collaboration.",
      whatWentWrong:
        "• Delayed due to resource constraints.\n• Encountered major blockers.",
      retrospectiveInsights:
        "• Plan sprints with buffers.\n• Allocate resources effectively.",
    };
  } catch (error) {
    console.error("Error fetching sprint data:", error);
    throw new Error("Failed to gather sprint data");
  }
}

async function runScheduledEvent(event: any) {
  const sprintId = event.payload.object_id;
  const devrevPAT = event.context.secrets.service_account_token;

  const sprintData = await gatherSprintData(sprintId, devrevPAT);

  const webhookUrl =
    "https://hooks.slack.com/services/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";
  postSprintSummaryToSlack(webhookUrl, sprintData);
  console.log("Sprint summary sent to Slack.");
}

export const run = async (events: any[]) => {
  console.info("events", JSON.stringify(events), "\n\n\n");
  for (let event of events) {
    await handleWorkEvent(event);
  }
};

export default run;

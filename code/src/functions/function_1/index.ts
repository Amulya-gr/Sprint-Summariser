import axios from "axios";

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
    : event.payload.work_updated.old_work;

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
      // Schedule the sprint end event and mid-sprint alert event
      await scheduleSprintEndEvent(sprintDetails, devrevPAT, event.input_data);
      await scheduleMidSprintAlertEvent(sprintDetails, devrevPAT, event.input_data);
    }
  }
}

// Schedule a sprint end event
async function scheduleSprintEndEvent(
  sprint: SprintDetails,
  devrevPAT: string,
  inputData: any
): Promise<void> {
  await scheduleEvent(
    sprint,
    devrevPAT,
    inputData,
    "sprint-end-event",
    sprint.endDate,
    `delayed-run-${sprint.id}`
  );
}

// Schedule a mid-sprint alert event
async function scheduleMidSprintAlertEvent(
  sprint: SprintDetails,
  devrevPAT: string,
  inputData: any
): Promise<void> {
  const sprintStart = new Date(sprint.startDate).getTime();
  const sprintEnd = new Date(sprint.endDate).getTime();
  const midSprintTime = new Date((sprintStart + sprintEnd) / 2).toISOString();

  await scheduleEvent(
    sprint,
    devrevPAT,
    inputData,
    "mid-sprint-alert-event",
    midSprintTime,
    `mid-sprint-alert-${sprint.id}`
  );
}

// General function to schedule an event using DevRev API
async function scheduleEvent(
  sprint: SprintDetails,
  devrevPAT: string,
  inputData: any,
  eventType: string,
  eventTime: string,
  eventKey: string
): Promise<void> {
  const url = "https://api.devrev.ai/event-sources.schedule";
  const delaySecs = Math.floor(
    (new Date(eventTime).getTime() - Date.now()) / 1000
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
    event_type: eventType,
    publish_at: publishAt,
    event_key: eventKey,
  };

  try {
    const response = await axios.post(url, req, {
      headers: {
        "Content-Type": "application/json",
        authorization: devrevPAT,
      },
    });
    console.log(`Scheduled ${eventType} response:`, response.data);
  } catch (error) {
    console.error(`Error scheduling ${eventType}:`, error);
  }
}

export const run = async (events: any[]) => {
  console.info("events", JSON.stringify(events), "\n\n\n");
  for (let event of events) {
    await handleWorkEvent(event);
  }
};

export default run;
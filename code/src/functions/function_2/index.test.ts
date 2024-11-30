/*
 * Copyright (c) 2023 DevRev, Inc. All rights reserved.
 */

import mockAxios from 'jest-mock-axios';
import { run } from './index';
import { postSprintSummaryToSlack } from '../../sprintEndSlackPoster';
import { postMidSprintAlertToSlack } from '../../midSprintSlackPoster';
import { OpenAI } from 'openai';
import function2Event from '../../fixtures/function_2_event.json';

jest.mock('axios', () => mockAxios);
jest.mock('../../sprintEndSlackPoster');
jest.mock('../../midSprintSlackPoster');
jest.mock('openai');

describe('Function 2 Tests', () => {
  afterEach(() => {
    mockAxios.reset();
    jest.clearAllTimers();
  });

  it('should handle sprint end event and post summary to Slack', async () => {
    jest.useFakeTimers();

    const mockEvent = function2Event[0];

    const mockIssuesResponse = {
      data: {
        works: [
          {
            title: 'Issue 1',
            display_id: 'ISSUE-1',
            stage: { name: 'Completed', state: 'closed' },
            applies_to_part: 'Part 1',
            priority: 'p1',
            owned_by: [{ display_name: 'Owner 1' }],
            actual_start_date: '2024-11-01T00:00:00Z',
            actual_close_date: '2024-11-10T00:00:00Z',
            sprint: {
              start_date: '2024-11-01T00:00:00Z',
              end_date: '2024-11-15T00:00:00Z',
              name: 'Sprint 1',
            },
            body: 'Issue description',
            tags: [],
          },
        ],
      },
    };

    const mockOpenAIResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              sprintName: 'Sprint 1',
              startDate: '2024-11-01T00:00:00Z',
              endDate: '2024-11-15T00:00:00Z',
              sprintVelocity: 5,
              plannedVelocity: 5,
              sprintGrade: 'Good',
              openIssues: 0,
              closedIssues: 1,
              inProgressIssues: 0,
              blockedIssues: 0,
              whatWentWell: ['Well done!'],
              whatWentWrong: ['Nothing went wrong.'],
              retrospectiveInsights: ['Keep up the good work.'],
              comparisonWithPreviousSprints: {
                velocityTrend: 'Stable',
                issueCompletionTrend: 'Improving',
                blockerTrend: 'Decreasing',
                recommendations: 'Continue with the current process.',
              },
              issuesSummary: [
                {
                  status: 'Closed',
                  issueCount: 1,
                  issues: [
                    {
                      issueKey: 'ISSUE-1',
                      name: 'Issue 1',
                      priority: 'P1',
                      part: 'Part 1',
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    };

    mockAxios.get.mockResolvedValueOnce(mockIssuesResponse);
    (OpenAI.prototype.chat.completions.create as jest.Mock).mockResolvedValueOnce(mockOpenAIResponse);

    await run([mockEvent]);

    expect(mockAxios.get).toHaveBeenCalledWith(
      'https://api.devrev.ai/works.list',
      expect.any(Object)
    );
    expect(postSprintSummaryToSlack).toHaveBeenCalledWith(
      'mock-webhook-url',
      expect.objectContaining({
        sprintName: 'Sprint 1',
        sprintVelocity: 5,
        plannedVelocity: 5,
      })
    );

    jest.runAllTimers();
  });

  it('should handle mid-sprint alert event and post alert to Slack', async () => {
    jest.useFakeTimers();

    const mockEvent = {
      ...function2Event[0],
      execution_metadata: {
        ...function2Event[0].execution_metadata,
        event_type: 'custom:mid-sprint-alert-event',
      },
    };

    const mockIssuesResponse = {
      data: {
        works: [
          {
            title: 'Issue 1',
            display_id: 'ISSUE-1',
            stage: { name: 'In Development', state: 'in_progress' },
            applies_to_part: 'Part 1',
            priority: 'p1',
            owned_by: [{ display_name: 'Owner 1' }],
            actual_start_date: '2024-11-01T00:00:00Z',
            actual_close_date: null,
            sprint: {
              start_date: '2024-11-01T00:00:00Z',
              end_date: '2024-11-15T00:00:00Z',
              name: 'Sprint 1',
            },
            body: 'Issue description',
            tags: [],
          },
        ],
      },
    };

    mockAxios.get.mockResolvedValueOnce(mockIssuesResponse);

    await run([mockEvent]);

    expect(mockAxios.get).toHaveBeenCalledWith(
      'https://api.devrev.ai/works.list',
      expect.any(Object)
    );
    expect(postMidSprintAlertToSlack).toHaveBeenCalledWith(
      'mock-webhook-url',
      expect.any(Array),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );

    jest.runAllTimers();
  });

  it('should handle unhandled event type', async () => {
    const mockEvent = {
      ...function2Event[0],
      execution_metadata: {
        ...function2Event[0].execution_metadata,
        event_type: 'custom:unknown-event',
      },
    };

    await run([mockEvent]);

    expect(mockAxios.get).not.toHaveBeenCalled();
    expect(postSprintSummaryToSlack).not.toHaveBeenCalled();
    expect(postMidSprintAlertToSlack).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    jest.useFakeTimers();

    const mockEvent = function2Event[0];

    mockAxios.get.mockRejectedValueOnce(new Error('Network error'));

    await run([mockEvent]);

    expect(mockAxios.get).toHaveBeenCalledWith(
      'https://api.devrev.ai/works.list',
      expect.any(Object)
    );
    expect(postSprintSummaryToSlack).not.toHaveBeenCalled();

    jest.runAllTimers();
  });
});
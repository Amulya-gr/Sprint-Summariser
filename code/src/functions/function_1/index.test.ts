/*
 * Copyright (c) 2023 DevRev, Inc. All rights reserved.
 */

import mockAxios from 'jest-mock-axios';
import { run } from './index';

jest.mock('axios', () => mockAxios);

describe('Function 1 Tests', () => {
  afterEach(() => {
    mockAxios.reset();
    jest.clearAllTimers();
  });

  it('should handle work event and schedule sprint events', async () => {
    const mockEvent = {
      context: {
        secrets: {
          service_account_token: 'mock-token',
        },
      },
      payload: {
        work_created: {
          work: {
            sprint: {
              id: 'sprint-1',
              name: 'Sprint 1',
              start_date: '2024-11-01T00:00:00Z',
              end_date: '2024-11-15T00:00:00Z',
            },
          },
        },
      },
      input_data: {
        event_sources: {
          'scheduled-events': 'mock-event-source-id',
        },
      },
    };

    const mockResponse = {
      data: { message: 'Success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };

    mockAxios.post.mockResolvedValueOnce(mockResponse);
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    await run([mockEvent]);

    expect(mockAxios.post).toHaveBeenCalledTimes(2);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.devrev.ai/event-sources.schedule',
      expect.objectContaining({
        event_type: 'sprint-end-event',
      }),
      expect.any(Object)
    );
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.devrev.ai/event-sources.schedule',
      expect.objectContaining({
        event_type: 'mid-sprint-alert-event',
      }),
      expect.any(Object)
    );
  });

  it('should handle work event without sprint', async () => {
    const mockEvent = {
      context: {
        secrets: {
          service_account_token: 'mock-token',
        },
      },
      payload: {
        work_created: {
          work: {},
        },
      },
      input_data: {
        event_sources: {
          'scheduled-events': 'mock-event-source-id',
        },
      },
    };

    await run([mockEvent]);

    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('should handle work updated event', async () => {
    const mockEvent = {
      context: {
        secrets: {
          service_account_token: 'mock-token',
        },
      },
      payload: {
        work_updated: {
          old_work: {
            sprint: {
              id: 'sprint-2',
              name: 'Sprint 2',
              start_date: '2024-11-01T00:00:00Z',
              end_date: '2024-11-15T00:00:00Z',
            },
          },
        },
      },
      input_data: {
        event_sources: {
          'scheduled-events': 'mock-event-source-id',
        },
      },
    };

    const mockResponse = {
      data: { message: 'Success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    };

    mockAxios.post.mockResolvedValueOnce(mockResponse);
    mockAxios.post.mockResolvedValueOnce(mockResponse);

    await run([mockEvent]);

    expect(mockAxios.post).toHaveBeenCalledTimes(2);
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.devrev.ai/event-sources.schedule',
      expect.objectContaining({
        event_type: 'sprint-end-event',
      }),
      expect.any(Object)
    );
    expect(mockAxios.post).toHaveBeenCalledWith(
      'https://api.devrev.ai/event-sources.schedule',
      expect.objectContaining({
        event_type: 'mid-sprint-alert-event',
      }),
      expect.any(Object)
    );
  });
});
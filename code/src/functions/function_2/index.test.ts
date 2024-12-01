/*
 * Copyright (c) 2023 DevRev, Inc. All rights reserved.
 */

import { testRunner } from '../../test-runner/test-runner';

describe('Function 2 Tests', () => {
  it('should handle sprint end event', async () => {
    await testRunner({
      fixturePath: 'function_2_sprint_end_event.json',
      functionName: 'function_2',
    });
  });

  it('should handle mid-sprint alert event', async () => {
    await testRunner({
      fixturePath: 'function_2_mid_sprint_event.json',
      functionName: 'function_2',
    });
  });
});
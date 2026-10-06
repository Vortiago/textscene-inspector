/// <reference types="vitest/globals" />

/**
 * Test setup for @textscene/core. A full-shell mount can outlast testing-library's 1 s async
 * timeout on a contended CI runner, so CI gets 5 s. Local runs keep 1 s, so a real slowdown shows.
 * The vmThreads pool splits Node's realm from the test's, so the binary globals get unified first.
 *
 * Every test's title must name no tier but the one it asserts. The tier helpers record what
 * they assert, so the record starts empty before each test and the title is checked after it.
 */

import { configure } from '@testing-library/react';
import { afterEach, beforeEach, expect } from 'vitest';
import { expectTitleNamesRecordedTiers, takeRecordedTiers } from './src/linter/testing/titleTier.js';
import { toBeAllAtTier, toBeAtTier } from './src/linter/testing/tierMatchers.js';
import { unifyBinaryRealm } from './src/testing/vmRealm.js';

unifyBinaryRealm();
configure({ asyncUtilTimeout: process.env.CI ? 5000 : 1000 });

expect.extend({ toBeAtTier, toBeAllAtTier });
beforeEach(() => {
  takeRecordedTiers();
});
afterEach(({ task }) => {
  expectTitleNamesRecordedTiers(task.name);
});

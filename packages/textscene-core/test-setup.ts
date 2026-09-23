/// <reference types="vitest/globals" />

/**
 * Test setup for @textscene/core. A full-shell mount can outlast testing-library's 1 s async
 * timeout on a contended CI runner, so CI gets 5 s. Local runs keep 1 s, so a real slowdown shows.
 */

import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: process.env.CI ? 5000 : 1000 });

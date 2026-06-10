/// <reference types="vitest/globals" />

/**
 * Test setup for @textscene/core.
 *
 * CI runners are slow and contended: full-shell mount tests (R3F canvas +
 * tree + inspector under happy-dom) can legitimately take longer than
 * testing-library's 1 s default `waitFor`/`findBy*` timeout there. Give CI
 * headroom; keep the strict 1 s locally so genuine slowdowns still surface
 * during development.
 */

import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: process.env.CI ? 5000 : 1000 });

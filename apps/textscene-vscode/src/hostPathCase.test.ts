/** The host's path case follows the platform the extension host runs on. */

import { describe, expect, it } from 'vitest';
import { pathCaseOf } from '@textscene/core/resources/resPath';
import { HOST_PATH_CASE } from './hostPathCase';

describe('HOST_PATH_CASE', () => {
  it('is the path case of the platform this host runs on', () => {
    expect(HOST_PATH_CASE).toBe(pathCaseOf(process.platform));
  });
});

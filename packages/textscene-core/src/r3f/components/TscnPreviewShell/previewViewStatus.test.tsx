import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeardStatus } from './previewViewStatus';
import type { ViewStatus } from '../../viewStatus/viewStatus';

const PENDING: ViewStatus = {
  settled: null,
  pending: { textures: 0, fonts: 0 },
  frame: null,
  undrawn: [],
  isSoftwareRendering: true,
};
const SETTLED: ViewStatus = { ...PENDING, settled: { scriptedNodeCount: 0, hasCurrentCamera: true } };

function heardStatus() {
  return renderHook(() => useHeardStatus()).result.current;
}

describe('the status the shell hears', () => {
  it('counts a round each time a settled view turns pending', () => {
    const heard = heardStatus();
    heard.onStatusChange(SETTLED);
    heard.onStatusChange(PENDING);
    heard.onStatusChange(SETTLED);
    heard.onStatusChange(PENDING);
    expect(heard.get().round).toBe(2);
  });

  it('forgets the status of a crashed view, so no chip shows its last report, and keeps the round', () => {
    const heard = heardStatus();
    heard.onStatusChange(SETTLED);
    heard.onStatusChange(PENDING);
    heard.forget();
    expect(heard.get()).toEqual({ status: null, round: 1 });
  });
});

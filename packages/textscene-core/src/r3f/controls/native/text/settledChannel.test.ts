import { describe, expect, it, vi } from 'vitest';
import { createSettledPeek, fontWork } from './settledChannel';

describe('createSettledPeek', () => {
  it('tells no font work count while the peek runs, as a peek runs inside a React render', async () => {
    const peek = createSettledPeek<object, number>(
      () => {},
      () => {}
    );
    const told = vi.fn();
    const stop = fontWork.subscribe(told);
    peek({}, async () => 1);
    expect(told).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(told).toHaveBeenCalled());
    stop();
  });
});

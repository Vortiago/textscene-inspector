import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkCount } from './workCount';

const ends: Array<() => void> = [];
const work = createWorkCount();
function begin(): () => void {
  const end = work.begin();
  ends.push(end);
  return end;
}
afterEach(() => {
  ends.splice(0).forEach((end) => end());
});

describe('work count', () => {
  it('counts work from its start to its end', () => {
    const end = begin();
    expect(work.pending()).toBe(1);
    end();
    expect(work.pending()).toBe(0);
  });

  it('ends a piece of work once, however often its end is called', () => {
    begin();
    const end = begin();
    end();
    end();
    expect(work.pending()).toBe(1);
  });

  it('notifies a subscriber on each change, until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = work.subscribe(listener);
    const end = begin();
    end();
    unsubscribe();
    begin();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps one count apart from another', () => {
    const other = createWorkCount();
    begin();
    expect(other.pending()).toBe(0);
  });
});

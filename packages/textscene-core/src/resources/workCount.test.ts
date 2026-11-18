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

  it('notifies a subscriber once for the changes of one task, until it unsubscribes', async () => {
    const listener = vi.fn();
    const unsubscribe = work.subscribe(listener);
    const end = begin();
    begin();
    await Promise.resolve();
    end();
    await Promise.resolve();
    unsubscribe();
    begin();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('notifies no subscriber while the change runs, as work begins inside a React render', () => {
    const listener = vi.fn();
    work.subscribe(listener);
    begin();
    expect(work.pending()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps one count apart from another', () => {
    const other = createWorkCount();
    begin();
    expect(other.pending()).toBe(0);
  });
});

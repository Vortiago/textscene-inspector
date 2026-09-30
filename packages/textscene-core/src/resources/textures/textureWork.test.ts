import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginTextureWork, pendingTextureWork, subscribeTextureWork } from './textureWork';

const ends: Array<() => void> = [];
function begin(): () => void {
  const end = beginTextureWork();
  ends.push(end);
  return end;
}
afterEach(() => {
  ends.splice(0).forEach((end) => end());
});

describe('texture work', () => {
  it('counts work from its start to its end', () => {
    const end = begin();
    expect(pendingTextureWork()).toBe(1);
    end();
    expect(pendingTextureWork()).toBe(0);
  });

  it('ends a piece of work once, however often its end is called', () => {
    begin();
    const end = begin();
    end();
    end();
    expect(pendingTextureWork()).toBe(1);
  });

  it('notifies a subscriber on each change, until it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTextureWork(listener);
    const end = begin();
    end();
    unsubscribe();
    begin();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

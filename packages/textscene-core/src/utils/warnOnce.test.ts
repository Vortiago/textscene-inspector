import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import { warnOnce } from './warnOnce';

describe('warnOnce', () => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

  afterEach(() => warn.mockClear());

  it('warns the first time an owner asks for a key', () => {
    warnOnce({}, 'key', 'message');

    expect(warn).toHaveBeenCalledWith('message');
  });

  it('stays quiet the second time', () => {
    const owner = {};

    warnOnce(owner, 'key', 'message');
    warnOnce(owner, 'key', 'message');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns again for another key of the same owner', () => {
    const owner = {};

    warnOnce(owner, 'first', 'one');
    warnOnce(owner, 'second', 'two');

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('warns again for the same key of another owner', () => {
    warnOnce({}, 'key', 'message');
    warnOnce({}, 'key', 'message');

    expect(warn).toHaveBeenCalledTimes(2);
  });
});

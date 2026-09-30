import { describe, expect, it } from 'vitest';
import { fromJobError, readJobRequest, toJobError } from './protocol';

describe('readJobRequest', () => {
  it('reads an id, a job name and the input', () => {
    expect(readJobRequest({ id: 1, job: 'noise-texture-2d', input: { a: 1 } })).toEqual({
      id: 1,
      job: 'noise-texture-2d',
      input: { a: 1 },
    });
  });

  it('refuses a message whose id is not a number', () => {
    expect(readJobRequest({ id: '1', job: 'noise-texture-2d', input: null })).toBeNull();
  });

  it('refuses a primitive', () => {
    expect(readJobRequest(42)).toBeNull();
  });
});

describe('toJobError', () => {
  it('keeps an error\'s name and message', () => {
    expect(toJobError(new RangeError('too big'))).toEqual({ name: 'RangeError', message: 'too big' });
  });

  it('describes a thrown non-error as an Error', () => {
    expect(toJobError('boom')).toEqual({ name: 'Error', message: 'boom' });
  });
});

describe('fromJobError', () => {
  it('rebuilds a RangeError as a RangeError', () => {
    const error = fromJobError({ name: 'RangeError', message: 'too big' });
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toBe('too big');
  });

  it('rebuilds any other error as an Error that keeps its name', () => {
    const error = fromJobError({ name: 'TypeError', message: 'bad' });
    expect(error).not.toBeInstanceOf(RangeError);
    expect(error.name).toBe('TypeError');
  });
});

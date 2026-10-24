import { describe, expect, it } from 'vitest';
import { subscribeToNothing } from './subscribeToNothing';

describe('subscribeToNothing', () => {
  it('hands back an unsubscribe that can be called any number of times', () => {
    const unsubscribe = subscribeToNothing();

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });
});

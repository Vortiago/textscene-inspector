import { describe, expect, it } from 'vitest';
import {
  NODE_PHYSICS_INTERPOLATION_MODE_NAMES,
  NODE_PROCESS_MODE_NAMES,
  NODE_PROCESS_THREAD_GROUP_NAMES,
  NODE_PROCESS_THREAD_MESSAGES_NAMES,
} from './node.js';

describe('NODE_PROCESS_MODE_NAMES', () => {
  it('names the five modes by their constants (node.h:75-81, 4.7.2 :79-85)', () => {
    expect(NODE_PROCESS_MODE_NAMES).toEqual({
      0: 'PROCESS_MODE_INHERIT',
      1: 'PROCESS_MODE_PAUSABLE',
      2: 'PROCESS_MODE_WHEN_PAUSED',
      3: 'PROCESS_MODE_ALWAYS',
      4: 'PROCESS_MODE_DISABLED',
    });
  });
});

describe('NODE_PROCESS_THREAD_GROUP_NAMES', () => {
  it('names the three groups by their constants (node.h:83-87, 4.7.2 :87-91)', () => {
    expect(NODE_PROCESS_THREAD_GROUP_NAMES).toEqual({
      0: 'PROCESS_THREAD_GROUP_INHERIT',
      1: 'PROCESS_THREAD_GROUP_MAIN_THREAD',
      2: 'PROCESS_THREAD_GROUP_SUB_THREAD',
    });
  });
});

describe('NODE_PROCESS_THREAD_MESSAGES_NAMES', () => {
  it('names the two bits the hint lists, not their union (node.h:89-93, 4.7.2 :93-97)', () => {
    expect(NODE_PROCESS_THREAD_MESSAGES_NAMES).toEqual({
      1: 'FLAG_PROCESS_THREAD_MESSAGES',
      2: 'FLAG_PROCESS_THREAD_MESSAGES_PHYSICS',
    });
  });
});

describe('NODE_PHYSICS_INTERPOLATION_MODE_NAMES', () => {
  it('names the three modes by their constants (node.h:95-99, 4.7.2 :99-103)', () => {
    expect(NODE_PHYSICS_INTERPOLATION_MODE_NAMES).toEqual({
      0: 'PHYSICS_INTERPOLATION_MODE_INHERIT',
      1: 'PHYSICS_INTERPOLATION_MODE_ON',
      2: 'PHYSICS_INTERPOLATION_MODE_OFF',
    });
  });
});

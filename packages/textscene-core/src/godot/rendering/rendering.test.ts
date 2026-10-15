import { describe, expect, it } from 'vitest';
import { SHADOW_CASTING_SETTING_NAMES } from './rendering';

describe('SHADOW_CASTING_SETTING_NAMES', () => {
  it('names each ShadowCastingSetting by its integer, and nothing else', () => {
    expect(SHADOW_CASTING_SETTING_NAMES).toEqual({ 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' });
  });
});

/**
 * ReferenceRect self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter into `ControlComponentRegistry`.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ReferenceRect } from './Component';

describe('ReferenceRect index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('ReferenceRect')).toBe(ReferenceRect);
  });
});

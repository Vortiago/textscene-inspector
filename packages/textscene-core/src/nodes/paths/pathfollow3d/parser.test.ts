import { describe, expect, it } from 'vitest';
import { parsePathFollow3D } from './parser';
import { RotationMode } from './types';
import { heading } from '../../../parser/testing/parserKit';

describe('parsePathFollow3D', () => {
  it('defaults rotation_mode to XYZ, booleans to Godot defaults, offsets to 0', () => {
    const props = parsePathFollow3D(heading('PathFollow3D', { name: 'Follow' }), {});
    expect(props.rotation_mode).toBe(RotationMode.XYZ);
    expect(props.cubic_interp).toBe(true);
    expect(props.loop).toBe(true);
    expect(props.tilt_enabled).toBe(true);
    expect(props.use_model_front).toBe(false);
    expect(props.h_offset).toBe(0);
    expect(props.v_offset).toBe(0);
    expect(props.progress).toBeUndefined();
    expect(props.progress_ratio).toBeUndefined();
  });

  it('reads explicit follow controls', () => {
    const props = parsePathFollow3D(heading('PathFollow3D', { name: 'Follow' }), {
      progress_ratio: '0.25',
      h_offset: '2',
      v_offset: '-1',
      rotation_mode: '0',
      loop: 'false',
      use_model_front: 'true',
    });
    expect(props.progress_ratio).toBeCloseTo(0.25, 5);
    expect(props.h_offset).toBe(2);
    expect(props.v_offset).toBe(-1);
    expect(props.rotation_mode).toBe(RotationMode.NONE);
    expect(props.loop).toBe(false);
    expect(props.use_model_front).toBe(true);
  });

  it('keeps progress when only progress is set (edge)', () => {
    const props = parsePathFollow3D(heading('PathFollow3D', { name: 'Follow' }), {
      progress: '4.5',
    });
    expect(props.progress).toBeCloseTo(4.5, 5);
    expect(props.progress_ratio).toBeUndefined();
  });
});

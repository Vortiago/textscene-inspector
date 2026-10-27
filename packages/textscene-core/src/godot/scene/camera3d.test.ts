import { describe, expect, it } from 'vitest';
import {
  CAMERA_3D_KEEP_ASPECT_HINT_NAMES,
  CAMERA_3D_KEEP_ASPECT_NAMES,
  CAMERA_3D_PROJECTION_HINT_NAMES,
  CAMERA_3D_PROJECTION_NAMES,
  electViewportCamera,
} from './camera3d.js';

describe('Camera3D enum label tables', () => {
  it('names the projection types without their PROJECTION_ prefix (camera_3d.h:44-48)', () => {
    expect(CAMERA_3D_PROJECTION_NAMES).toEqual({ 0: 'PERSPECTIVE', 1: 'ORTHOGONAL', 2: 'FRUSTUM' });
  });

  it('names the two keep-aspect modes, which have no third member (camera_3d.h:50-53)', () => {
    expect(CAMERA_3D_KEEP_ASPECT_NAMES).toEqual({ 0: 'KEEP_WIDTH', 1: 'KEEP_HEIGHT' });
  });

  it('labels the projection types as the inspector hint does (camera_3d.cpp:680)', () => {
    expect(CAMERA_3D_PROJECTION_HINT_NAMES).toEqual({ 0: 'Perspective', 1: 'Orthogonal', 2: 'Frustum' });
  });

  it('labels the keep-aspect modes as the inspector hint does (camera_3d.cpp:672)', () => {
    expect(CAMERA_3D_KEEP_ASPECT_HINT_NAMES).toEqual({ 0: 'Keep Width', 1: 'Keep Height' });
  });
});

describe('electViewportCamera', () => {
  const camera = (name: string, current = false) => ({ name, current });
  const elect = (cameras: { name: string; current: boolean }[]) =>
    electViewportCamera(cameras, (candidate) => candidate.current);

  it('answers none for a viewport without a camera', () => {
    expect(elect([])).toBeNull();
  });

  it('answers the first camera when none is current (camera_3d.cpp:189-190, first_camera)', () => {
    const [first, second] = [camera('first'), camera('second')];
    expect(elect([first, second])).toBe(first);
  });

  it('answers a current camera over an earlier one (camera_3d.cpp:190)', () => {
    const current = camera('current', true);
    expect(elect([camera('first'), current])).toBe(current);
  });

  it('answers the last of two current cameras, since a claim overwrites (viewport.cpp:4565)', () => {
    const last = camera('last', true);
    expect(elect([camera('early', true), last])).toBe(last);
  });
});

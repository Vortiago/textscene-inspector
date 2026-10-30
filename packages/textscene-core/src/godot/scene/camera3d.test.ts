import { describe, expect, it } from 'vitest';
import {
  CAMERA_3D_KEEP_ASPECT_HINT_NAMES,
  CAMERA_3D_KEEP_ASPECT_NAMES,
  CAMERA_3D_PROJECTION_HINT_NAMES,
  CAMERA_3D_PROJECTION_NAMES,
  electCameraOfViewport,
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

describe('electCameraOfViewport', () => {
  const camera = (viewport: string | null, current = false) => ({ viewport, current });

  it('elects among the cameras of that viewport only', () => {
    const mine = camera('Root/View');
    expect(electCameraOfViewport([camera('Root/Other'), mine], 'Root/View')).toBe(mine);
  });

  it('leaves a camera of a nested viewport to the nested viewport', () => {
    const nested = camera('Root/View/Inner', true);
    expect(electCameraOfViewport([nested], 'Root/View')).toBeNull();
    expect(electCameraOfViewport([nested], 'Root/View/Inner')).toBe(nested);
  });

  it('elects among the cameras of the root viewport for a null path', () => {
    const root = camera(null);
    expect(electCameraOfViewport([camera('Root/View', true), root], null)).toBe(root);
  });

  it('prefers the last current camera of the viewport', () => {
    const current = camera('Root/View', true);
    expect(electCameraOfViewport([camera('Root/View'), current, camera('Root/View')], 'Root/View')).toBe(
      current
    );
  });

  it('answers none for a viewport without a camera', () => {
    expect(electCameraOfViewport([], null)).toBeNull();
  });

  it('answers the first camera when none is current (camera_3d.cpp:189-190, first_camera)', () => {
    const [first, second] = [camera('Root/View'), camera('Root/View')];
    expect(electCameraOfViewport([first, second], 'Root/View')).toBe(first);
  });

  it('answers the last of two current cameras, since a claim overwrites (viewport.cpp:4565)', () => {
    const last = camera('Root/View', true);
    expect(electCameraOfViewport([camera('Root/View', true), last], 'Root/View')).toBe(last);
  });
});

/**
 * Godot's editor camera against its source's own sentence: "These rotations place the camera in
 * +X +Y +Z, aka south east, facing north west." A wrong basis order can still hit the octant, so
 * the elevation and azimuth are pinned to hand-computed values too.
 */
import { describe, expect, it } from 'vitest';
import {
  EDITOR_CAMERA_DISTANCE,
  EDITOR_CAMERA_FOV,
  editorCameraDirection,
  editorCameraPosition,
} from './godotEditorCamera';

describe('editorCameraDirection', () => {
  it('places the camera in +X +Y +Z, as Godot’s comment says', () => {
    const dir = editorCameraDirection();
    expect(dir.x).toBeGreaterThan(0);
    expect(dir.y).toBeGreaterThan(0);
    expect(dir.z).toBeGreaterThan(0);
  });

  it('looks down at 28.65 degrees — asin(sin(0.5)) in degrees', () => {
    // x_rot = 0.5 rad tilts the +Z step up by sin(0.5) = 0.4794.
    const elevation = Math.asin(editorCameraDirection().y) * (180 / Math.PI);
    expect(elevation).toBeCloseTo(28.6479, 3);
  });

  it('sits 28.65 degrees off the +Z axis, not on the 45 degree diagonal', () => {
    // The azimuth is what actually differs from an isometric-ish (1, k, 1):
    // Godot presents more of the scene's front face than its corner.
    const dir = editorCameraDirection();
    const azimuth = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    expect(azimuth).toBeCloseTo(28.6479, 3);
    expect(azimuth).not.toBeCloseTo(45, 0);
  });

  it('is a unit vector', () => {
    expect(editorCameraDirection().length()).toBeCloseTo(1, 9);
  });
});

describe('editorCameraPosition', () => {
  it('orbits the origin at Godot’s distance of 4', () => {
    const [x, y, z] = editorCameraPosition();
    expect(Math.hypot(x, y, z)).toBeCloseTo(EDITOR_CAMERA_DISTANCE, 6);
  });

  it('matches the hand-computed cursor position', () => {
    // dir * 4 = (0.4207, 0.4794, 0.7702) * 4
    expect(editorCameraPosition()[0]).toBeCloseTo(1.6829, 3);
    expect(editorCameraPosition()[1]).toBeCloseTo(1.9177, 3);
    expect(editorCameraPosition()[2]).toBeCloseTo(3.0806, 3);
  });
});

describe('EDITOR_CAMERA_FOV', () => {
  it('is Godot’s editor default, not three’s', () => {
    // editors/3d/default_fov is 70; three's PerspectiveCamera defaults to 50,
    // which is a visibly narrower view of the same scene.
    expect(EDITOR_CAMERA_FOV).toBe(70);
  });
});

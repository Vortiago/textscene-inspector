import { describe, expect, it } from 'vitest';
import { parseArgs } from './capture-ours.mjs';
import { freeCameraPath, lookAtTransformText, OUR_CAMERA_NAME, withFreeCamera } from './ourCamera.mjs';

describe('lookAtTransformText', () => {
  it('keeps the basis identity for a camera on +Z looking at the origin', () => {
    expect(lookAtTransformText([0, 0, 2], [0, 0, 0])).toBe('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2)');
  });

  it('turns a quarter about Y for a camera on +X, whose -Z faces the origin', () => {
    expect(lookAtTransformText([2, 0, 0], [0, 0, 0])).toBe(
      'Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 2, 0, 0)'
    );
  });

  it('refuses a camera straight above its target, where Y up has no side', () => {
    expect(() => lookAtTransformText([0, 3, 0], [0, 0, 0])).toThrow('looks along the up axis');
  });
});

describe('withFreeCamera', () => {
  it('appends a current Camera3D with the editor fov under the root', () => {
    const text = withFreeCamera('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n', {
      camera: [0, 0, 2],
    });

    expect(text).toContain(`[node name="${OUR_CAMERA_NAME}" type="Camera3D" parent="."]`);
    expect(text).toContain('fov = 70');
    expect(text).toContain('current = true');
  });
});

describe('freeCameraPath', () => {
  it('names the root node, not a child that sits before it in a header', () => {
    const text =
      '[gd_scene format=3]\n\n[node name="World" type="Node3D"]\n\n[node name="Mesh" type="Node3D" parent="."]\n';

    expect(freeCameraPath(text)).toBe('World/RefCamera');
  });

  it('refuses a scene text with no root', () => {
    expect(() => freeCameraPath('[gd_scene format=3]\n')).toThrow('expected a root');
  });
});

describe('ref:ours camera flags', () => {
  it('reads --camera and --look-at as three numbers each', () => {
    const args = parseArgs(['a.tscn', '--camera', '0,0,2', '--look-at', '0,1,0']);

    expect(args.camera).toEqual([0, 0, 2]);
    expect(args.lookAt).toEqual([0, 1, 0]);
  });

  it('refuses --look-at without --camera', () => {
    expect(() => parseArgs(['a.tscn', '--look-at', '0,1,0'])).toThrow('--look-at needs --camera');
  });

  it('refuses a camera of two numbers', () => {
    expect(() => parseArgs(['a.tscn', '--camera', '0,2'])).toThrow(
      '--camera needs three comma-separated numbers'
    );
  });
});

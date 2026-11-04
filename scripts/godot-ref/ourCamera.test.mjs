import { describe, expect, it } from 'vitest';
import { parseArgs } from './capture-ours.mjs';
import {
  freeCameraPath,
  lookAtTransformText,
  OUR_CAMERA_NAME,
  sceneCameraPath,
  withFreeCamera,
} from './ourCamera.mjs';

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

describe('sceneCameraPath', () => {
  const root = '[gd_scene format=3]\n\n[node name="World" type="Node3D"]\n';
  const text = `${root}\n[node name="Rig" type="Node3D" parent="."]\n\n[node name="Camera" type="Camera3D" parent="Rig"]\n`;

  it('puts the root node before a path below it, as the previewer reports a camera', () => {
    expect(sceneCameraPath(text, 'Rig/Camera')).toBe('World/Rig/Camera');
  });

  it('keeps a path that already starts at the root, as `ref:godot` takes both', () => {
    expect(sceneCameraPath(text, 'World/Rig/Camera')).toBe('World/Rig/Camera');
  });

  it('reads a path below the root first, as `_find_camera` does (edge case)', () => {
    const scene = `${root}\n[node name="World" type="Node3D" parent="."]\n\n[node name="Camera" type="Camera3D" parent="World"]\n`;

    expect(sceneCameraPath(scene, 'World/Camera')).toBe('World/World/Camera');
  });

  it('keeps a path into an instanced scene, whose nodes the scene text does not list', () => {
    const scene = `${root}\n[node name="Car" parent="." instance=ExtResource("1_car")]\n`;

    expect(sceneCameraPath(scene, 'Car/Camera')).toBe('World/Car/Camera');
  });

  it('falls back to the first Camera3D for a path that names none, as `ref:godot` does', () => {
    const scene = `${text}\n[node name="Mesh" type="MeshInstance3D" parent="."]\n`;

    expect([sceneCameraPath(scene, 'Rig/Camra'), sceneCameraPath(scene, 'Mesh')]).toEqual([
      'World/Rig/Camera',
      'World/Rig/Camera',
    ]);
  });

  it('picks the first Camera3D in tree order without a path, as `ref:godot` does', () => {
    const scene = `${text}\n[node name="Other" type="Camera3D" parent="."]\n`;

    expect(sceneCameraPath(scene, true)).toBe('World/Rig/Camera');
  });

  it('picks a Camera3D root, as `ref:godot` checks the root first', () => {
    const scene = '[gd_scene format=3]\n\n[node name="Eye" type="Camera3D"]\n';

    expect(sceneCameraPath(scene, true)).toBe('Eye');
  });

  it('finds a Camera3D whose header lists parent before type', () => {
    const scene = `${root}\n[node name="Eye" parent="." type="Camera3D" unique_id=7]\n`;

    expect(sceneCameraPath(scene, true)).toBe('World/Eye');
  });

  it('answers null for a scene with no Camera3D, as `ref:godot` then keeps the editor orbit', () => {
    expect(sceneCameraPath(root, true)).toBeNull();
  });
});

describe('ref:ours camera flags', () => {
  it('refuses --scene-camera with --2d, as the previewer draws no scene Camera2D (error case)', () => {
    expect(() => parseArgs(['a.tscn', '--2d', '--scene-camera'])).toThrow(
      '--scene-camera needs a 3D capture'
    );
  });

  it("reads --scene-camera's node path", () => {
    expect(parseArgs(['a.tscn', '--scene-camera', 'Camera']).sceneCamera).toBe('Camera');
  });

  it('reads --scene-camera without a path, as `ref:godot` does', () => {
    expect(parseArgs(['a.tscn', '--scene-camera', '--probe', '1,2']).sceneCamera).toBe(true);
  });

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

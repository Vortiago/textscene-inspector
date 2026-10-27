/**
 * <Camera3D> draws Godot's editor gizmo for every node, faint while it is not selected, and nothing
 * with the Gizmos toggle off (`camera_3d_gizmo_plugin.cpp:258`): the pyramid, the box or the frustum
 * of `cameraGizmoLines`, in the node's local space and the camera colour.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { GizmoScene, lineMaterials, lineOpacities, type TestRenderer } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { Camera3D } from './Component';
import { cameraGizmoLines } from './gizmoLines';
import { fitToAspect } from './projectionFit';
import type { Camera3DProperties } from './types';

const NODE_PATH = 'Cam';

/** `editors/3d_gizmos/gizmo_colors/camera` (`editor_settings.cpp:883`). */
const GIZMO_COLOUR = godotColorToLinear({ r: 0.8, g: 0.4, b: 0.8 });

/** A camera at Godot's defaults, with the given properties. */
function cameraNode(overrides: Partial<Camera3DProperties> = {}): TscnNode {
  const properties: Camera3DProperties = {
    name: NODE_PATH,
    projection: Camera3DProjectionType.PERSPECTIVE,
    fov: 75,
    size: 1,
    near: 0.05,
    far: 4000,
    keep_aspect: Camera3DKeepAspect.KEEP_HEIGHT,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 0xfffff,
    doppler_tracking: 0,
    ...overrides,
  };
  return { rawProperties: {}, name: NODE_PATH, type: 'Camera3D', children: [], properties };
}

/** A transform with no rotation, placed at `origin`. */
function translation(x: number, y: number, z: number) {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x, y, z },
  };
}

async function render(
  selectedPath: string | null,
  node = cameraNode(),
  showGizmos = true,
  instantiated = false
) {
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath={NODE_PATH}
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      <Camera3D node={node} />
    </GizmoScene>
  );
}

/** The one gizmo line object of the camera. */
function gizmoLine(renderer: TestRenderer): THREE.LineSegments {
  const lines = renderer.scene.findAllByType('LineSegments');
  expect(lines).toHaveLength(1);
  return instanceAs<THREE.LineSegments>(lines[0]!);
}

function positionsOf(line: THREE.LineSegments): number[] {
  return Array.from(line.geometry.getAttribute('position').array);
}

const GIZMO_CASE: GizmoNodeCase = {
  nodePath: NODE_PATH,
  drawnFor: 'every-node',
  mount: ({ selectedPath, showGizmos, instantiated }) =>
    render(selectedPath, cameraNode(), showGizmos, instantiated),
};
describeGizmoToggle('<Camera3D>', GIZMO_CASE);
describeInstantiatedGizmo('<Camera3D>', GIZMO_CASE);

describe('<Camera3D> gizmo', () => {
  it('draws no THREE.CameraHelper', async () => {
    const renderer = await render(NODE_PATH);
    let helpers = 0;
    renderer.scene.instance.traverse((object) => {
      if (object instanceof THREE.CameraHelper) helpers += 1;
    });
    expect(helpers).toBe(0);
  });

  it('draws in the camera colour (0.8, 0.4, 0.8) at the colour alpha 1 when the node is selected', async () => {
    const renderer = await render(NODE_PATH);
    expect(lineOpacities(renderer)).toEqual([1]);
    expect(lineMaterials(renderer)[0]!.color.toArray()).toEqual(GIZMO_COLOUR.toArray());
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the same lines at 0.3 of that alpha when %s', async (_label, selectedPath) => {
    const renderer = await render(selectedPath);
    expect(lineOpacities(renderer)[0]).toBeCloseTo(0.3, 10);
    expect(lineMaterials(renderer)[0]!.color.toArray()).toEqual(GIZMO_COLOUR.toArray());
  });

  it("draws Godot's pyramid for the default lens over the 16:9 aspect a camera mounts at", async () => {
    const renderer = await render(NODE_PATH);
    const expected = cameraGizmoLines({
      lens: {
        projection: Camera3DProjectionType.PERSPECTIVE,
        fov: 75,
        size: 1,
        keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
        frustumOffset: { x: 0, y: 0 },
      },
      near: 0.05,
      aspect: 16 / 9,
    });
    expect(positionsOf(gizmoLine(renderer))).toEqual(Array.from(expected));
  });

  it('draws the box of an orthogonal camera, whose lines reach 1 unit behind it', async () => {
    const node = cameraNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 5 });
    const positions = positionsOf(gizmoLine(await render(NODE_PATH, node)));
    expect(positions).toHaveLength(19 * 6);
    expect(Math.min(...positions.filter((_, index) => index % 3 === 2))).toBe(-1);
  });

  it('redraws when fov changes', async () => {
    const renderer = await render(NODE_PATH);
    const before = positionsOf(gizmoLine(renderer));
    await renderer.update(
      <GizmoScene nodePath={NODE_PATH} selectedPath={NODE_PATH}>
        <Camera3D node={cameraNode({ fov: 30 })} />
      </GizmoScene>
    );
    expect(positionsOf(gizmoLine(renderer))).not.toEqual(before);
  });

  it('redraws for the aspect that a viewport fits the camera to', async () => {
    const renderer = await render(NODE_PATH);
    const camera = instanceAs<THREE.PerspectiveCamera>(renderer.scene.findByType('PerspectiveCamera'));
    fitToAspect(camera, 0.5);
    await ReactThreeTestRenderer.act(async () => renderer.advanceFrames(1, 16));
    const portrait = cameraGizmoLines({
      lens: {
        projection: Camera3DProjectionType.PERSPECTIVE,
        fov: 75,
        size: 1,
        keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
        frustumOffset: { x: 0, y: 0 },
      },
      near: 0.05,
      aspect: 0.5,
    });
    expect(positionsOf(gizmoLine(renderer))).toEqual(Array.from(portrait));
  });

  describe('place', () => {
    /** The world position of the origin of the gizmo lines, which is the apex of the pyramid. */
    async function gizmoOrigin(node: TscnNode, ancestorAt?: [number, number, number]) {
      const camera = ancestorAt ? (
        <group position={ancestorAt}>
          <Camera3D node={node} />
        </group>
      ) : (
        <Camera3D node={node} />
      );
      const renderer = await ReactThreeTestRenderer.create(
        <GizmoScene nodePath={NODE_PATH} selectedPath={NODE_PATH}>
          {camera}
        </GizmoScene>
      );
      const scene = renderer.scene.instance as THREE.Scene;
      scene.updateMatrixWorld(true);
      return new THREE.Vector3().setFromMatrixPosition(gizmoLine(renderer).matrixWorld);
    }

    it('sits at the node transform', async () => {
      const origin = await gizmoOrigin(cameraNode({ transform: translation(1, 2, 3) }));
      expect(origin.toArray()).toEqual([1, 2, 3]);
    });

    it('is transformed once by a transformed ancestor', async () => {
      const origin = await gizmoOrigin(cameraNode({ transform: translation(1, 2, 3) }), [10, 5, -3]);
      expect(origin.toArray()).toEqual([11, 7, 0]);
    });

    it('stays on the node when h_offset and v_offset move the camera (`camera_3d.cpp` get_camera_transform)', async () => {
      const node = cameraNode({ transform: translation(1, 2, 3), h_offset: 4, v_offset: 5 });
      expect((await gizmoOrigin(node)).toArray()).toEqual([1, 2, 3]);
    });
  });
});

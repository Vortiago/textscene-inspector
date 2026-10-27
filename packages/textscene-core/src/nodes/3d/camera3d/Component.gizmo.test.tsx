/**
 * <Camera3D> draws Godot's editor gizmo for every node, faint while it is not selected, and nothing
 * with the Gizmos toggle off (`camera_3d_gizmo_plugin.cpp:258`): the lines of `cameraGizmoLines`, in
 * the node's local space and the camera colour.
 */
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { identityTransform3D } from '../../../godot/math/transform3d';
import { ViewportSizeProvider } from '../../../r3f/contexts/ViewportSizeContext';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { GizmoScene, lineMaterials, lineOpacities, type TestRenderer } from '../../../r3f/testing/GizmoScene';
import {
  describeGizmoToggle,
  describeInstantiatedGizmo,
  type GizmoNodeCase,
} from '../../../r3f/testing/gizmoContract';
import { Camera3DKeepAspect, Camera3DProjectionType } from '../../../godot/scene/camera3d';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { makeCameraNode } from './cameraNode.testkit';
import { Camera3DInWorld } from './Camera3DInWorld.testkit';
import { cameraGizmoLines } from './gizmoLines';

const NODE_PATH = 'Cam';

/** `editors/3d_gizmos/gizmo_colors/camera` (`editor_settings.cpp:883`). */
const GIZMO_COLOUR = godotColorToLinear({ r: 0.8, g: 0.4, b: 0.8 });

/** The lines of the default camera for `aspect`. */
function defaultLines(aspect = 16 / 9): number[] {
  const lens = {
    projection: Camera3DProjectionType.PERSPECTIVE,
    fov: 75,
    size: 1,
    keepAspect: Camera3DKeepAspect.KEEP_HEIGHT,
    frustumOffset: { x: 0, y: 0 },
  };
  return Array.from(cameraGizmoLines({ lens, near: 0.05, aspect }));
}

interface Place {
  selectedPath?: string | null;
  node?: TscnNode;
  showGizmos?: boolean;
  instantiated?: boolean;
  /** Puts the camera under a group at this position. */
  ancestorAt?: [number, number, number];
  /** Puts the camera in a viewport of this size, as a SubViewport does. */
  viewportSize?: { x: number; y: number };
}

function camera(
  node: TscnNode,
  ancestorAt?: Place['ancestorAt'],
  viewportSize?: Place['viewportSize']
): ReactNode {
  const mounted = <Camera3DInWorld node={node} />;
  const placed = ancestorAt ? <group position={ancestorAt}>{mounted}</group> : mounted;
  return viewportSize ? <ViewportSizeProvider size={viewportSize}>{placed}</ViewportSizeProvider> : placed;
}

async function render({
  selectedPath = NODE_PATH,
  node = makeCameraNode(),
  showGizmos = true,
  instantiated = false,
  ancestorAt,
  viewportSize,
}: Place = {}) {
  return ReactThreeTestRenderer.create(
    <GizmoScene
      nodePath={NODE_PATH}
      selectedPath={selectedPath}
      showGizmos={showGizmos}
      instantiated={instantiated}
    >
      {camera(node, ancestorAt, viewportSize)}
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
  mount: ({ selectedPath, showGizmos, instantiated }) => render({ selectedPath, showGizmos, instantiated }),
};
describeGizmoToggle('<Camera3D>', GIZMO_CASE);
describeInstantiatedGizmo('<Camera3D>', GIZMO_CASE);

describe('<Camera3D> gizmo', () => {
  it('draws in the camera colour at the colour alpha 1 when the node is selected', async () => {
    const renderer = await render();
    expect(lineOpacities(renderer)).toEqual([1]);
    expect(lineMaterials(renderer)[0]!.color.toArray()).toEqual(GIZMO_COLOUR.toArray());
  });

  it.each([
    ['nothing is selected', null],
    ['another node is selected', 'Other'],
  ])('draws the same colour at 0.3 of that alpha when %s', async (_label, selectedPath) => {
    const renderer = await render({ selectedPath });
    expect(lineOpacities(renderer)[0]).toBeCloseTo(0.3, 10);
    expect(lineMaterials(renderer)[0]!.color.toArray()).toEqual(GIZMO_COLOUR.toArray());
  });

  it('draws the pyramid of the default lens over the default 1152 by 648 project viewport', async () => {
    expect(positionsOf(gizmoLine(await render()))).toEqual(defaultLines());
  });

  it('draws the box of an orthogonal camera, whose lines reach 1 unit behind it', async () => {
    const node = makeCameraNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 5 });
    const positions = positionsOf(gizmoLine(await render({ node })));
    expect(Math.min(...positions.filter((_, index) => index % 3 === 2))).toBe(-1);
  });

  it('redraws when fov changes', async () => {
    const renderer = await render();
    const before = positionsOf(gizmoLine(renderer));
    await renderer.update(
      <GizmoScene nodePath={NODE_PATH} selectedPath={NODE_PATH}>
        <Camera3DInWorld node={makeCameraNode({ fov: 30 })} />
      </GizmoScene>
    );
    expect(positionsOf(gizmoLine(renderer))).not.toEqual(before);
  });

  it('draws over the aspect of the viewport that holds the camera (`Node3DEditor::get_camera_viewport_size`)', async () => {
    const renderer = await render({ viewportSize: { x: 200, y: 400 } });
    expect(positionsOf(gizmoLine(renderer))).toEqual(defaultLines(0.5));
  });

  describe('place', () => {
    /** The world position of the origin of the gizmo lines, which is the apex of the pyramid. */
    async function gizmoOrigin(place: Place) {
      const renderer = await render(place);
      (renderer.scene.instance as THREE.Scene).updateMatrixWorld(true);
      return new THREE.Vector3().setFromMatrixPosition(gizmoLine(renderer).matrixWorld).toArray();
    }

    const atOneTwoThree = { ...identityTransform3D(), origin: { x: 1, y: 2, z: 3 } };

    it('sits at the node transform', async () => {
      expect(await gizmoOrigin({ node: makeCameraNode({ transform: atOneTwoThree }) })).toEqual([1, 2, 3]);
    });

    it('is transformed once by a transformed ancestor', async () => {
      const node = makeCameraNode({ transform: atOneTwoThree });
      expect(await gizmoOrigin({ node, ancestorAt: [10, 5, -3] })).toEqual([11, 7, 0]);
    });

    it('stays on the node when h_offset and v_offset move the camera (`camera_3d.cpp:253-258`)', async () => {
      const node = makeCameraNode({ transform: atOneTwoThree, h_offset: 4, v_offset: 5 });
      expect(await gizmoOrigin({ node })).toEqual([1, 2, 3]);
    });
  });
});

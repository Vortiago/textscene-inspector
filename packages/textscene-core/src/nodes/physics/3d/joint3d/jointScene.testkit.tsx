/**
 * Mounts a scene through the dispatcher with its Joint3D gizmos, so the bodies a joint names
 * register their objects, and reads the gizmo lines back. Test-only.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTscnContent } from '../../../../r3f/hooks/useParsedScene';
import { loaderServing } from '../../../../resources/testing/servingResourceLoader';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import type { GizmoNodeCase } from '../../../../r3f/testing/gizmoContract';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import { TWO_BODY_ORIGINS } from './jointVertices.testkit';
import '../../../../r3f/nodes/index';
import '../../../node/index';
import '../../../base/node3d/index';
import '../staticbody3d/index';
import '../pinjoint3d/index';
import '../conetwistjoint3d/index';
import '../hingejoint3d/index';
import '../sliderjoint3d/index';
import '../generic6dofjoint3d/index';

/** The scene text of a transform at `(x, y, z)` with no rotation. */
function at({ x, y, z }: { x: number; y: number; z: number }): string {
  return `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, ${y}, ${z})`;
}

/** The text of a `[node]` with `type`, under `parent`, and its `key = value` lines. */
export function nodeText(
  name: string,
  type: string,
  parent: string,
  properties: Record<string, string> = {}
): string {
  const lines = Object.entries(properties).map(([key, value]) => `${key} = ${value}`);
  return [`[node name="${name}" type="${type}" parent="${parent}"]`, ...lines, ''].join('\n');
}

const SCENE_HEADER = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n';

interface MountOptions {
  selectedPath?: string | null;
  showGizmos?: boolean;
  /** The scene text after the header, one `[node]` per entry. */
  nodes: readonly string[];
  /** The text before the nodes. Defaults to a `Root` Node3D. */
  header?: string;
  /** Files the scene instances, by `res://` path. */
  files?: Record<string, string>;
}

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function jointSceneElement({
  nodes,
  header = SCENE_HEADER,
  files = {},
  selectedPath = null,
  showGizmos = true,
}: MountOptions) {
  const { sceneGraph, error } = parseTscnContent(header + nodes.join('\n'), 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  return (
    <DispatchedScene
      sceneGraph={sceneGraph}
      loader={loaderServing(files)}
      selectedPath={selectedPath}
      showGizmos={showGizmos}
    />
  );
}

async function settleFrames(renderer: Renderer) {
  await settleLoads();
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(2, 0.016);
  });
}

export async function mountJointScene(options: MountOptions) {
  const renderer = await ReactThreeTestRenderer.create(jointSceneElement(options));
  await settleFrames(renderer);
  return renderer;
}

/** Re-renders a mounted scene with the text of `options`, as a live edit of the file does. */
export async function updateJointScene(renderer: Renderer, options: MountOptions) {
  await ReactThreeTestRenderer.act(async () => {
    await renderer.update(jointSceneElement(options));
  });
  await settleFrames(renderer);
}

/** The geometry of each gizmo line object in draw order: it is rebuilt exactly when the line's positions change. */
export function drawnGeometries(renderer: Renderer): THREE.BufferGeometry[] {
  return renderer.scene
    .findAllByType('LineSegments')
    .map(({ instance }) => (instance as THREE.LineSegments).geometry);
}

interface DrawnLines {
  color: number[];
  opacity: number;
  positions: number[];
}

/** Each gizmo line object in draw order, with its linear colour, opacity and local positions. */
export function drawnLines(renderer: Renderer): DrawnLines[] {
  return renderer.scene.findAllByType('LineSegments').map(({ instance }) => {
    const line = instance as THREE.LineSegments;
    const material = line.material as THREE.LineBasicMaterial;
    return {
      color: material.color.toArray(),
      opacity: material.opacity,
      positions: Array.from(line.geometry.getAttribute('position').array),
    };
  });
}

const HOLDER_FILE = 'res://holder.tscn';
const HOLDER_HEADER =
  `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="${HOLDER_FILE}" id="1"]\n\n` +
  '[node name="Root" type="Node3D"]\n\n';

/** Both body paths of a joint laid out by {@link twoBodyScene}. */
export const BOTH_BODIES = { node_a: 'NodePath("../BodyA")', node_b: 'NodePath("../BodyB")' };

/**
 * A `Joint` of `type` with `jointProperties`, and two StaticBody3D nodes `BodyA` and `BodyB`, all under
 * `parent`, placed at {@link TWO_BODY_ORIGINS}.
 */
export function twoBodyScene(type: string, jointProperties: Record<string, string>, parent = '.'): string[] {
  return [
    nodeText('Joint', type, parent, { transform: at(TWO_BODY_ORIGINS.joint), ...jointProperties }),
    nodeText('BodyA', 'StaticBody3D', parent, { transform: at(TWO_BODY_ORIGINS.bodyA) }),
    nodeText('BodyB', 'StaticBody3D', parent, { transform: at(TWO_BODY_ORIGINS.bodyB) }),
  ];
}

/** A joint of `type` with two bodies, once in the edited scene and once inside a locked instance. */
export function jointGizmoCase(type: string, properties: Record<string, string>): GizmoNodeCase {
  const nodes = (parent: string) => twoBodyScene(type, { ...BOTH_BODIES, ...properties }, parent);
  const holder = '[gd_scene format=3]\n\n[node name="Holder" type="Node3D"]\n\n' + nodes('.').join('\n');
  return {
    nodePath: 'Root/Joint',
    drawnFor: 'every-node',
    mount: ({ selectedPath, showGizmos, instantiated }) =>
      instantiated
        ? mountJointScene({
            header: HOLDER_HEADER,
            nodes: ['[node name="Holder" parent="." instance=ExtResource("1")]\n'],
            files: { [HOLDER_FILE]: holder },
            selectedPath: selectedPath === null ? null : 'Root/Holder/Joint',
            showGizmos,
          })
        : mountJointScene({ nodes: nodes('.'), selectedPath, showGizmos }),
  };
}

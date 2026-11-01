/**
 * Mounts a scene through the dispatcher with its Joint3D gizmos, so the bodies a joint names
 * register their objects, and reads the gizmo lines back. Test-only.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { describe, expect, it } from 'vitest';
import { parseTscnContent } from '../../../../r3f/hooks/useParsedScene';
import { loaderServing } from '../../../../resources/testing/servingResourceLoader';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import type { GizmoNodeCase } from '../../../../r3f/testing/gizmoContract';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import '../../../../r3f/nodes/index';
import '../../../node/index';
import '../../../base/node3d/index';
import '../staticbody3d/index';
import '../pinjoint3d/index';
import '../conetwistjoint3d/index';
import '../hingejoint3d/index';
import '../sliderjoint3d/index';
import { EXPECTED_PART_COLOURS } from './jointVertices.testkit';

/** A transform of a node at `(x, y, z)` with no rotation. */
function at(x: number, y: number, z: number): string {
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

export async function mountJointScene({
  nodes,
  header = SCENE_HEADER,
  files = {},
  selectedPath = null,
  showGizmos = true,
}: MountOptions) {
  const { sceneGraph, error } = parseTscnContent(header + nodes.join('\n'), 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={sceneGraph}
      loader={loaderServing(files)}
      selectedPath={selectedPath}
      showGizmos={showGizmos}
    />
  );
  await settleLoads();
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(2, 0.016);
  });
  return renderer;
}

interface DrawnLines {
  color: number[];
  opacity: number;
  positions: number[];
}

/** Each gizmo line object in draw order, with its linear colour, opacity and local positions. */
export function drawnLines(renderer: Awaited<ReturnType<typeof mountJointScene>>): DrawnLines[] {
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
 * A `Joint` of `type` with `jointProperties`, and two StaticBody3D nodes `BodyA` at (2, 1, -1) and
 * `BodyB` at (-1, 0.5, 2), all under `parent`. The joint sits at (0.5, 0, 0.5).
 */
export function twoBodyScene(type: string, jointProperties: Record<string, string>, parent = '.'): string[] {
  return [
    nodeText('Joint', type, parent, { transform: at(0.5, 0, 0.5), ...jointProperties }),
    nodeText('BodyA', 'StaticBody3D', parent, { transform: at(2, 1, -1) }),
    nodeText('BodyB', 'StaticBody3D', parent, { transform: at(-1, 0.5, 2) }),
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

type Part = keyof typeof EXPECTED_PART_COLOURS;

/** The parts a joint draws, in draw order, read from the colour of each line. */
export function drawnParts(renderer: Awaited<ReturnType<typeof mountJointScene>>): (Part | 'unknown')[] {
  return drawnLines(renderer).map(({ color }) => {
    const part = (Object.keys(EXPECTED_PART_COLOURS) as Part[]).find(
      (name) => JSON.stringify(EXPECTED_PART_COLOURS[name]) === JSON.stringify(color)
    );
    return part ?? 'unknown';
  });
}

interface BodyGating {
  both: Part[];
  onlyA: Part[];
  onlyB: Part[];
}

/**
 * The cases every joint shares: which parts draw for two bodies, one body or none, and for a path
 * that names no node or a node that is no Node3D (`joint_3d_gizmo_plugin.cpp:325-337`).
 */
export function describeJointBodyGating(label: string, type: string, parts: BodyGating) {
  const drawnPartsOf = async (properties: Record<string, string>) =>
    drawnParts(await mountJointScene({ nodes: twoBodyScene(type, properties) }));

  describe(`${label} bodies`, () => {
    it('draws its parts for two bodies', async () => {
      expect(await drawnPartsOf(BOTH_BODIES)).toEqual(parts.both);
    });

    it('draws its parts for node_a alone', async () => {
      expect(await drawnPartsOf({ node_a: BOTH_BODIES.node_a })).toEqual(parts.onlyA);
    });

    it('draws its parts for node_b alone', async () => {
      expect(await drawnPartsOf({ node_b: BOTH_BODIES.node_b })).toEqual(parts.onlyB);
    });

    it('draws nothing when neither body resolves', async () => {
      expect(await drawnPartsOf({})).toEqual([]);
    });

    it('draws nothing for a path that names no node', async () => {
      expect(await drawnPartsOf({ node_a: 'NodePath("../Nowhere")' })).toEqual([]);
    });

    it('draws nothing when the path names a node that is no Node3D', async () => {
      const nodes = [
        nodeText('Joint', type, '.', { node_a: 'NodePath("../Plain")' }),
        nodeText('Plain', 'Node', '.'),
      ];
      expect(drawnParts(await mountJointScene({ nodes }))).toEqual([]);
    });
  });
}

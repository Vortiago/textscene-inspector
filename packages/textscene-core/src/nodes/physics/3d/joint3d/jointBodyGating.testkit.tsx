/**
 * The cases every Joint3D gizmo shares: which parts draw for two bodies, one body or none, for a
 * path that names no node or a node that is no Node3D, and the faint opacity while unselected
 * (`joint_3d_gizmo_plugin.cpp:325-337`). Test-only.
 */
import { describe, expect, it } from 'vitest';
import { BOTH_BODIES, drawnLines, mountJointScene, nodeText, twoBodyScene } from './jointScene.testkit';
import { EXPECTED_PART_COLOURS } from './jointVertices.testkit';

type Part = keyof typeof EXPECTED_PART_COLOURS;

/** The parts a joint draws, in draw order, read from the colour of each line. */
function drawnParts(renderer: Awaited<ReturnType<typeof mountJointScene>>): (Part | 'unknown')[] {
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

export function describeJointBodyGating(label: string, type: string, parts: BodyGating) {
  const drawnPartsOf = async (properties: Record<string, string>) =>
    drawnParts(await mountJointScene({ nodes: twoBodyScene(type, properties) }));

  describe(`${label} bodies`, () => {
    it('draws every line at 0.3 of the selected opacity while unselected', async () => {
      const lines = drawnLines(await mountJointScene({ nodes: twoBodyScene(type, BOTH_BODIES) }));
      expect(lines).toHaveLength(parts.both.length);
      for (const { opacity } of lines) expect(opacity).toBeCloseTo(0.3, 10);
    });

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

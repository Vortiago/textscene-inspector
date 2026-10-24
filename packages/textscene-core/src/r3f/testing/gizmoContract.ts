/**
 * The cases every Godot gizmo-plugin node shares, so a node's test file states only what is its own.
 * A gizmo line is a `LineSegments`. Test-only: the `testing/` directories under `src` are excluded
 * from the build.
 */
import { describe, expect, it } from 'vitest';
import { godotColorToLinear } from '../godotColor';
import { INSTANTIATED_GIZMO_COLOUR } from '../gizmo/gizmoVariant';
import type { GizmoDrawnFor } from '../hooks/useGizmoState';
import { lineMaterials, lineOpacities, type TestRenderer } from './GizmoScene';

/** How a node's test file mounts the node: the toggle, the selection and the place it sits in. */
interface GizmoNodeMount {
  (place: { selectedPath: string | null; showGizmos: boolean; instantiated: boolean }): Promise<TestRenderer>;
}

export interface GizmoNodeCase {
  mount: GizmoNodeMount;
  /** The path of the node under test, which a selection of it names. */
  nodePath: string;
  /** Whether Godot draws the gizmo for every node, or only for the selected node. */
  drawnFor: GizmoDrawnFor;
}

const lineCount = (renderer: TestRenderer) => lineOpacities(renderer).length;

/** The Gizmos toggle and the selection, which decide whether the node's gizmo lines draw at all. */
export function describeGizmoToggle(label: string, { mount, nodePath, drawnFor }: GizmoNodeCase): void {
  describe(`${label} gizmo toggle`, () => {
    it('draws lines when the node is selected', async () => {
      expect(
        lineCount(await mount({ instantiated: false, selectedPath: nodePath, showGizmos: true }))
      ).toBeGreaterThan(0);
    });

    it.each([
      ['nothing is selected', null],
      ['another node is selected', 'Other'],
    ])(
      drawnFor === 'every-node' ? 'draws lines when %s' : 'draws no line when %s',
      async (_label, selectedPath) => {
        const drawn = lineCount(await mount({ instantiated: false, selectedPath, showGizmos: true })) > 0;
        expect(drawn).toBe(drawnFor === 'every-node');
      }
    );

    it.each([
      ['selected', nodePath],
      ['unselected', null],
    ])('draws no line with the Gizmos toggle off, %s', async (_label, selectedPath) => {
      expect(lineCount(await mount({ instantiated: false, selectedPath, showGizmos: false }))).toBe(0);
    });
  });
}

/**
 * Inside an instance the edited scene does not own, every line of the node draws in the instantiated
 * grey, at its alpha, times 0.3 while the node is not selected (`node_3d_editor_gizmos.cpp:907-920`).
 */
export function describeInstantiatedGizmo(label: string, { mount, nodePath, drawnFor }: GizmoNodeCase): void {
  const grey = godotColorToLinear(INSTANTIATED_GIZMO_COLOUR).toArray();
  const instantiated = { instantiated: true, showGizmos: true };

  describe(`${label} instantiated gizmo`, () => {
    it('draws every line grey at the instantiated alpha when the node is selected', async () => {
      const renderer = await mount({ ...instantiated, selectedPath: nodePath });
      expect(lineOpacities(renderer).length).toBeGreaterThan(0);
      for (const opacity of lineOpacities(renderer))
        expect(opacity).toBeCloseTo(INSTANTIATED_GIZMO_COLOUR.a, 10);
      for (const material of lineMaterials(renderer)) expect(material.color.toArray()).toEqual(grey);
    });

    // A selected-only gizmo has no unselected look to check.
    if (drawnFor === 'every-node') {
      it('draws every line at 0.3 of that alpha, 0.18, when the node is not selected', async () => {
        const renderer = await mount({ ...instantiated, selectedPath: null });
        expect(lineOpacities(renderer).length).toBeGreaterThan(0);
        for (const opacity of lineOpacities(renderer)) expect(opacity).toBeCloseTo(0.18, 10);
      });
    }
  });
}

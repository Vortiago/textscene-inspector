/**
 * Tests for the CSG own-geometry-degenerate rule
 * (`valid-csgshape3d-own-geometry`).
 *
 * A value-add rule, NOT a port of `CSGShape3D::get_configuration_warnings()`
 * (csg_shape.cpp:982, see linter.ts's docblock) — full port needs live CSG
 * boolean geometry no `.tscn` carries.
 *
 * Driven through `StrictTscnParser` and the rule's own `check`, not through
 * `Linter`: `Linter` imports the linter barrel, which loads every slice in the
 * repo and so cannot run while sibling slices are being written.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../linter/RuleRegistry';
import { csgShape3DDegenerateGeometryRule } from './linter';

const LEAVES = [
  'CSGCombiner3D',
  'CSGMesh3D',
  'CSGSphere3D',
  'CSGBox3D',
  'CSGCylinder3D',
  'CSGTorus3D',
  'CSGPolygon3D',
] as const;

/** Every diagnostic the rule reports for the first (and only) node in `content`. */
function warningsFor(content: string) {
  const { scene } = new StrictTscnParser().parse(content);
  if (!scene) throw new Error('fixture failed to parse');
  const node = scene.nodes[0];
  if (!node) throw new Error('fixture must contain a node');
  return csgShape3DDegenerateGeometryRule.check({ scene, node, properties: node.properties });
}

function csgScene(type: string, body: string): string {
  return `[gd_scene format=3]

[node name="Shape" type="${type}"]
${body}`;
}

describe('CSG own-geometry-degenerate rule', () => {
  it('registers one rule reaching all 7 concrete CSG types by name', () => {
    for (const leaf of LEAVES) {
      expect(ruleRegistry.getRulesForNodeType(leaf)).toContain(csgShape3DDegenerateGeometryRule);
    }
  });

  describe('CSGMesh3D', () => {
    it('warns when mesh is absent', () => {
      const warnings = warningsFor(csgScene('CSGMesh3D', ''));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.severity).toBe('info');
      expect(warnings[0]?.ruleName).toBe('csgmesh3d-requires-mesh');
    });

    it('stays silent when mesh is set', () => {
      expect(warningsFor(csgScene('CSGMesh3D', 'mesh = SubResource("m")\n'))).toEqual([]);
    });
  });

  describe('CSGPolygon3D', () => {
    it('stays silent when polygon is absent (default is a unit square, csg_shape.cpp:2808-2829)', () => {
      expect(warningsFor(csgScene('CSGPolygon3D', ''))).toEqual([]);
    });

    it('warns on a 2-point polygon', () => {
      const warnings = warningsFor(
        csgScene('CSGPolygon3D', 'polygon = PackedVector2Array(0, 0, 1, 0)\n')
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.ruleName).toBe('csgpolygon3d-insufficient-points');
      expect(warnings[0]?.message).toContain('2 point');
    });

    it('warns on an empty polygon', () => {
      const warnings = warningsFor(csgScene('CSGPolygon3D', 'polygon = PackedVector2Array()\n'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.ruleName).toBe('csgpolygon3d-insufficient-points');
    });

    it('warns on a 2-point polygon carrying a non-finite component', () => {
      // Counted, not decoded: `inf` is a component Godot loads and `rtos_fix`
      // writes, so this is the same 2-point polygon as the case above — but the
      // renderer decoder throws on it, and a rule routed through that decoder
      // loses the warning to the throw.
      const warnings = warningsFor(
        csgScene('CSGPolygon3D', 'polygon = PackedVector2Array(inf, 0, 1, 1)\n')
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.ruleName).toBe('csgpolygon3d-insufficient-points');
    });

    it('stays silent on a 3-point polygon', () => {
      expect(
        warningsFor(csgScene('CSGPolygon3D', 'polygon = PackedVector2Array(0, 0, 1, 0, 1, 1)\n'))
      ).toEqual([]);
    });
  });

  describe('CSGBox3D', () => {
    // `size` is PROPERTY_HINT_NONE and `set_size` does not clamp, so the brush
    // is always built with 12 faces: no size is degenerate.
    it('never emits, whatever the size', () => {
      for (const size of ['', 'size = Vector3(0, 0, 0)\n', 'size = Vector3(2, 0, 2)\n', 'size = Vector3(2, 2, 2)\n']) {
        expect(warningsFor(csgScene('CSGBox3D', size))).toEqual([]);
      }
    });
  });

  describe('CSGCombiner3D', () => {
    it('is applicable but never emits, since it has no geometry of its own', () => {
      expect(warningsFor(csgScene('CSGCombiner3D', ''))).toEqual([]);
    });
  });

  describe('CSGSphere3D / CSGCylinder3D / CSGTorus3D', () => {
    // csg_shape.cpp:1478 (Sphere, enforced-error) and each's own hinted-positive
    // linterParser.ts bounds (Cylinder radius/height, Torus inner/outer radius)
    // already cover a non-positive value — this rule stays quiet, not doubled up.
    it.each(['CSGSphere3D', 'CSGCylinder3D', 'CSGTorus3D'])(
      '%s: never emits from this rule regardless of its own radius/height properties',
      (type) => {
        expect(warningsFor(csgScene(type, 'radius = -1\nheight = 0\n'))).toEqual([]);
      }
    );
  });
});

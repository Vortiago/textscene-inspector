/**
 * CanvasItem clip-ancestry rule — `CanvasItem::get_configuration_warnings()`
 * (canvas_item.cpp:1297-1323): the node's OWN `clip_children_mode`, then an
 * ancestor walk for a clipping CanvasItem and a CanvasGroup.
 *
 * `Sprite2D`/`Node2D` stand in for the Node2D tree and `Label`/`Control` for
 * the Control tree — this rule's whole point is reaching both.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linter';
// Pulled in only for the one test asserting this rule fires ALONGSIDE
// CanvasGroup's own ancestor-clip rule, not for this rule's own behavior.
import '../../2d/canvasgroup/linter.js';

describe('CanvasItem clip-ancestry rule', () => {
  describe('own gate: clip_children_mode must be non-DISABLED first', () => {
    it('stays silent with no clip_children set at all, even under a clipping ancestor', () => {
      expectNoDiagnostic(
        scene(node('Node2D', { clip_children: 1 }, { name: 'Clipper' }), node('Sprite2D', {}, { parent: '.' })),
        { ruleName: 'canvasitem-ancestor-clips-children' }
      );
    });

    it('stays silent when own clip_children is explicitly DISABLED (0)', () => {
      expectNoDiagnostic(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Clipper' }),
          node('Sprite2D', { clip_children: 0 }, { parent: '.' })
        ),
        { ruleName: 'canvasitem-ancestor-clips-children' }
      );
    });
  });

  describe('ancestor clips children (canvasitem-ancestor-clips-children)', () => {
    it('passes at the scene root (no parent)', () => {
      expectNoDiagnostic(scene(node('Sprite2D', { clip_children: 1 })), {
        ruleName: 'canvasitem-ancestor-clips-children',
      });
    });

    it('passes when own clip_children is set but no ancestor clips', () => {
      expectNoDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('Sprite2D', { clip_children: 1 }, { parent: '.' })),
        { ruleName: 'canvasitem-ancestor-clips-children' }
      );
    });

    it('warns and names the ancestor when own clip_children is set and a Node2D ancestor also clips', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Clipper' }),
          node('Sprite2D', { clip_children: 2 }, { parent: '.' })
        ),
        { ruleName: 'canvasitem-ancestor-clips-children', severity: 'warning' }
      );
      expect(diagnostic.message).toContain('Clipper');
    });

    it('reaches the Control tree the same way (Label under a clipping Control)', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('Control', { clip_children: 1 }, { name: 'ClipPanel' }),
          node('Label', { clip_children: 1 }, { parent: '.' })
        ),
        { ruleName: 'canvasitem-ancestor-clips-children', severity: 'warning' }
      );
      expect(diagnostic.message).toContain('ClipPanel');
    });

    it('warns naming the NEAREST clipping ancestor when the chain passes through several', () => {
      // Both Far and Near independently trip this rule on THEMSELVES too (each
      // clips and each has a clipping ancestor of its own where applicable), so
      // this narrows to the Sprite2D leaf specifically.
      const diagnostic = lint(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Far' }),
          node('Node2D', { clip_children: 1 }, { name: 'Near', parent: '.' }),
          node('Sprite2D', { clip_children: 1 }, { parent: 'Near' })
        )
      ).find((d) => d.ruleName === 'canvasitem-ancestor-clips-children' && d.nodeType === 'Sprite2D');
      expect(diagnostic).toBeDefined();
      expect(diagnostic!.message).toContain('Near');
      expect(diagnostic!.message).not.toContain('Far');
    });
  });

  describe('ancestor is a CanvasGroup (canvasitem-ancestor-is-canvasgroup)', () => {
    it('stays silent when no ancestor is a CanvasGroup', () => {
      expectNoDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('Sprite2D', { clip_children: 1 }, { parent: '.' })),
        { ruleName: 'canvasitem-ancestor-is-canvasgroup' }
      );
    });

    it('warns and names the ancestor when nested under a CanvasGroup', () => {
      const diagnostic = expectDiagnostic(
        scene(node('CanvasGroup', {}, { name: 'Outer' }), node('Sprite2D', { clip_children: 1 }, { parent: '.' })),
        { ruleName: 'canvasitem-ancestor-is-canvasgroup', severity: 'warning' }
      );
      expect(diagnostic.message).toContain('Outer');
    });
  });

  it('fires alongside the existing CanvasGroup rules when a CanvasGroup itself sets clip_children under a clipping ancestor', () => {
    const diagnostics = lint(
      scene(
        node('Node2D', { clip_children: 1 }, { name: 'Clipper' }),
        node('CanvasGroup', { clip_children: 1 }, { name: 'Inner', parent: '.' })
      )
    ).filter((d) => d.nodeName === 'Inner');
    // Godot really does emit both here: CanvasGroup::get_configuration_warnings
    // opens with Node2D::get_configuration_warnings, which resolves to
    // CanvasItem's — so the CanvasItem-tier rule and CanvasGroup's own rule
    // both fire, with different wording, not a duplicate to dedupe.
    expect(diagnostics.map((d) => d.ruleName).sort()).toEqual([
      'canvasgroup-ancestor-clips-children',
      'canvasitem-ancestor-clips-children',
    ]);
  });

  it('lints the shipped CanvasGroup fixture clean — no clip_children set anywhere in it', () => {
    // unit-canvas-group.tscn's CanvasGroup carries no clip_children, so the
    // own-gate never opens regardless of ancestry.
    const diagnostics = lint(
      scene(node('Node2D', {}, { name: 'Root' }), node('CanvasGroup', {}, { parent: '.' }))
    );
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('canvasitem-ancestor'))).toEqual([]);
  });
});

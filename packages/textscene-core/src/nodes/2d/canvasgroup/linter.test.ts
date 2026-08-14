/**
 * CanvasGroup linter tests — the ancestor-chain checks
 * `CanvasGroup::get_configuration_warnings()` performs (canvas_group.cpp:67-95).
 *
 * Through `Linter` (via testkit), matching every other `linter.test.ts` in this
 * repo (`Linter` reads only `ruleRegistry`/`validatorRegistry`, populated here
 * solely by this file's own `./linterParser` and `./linter` imports — it does
 * NOT pull the aggregation barrel that self-registers every node type).
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

describe('CanvasGroup Linter', () => {
  describe('ancestor clips children (canvasgroup-ancestor-clips-children)', () => {
    it('passes at the scene root (no parent)', () => {
      expectNoDiagnostic(scene(node('CanvasGroup')), {
        ruleName: 'canvasgroup-ancestor-clips-children',
      });
    });

    it('passes under a plain Node2D parent with no clip_children set', () => {
      expectNoDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('CanvasGroup', {}, { parent: '.' })),
        { ruleName: 'canvasgroup-ancestor-clips-children' }
      );
    });

    it('passes when an ancestor explicitly sets clip_children = 0 (DISABLED)', () => {
      expectNoDiagnostic(
        scene(
          node('Node2D', { clip_children: 0 }, { name: 'Root' }),
          node('CanvasGroup', {}, { parent: '.' })
        ),
        { ruleName: 'canvasgroup-ancestor-clips-children' }
      );
    });

    it('passes when an ancestor sets a clip_children the setter refuses', () => {
      // canvas_item.cpp:1733 refuses >= CLIP_CHILDREN_MAX, and a non-finite is
      // not a mode at all, so neither ancestor clips anything.
      for (const mode of ['3', '5', 'nan', 'inf']) {
        expectNoDiagnostic(
          scene(
            node('Node2D', { clip_children: mode }, { name: 'Root' }),
            node('CanvasGroup', {}, { parent: '.' })
          ),
          { ruleName: 'canvasgroup-ancestor-clips-children' }
        );
      }
    });

    it('warns and names the ancestor when the direct parent clips (clip_children = 1, ONLY)', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Clipper' }),
          node('CanvasGroup', {}, { parent: '.' })
        ),
        { ruleName: 'canvasgroup-ancestor-clips-children', severity: 'warning' }
      );
      expect(diagnostic.message).toContain('Clipper');
    });

    it('warns for clip_children = 2 (AND_DRAW) on a Sprite2D ancestor: subclass-aware, like cast_to<CanvasItem>', () => {
      expectDiagnostic(
        scene(
          node('Sprite2D', { clip_children: 2 }, { name: 'Root' }),
          node('CanvasGroup', {}, { parent: '.' })
        ),
        { ruleName: 'canvasgroup-ancestor-clips-children', severity: 'warning' }
      );
    });

    it('warns naming the NEAREST clipping ancestor when the chain passes through several', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Far' }),
          node('Node2D', { clip_children: 1 }, { name: 'Near', parent: '.' }),
          node('CanvasGroup', {}, { parent: 'Near' })
        ),
        { ruleName: 'canvasgroup-ancestor-clips-children' }
      );
      expect(diagnostic.message).toContain('Near');
      expect(diagnostic.message).not.toContain('Far');
    });

    it('reports the clipping ancestor only once even with two clipping ancestors in the chain', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', { clip_children: 1 }, { name: 'Far' }),
          node('Node2D', { clip_children: 1 }, { name: 'Near', parent: '.' }),
          node('CanvasGroup', {}, { parent: 'Near' })
        )
      ).filter((d) => d.ruleName === 'canvasgroup-ancestor-clips-children');
      expect(diagnostics).toHaveLength(1);
    });
  });

  describe('ancestor is a CanvasGroup (canvasgroup-nested-in-canvasgroup)', () => {
    it('passes when no ancestor is a CanvasGroup', () => {
      expectNoDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('CanvasGroup', {}, { parent: '.' })),
        { ruleName: 'canvasgroup-nested-in-canvasgroup' }
      );
    });

    it('warns and names the ancestor when directly nested under another CanvasGroup', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('CanvasGroup', {}, { name: 'Outer' }),
          node('CanvasGroup', {}, { name: 'Inner', parent: '.' })
        ),
        { ruleName: 'canvasgroup-nested-in-canvasgroup', severity: 'warning' }
      );
      expect(diagnostic.message).toContain('Outer');
    });

    it('warns when a CanvasGroup ancestor is reached through an intermediate Node2D', () => {
      expectDiagnostic(
        scene(
          node('CanvasGroup', {}, { name: 'Outer' }),
          node('Node2D', {}, { name: 'Middle', parent: '.' }),
          node('CanvasGroup', {}, { name: 'Inner', parent: 'Middle' })
        ),
        { ruleName: 'canvasgroup-nested-in-canvasgroup', severity: 'warning' }
      );
    });
  });

  it('reports both arms at once when one ancestor trips both', () => {
    const diagnostics = lint(
      scene(
        node('CanvasGroup', { clip_children: 1 }, { name: 'Outer' }),
        node('CanvasGroup', {}, { name: 'Inner', parent: '.' })
      )
    ).filter((d) => d.nodeName === 'Inner' && d.nodeType === 'CanvasGroup');
    expect(diagnostics.map((d) => d.ruleName).sort()).toEqual([
      'canvasgroup-ancestor-clips-children',
      'canvasgroup-nested-in-canvasgroup',
    ]);
  });

  it('lints the shipped fixture clean — zero errors, zero CanvasGroup diagnostics at all', () => {
    const diagnostics = lint(readFixture('unit-canvas-group.tscn'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.filter((d) => d.nodeType === 'CanvasGroup')).toEqual([]);
  });
});

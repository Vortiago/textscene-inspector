/**
 * Which validator owns the message for a bare `null`.
 *
 * The strict parser rewrites a validator's message when the value is a nil
 * literal, because a per-type "must be a number" reads as a parse failure and
 * says the wrong thing: `NIL` converts strictly only to OBJECT
 * (variant.cpp:543-544), so every other slot silently stores the type's zero.
 *
 * That is false for a slot whose setter REFUSES the null outright — nothing is
 * stored at all — and such a validator says so itself, with the `file:line` of
 * the guard. `nilVerdict` is how it keeps its own message.
 *
 * Both directions are asserted. The rewrite still owning every untagged
 * validator is what stops the tag being widened into a no-op.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { ownsNilMessage } from './propertyValidator.js';
import type { PropertyValidator } from './propertyValidator.js';
import './index.js';

const tileSet = (key: string, value: string): string =>
  scene(subResource('TileSet', { [key]: value }), node('Node3D', {}, { name: 'Root' }));

describe('nil-literal verdicts', () => {
  it('keeps the message of a validator that refuses null on its own authority', () => {
    // TileSet::add_source opens ERR_FAIL_COND_V(p_tile_set_source.is_null(),
    // INVALID_SOURCE) (tile_set.cpp:477), reached straight from `_set` (:3968),
    // so a cleared slot adds no source at all.
    const diagnostics = lint(tileSet('sources/0', 'null'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe('error');
    expect(diagnostics[0]!.message).toContain('tile_set.cpp:477');
    expect(diagnostics[0]!.message).not.toContain("zero value");
  });

  it('keeps it for the pattern slot too', () => {
    // TileSet::add_pattern, ERR_FAIL_COND_V(p_pattern.is_null(), -1)
    // (tile_set.cpp:1359), reached from the fill loop at :3997.
    const diagnostics = lint(tileSet('pattern_0', 'null'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain('tile_set.cpp:1359');
  });

  it('still rewrites an untagged validator on the same nil literal', () => {
    // `tile_shape` is an INT slot: NIL does not convert to it, so Godot stores
    // the zero value and the seam's claim is the accurate one.
    const diagnostics = lint(tileSet('tile_shape', 'null'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain("zero value");
  });

  it('is one question, asked of both tags', () => {
    const source = validatorRegistry.findValidator('TileSet', 'sources/0');
    const shape = validatorRegistry.findValidator('TileSet', 'tile_shape');
    // HBoxContainer::vertical is the removal case, which owns its message for a
    // different reason: the class has no such slot at all.
    const removed = validatorRegistry.findValidator('HBoxContainer', 'vertical');
    // The removal's answer sits on its ERROR, the nil slot's on its validator,
    // so the question is asked of the pair.
    const verdict = (v: PropertyValidator | null, key: string) =>
      ownsNilMessage(v!, v!(key, 'null', 1)!);
    expect(verdict(source, 'sources/0')).toBe(true);
    expect(verdict(removed, 'vertical')).toBe(true);
    expect(verdict(shape, 'tile_shape')).toBe(false);
  });
});

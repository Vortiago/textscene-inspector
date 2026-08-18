/**
 * A `.tscn` chooses the text that indexes our lookup tables — a node type, a
 * property key, a property value — and `Object.prototype`'s members are legal
 * text.
 *
 * Bare indexing on a plain object answers for all of them: `constructor` yields
 * the `Object` FUNCTION, `__proto__` yields `Object.prototype`, and `valueOf`
 * yields a method that throws when called with no receiver. So a four-line
 * scene reached three different failures — a hard crash that killed the whole
 * lint, a diagnostic whose message interpolated `function Object() { [native
 * code] }`, and a bare string pushed where a `ParseError` was expected.
 *
 * Every table keyed by scene text therefore reads through `Object.hasOwn` or is
 * a `Map`. The per-table unit tests cannot see a NEW table missing the guard,
 * which is what this sweep is for: it drives the two real entry points with
 * prototype names in each position and asserts the linter neither throws nor
 * invents a diagnostic.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene } from './testing/testkit.js';
import { descendsFrom, isCatalogedType, baseChain } from './nodeBaseTypes.js';
import '../linter/index.js';

/**
 * Names reachable through a plain object's prototype chain. `valueOf` and
 * `hasOwnProperty` are the ones that THREW; `toString` returned a string;
 * `constructor` and `__proto__` returned an object.
 */
const PROTOTYPE_KEYS = [
  'constructor',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
] as const;

describe('the node-type table answers only for types it declares', () => {
  it.each(PROTOTYPE_KEYS)('does not catalogue %s', (key) => {
    expect(isCatalogedType(key)).toBe(false);
    expect(descendsFrom(key, 'CanvasItem')).toBe(false);
    expect(descendsFrom(key, 'Node')).toBe(false);
  });

  it('answers for a real type, so the sweep is not vacuous', () => {
    expect(isCatalogedType('Node2D')).toBe(true);
    expect(descendsFrom('Sprite2D', 'CanvasItem')).toBe(true);
  });

  it('keeps an unknown GDExtension class unknowable rather than mismatched', () => {
    // The distinction `isCatalogedType` exists for: a prototype name answering
    // true put a made-up class on the "known, and not a CollisionObject3D" side.
    expect(isCatalogedType('JBody3D')).toBe(false);
  });

  it.each(PROTOTYPE_KEYS)('returns a chain of plain strings for %s', (key) => {
    for (const ancestor of baseChain(key)) {
      expect(typeof ancestor).toBe('string');
    }
  });
});

describe('a scene spelling a prototype name lints without throwing', () => {
  it.each(PROTOTYPE_KEYS)('survives a node typed %s', (key) => {
    const content = scene(node(key, {}), node('CollisionShape3D', {}, { parent: key }));
    expect(() => lint(content)).not.toThrow();
  });

  it.each(PROTOTYPE_KEYS)('survives %s as a property key on a Label', (key) => {
    expect(() => lint(scene(node('Label', { [key]: '5' })))).not.toThrow();
  });

  it.each(PROTOTYPE_KEYS)('survives a PhysicalBone3D joint_constraints/%s leaf', (key) => {
    const content = scene(node('PhysicalBone3D', { [`joint_constraints/${key}`]: '1.0' }));
    expect(() => lint(content)).not.toThrow();
    for (const diagnostic of lint(content)) {
      expect(typeof diagnostic.message).toBe('string');
    }
  });

  it.each(PROTOTYPE_KEYS)('survives a Generic6DOFJoint3D linear_limit_x/%s leaf', (key) => {
    const content = scene(node('Generic6DOFJoint3D', { [`linear_limit_x/${key}`]: '1.0' }));
    expect(() => lint(content)).not.toThrow();
    for (const diagnostic of lint(content)) {
      expect(typeof diagnostic.message).toBe('string');
    }
  });
});

describe('a prototype name as a VALUE invents no diagnostic', () => {
  it.each(PROTOTYPE_KEYS)('reports no emission-shape warning for %s', (key) => {
    // The table holds '4'/'5'/'6', so every prototype hit is a fabricated row.
    const rule = 'cpuparticles2d-nondeterministic-emission-shape';
    const fired = lint(scene(node('CPUParticles2D', { emission_shape: key }))).filter(
      (d) => d.ruleName === rule
    );
    expect(fired).toEqual([]);
  });

  it('still reports the shapes the table does declare', () => {
    const rule = 'cpuparticles2d-nondeterministic-emission-shape';
    const fired = lint(scene(node('CPUParticles2D', { emission_shape: '4' }))).filter(
      (d) => d.ruleName === rule
    );
    expect(fired).toHaveLength(1);
  });
});

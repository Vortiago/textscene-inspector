/**
 * Scene text indexes our lookup tables, and `constructor`, `__proto__` and
 * `valueOf` are legal text, so every such table reads through `Object.hasOwn`
 * or is a `Map`. This sweep puts prototype names in each position of both entry
 * points: the linter neither throws nor invents a diagnostic.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene } from './testing/testkit.js';
import { descendsFrom, isCatalogedType, baseChain } from '../godot/nodeBaseTypes.js';
import '../linter/index.js';

/**
 * Names reachable through a plain object's prototype chain. `valueOf` and
 * `hasOwnProperty` throw without a receiver, `toString` returns a string, and
 * `constructor` and `__proto__` return an object.
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
    // true puts a made-up class on the "known, and not a CollisionObject3D" side.
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
    const content = scene(node(key, {}), node('CollisionShape3D', {}, { parent: '.' }));
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
  it.each(PROTOTYPE_KEYS)('reports no emission-shape diagnostic for %s', (key) => {
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

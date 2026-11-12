/**
 * The table test every kind passes (ADR-0071): one resource, written once, decodes to the same
 * value from a `[sub_resource]` of the scene, from a `.tres` of its own, and from a sub-resource
 * of another `.tres`.
 */

import { describe, expect, it } from 'vitest';
import type { ResourceKind } from './read';
import { sceneTables } from './reading.testkit';
import { nodeReference } from './scopedReference';
import { staticSnapshot } from './staticSnapshot.testkit';

/** One resource of a kind, with the value its decode gives. */
export interface OriginCase<T> {
  readonly kind: ResourceKind<T>;
  /** The Godot class of the resource. */
  readonly className: string;
  /** The property lines of the resource, written as a `.tres` writes them. */
  readonly body: string;
  /** What the test compares with: the value, or a summary of it when the value is large. */
  readonly expected: unknown;
  /** Reduces the decoded value to the form `expected` is written in. */
  readonly summarise?: (value: T) => unknown;
}

function valueAt<T>(
  testCase: OriginCase<T>,
  ref: string,
  scene: string,
  files: Record<string, string> = {}
): unknown {
  const read = staticSnapshot(files).read(nodeReference(ref, sceneTables(scene)), testCase.kind);
  if (read.status !== 'loaded')
    throw new Error(`expected a ${testCase.kind.name} to load, got ${read.status}`);
  return (testCase.summarise ?? ((value: T) => value))(read.value);
}

export function describeKindFromEveryOrigin<T>(cases: readonly OriginCase<T>[]): void {
  describe.each(cases)('the $className through the $kind.name kind', (testCase) => {
    const { className, body, expected } = testCase;

    it('decodes from a sub-resource of the scene', () => {
      const scene = `[sub_resource type="${className}" id="r"]\n${body}`;

      expect(valueAt(testCase, 'SubResource("r")', scene)).toEqual(expected);
    });

    it('decodes the same value from a .tres of its own', () => {
      const files = { 'res://r.tres': `[gd_resource type="${className}" format=3]\n\n[resource]\n${body}\n` };
      const scene = `[ext_resource type="${className}" path="res://r.tres" id="1_r"]`;

      expect(valueAt(testCase, 'ExtResource("1_r")', scene, files)).toEqual(expected);
    });

    it('decodes the same value from a sub-resource of another .tres', () => {
      const holder = `[gd_resource type="Resource" format=3]\n\n[sub_resource type="${className}" id="r"]\n${body}\n\n[resource]\n`;

      expect(valueAt(testCase, 'res://holder.tres::r', '', { 'res://holder.tres': holder })).toEqual(
        expected
      );
    });
  });
}

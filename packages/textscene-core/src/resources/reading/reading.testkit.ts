/**
 * Test kinds and scene tables the tests of the reading module share. A test kind decodes a
 * `Resource` to its `resource_name`, and follows `next` with itself, so one kind proves both arms
 * of a nested read.
 */

import { literalText } from '../../godot/string/string';
import { TscnParser } from '../../parser/TscnParser';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import type { Read, ResourceKind } from './read';
import type { ScopedReference } from './scopedReference';

/** What a test kind decodes: the name, the read of `next`, and the reference `later` names. */
export interface Named {
  readonly name: string;
  readonly isHeldLocally: boolean;
  readonly next: Read<Named>;
  readonly later: ScopedReference | null;
}

/** A test kind with its own decode cache, and the number of decodes it has run. */
export interface CountedKind {
  readonly kind: ResourceKind<Named>;
  decodes(): number;
}

/**
 * A fresh kind for each test, so no test sees the decode cache another test filled. `decode`
 * replaces the decode of a `Resource`, for a test of a decode that throws or declines.
 */
export function namedKind(decode?: () => Named | null): CountedKind {
  let decodes = 0;
  const kind: ResourceKind<Named> = {
    name: 'Named',
    accepts: (type) => type === 'Resource',
    decode: (held, follow) => {
      decodes++;
      if (decode) return decode();
      return {
        name: literalText(held.properties.resource_name ?? '""'),
        isHeldLocally: held.isHeldLocally,
        next: follow.read(kind, held.properties.next),
        later: held.properties.later === undefined ? null : follow.reference(held.properties.later),
      };
    },
  };
  return { kind, decodes: () => decodes };
}

/** The resource tables of a scene written as text. */
export function sceneTables(text: string): SceneResources {
  const scene = new TscnParser().parse(`[gd_scene format=3]\n\n${text}\n\n[node name="Root" type="Node"]\n`);
  return { internalResources: scene.internalResources, externalResources: scene.externalResources };
}

/** A `.tres` that holds one `Resource` with `properties`, and the tables written before it. */
export function resourceFile(properties: string, tables = ''): string {
  return `[gd_resource type="Resource" format=3]\n\n${tables}\n\n[resource]\n${properties}\n`;
}

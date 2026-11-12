/**
 * Test kinds and scene tables the tests of the reading module share. A test kind decodes a
 * `Resource` to its `resource_name`, and follows `next` with itself, so one kind proves both arms
 * of a nested read.
 */

import { literalText } from '../../godot/string/string';
import { TscnParser } from '../../parser/TscnParser';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import type { Read, ResourceKind } from './read';
import { nodeReference, type ScopedReference } from './scopedReference';
import { staticSnapshot } from './staticSnapshot.testkit';

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

/** One way a resource reaches a reader: the reference a node writes, the scene tables and the files behind them. */
export interface Origin {
  readonly name: string;
  readonly ref: string;
  readonly scene: string;
  readonly files: Readonly<Record<string, string>>;
}

/**
 * The three origins of one resource of `className` written as `body`: a `[sub_resource]` of the
 * scene, and `elsewhere` a `.tres` of its own and a `[sub_resource]` of another `.tres`.
 */
export function originsOf(
  className: string,
  body: string
): { readonly inScene: Origin; readonly elsewhere: readonly Origin[] } {
  return {
    inScene: {
      name: 'a sub-resource of the scene',
      ref: 'SubResource("r")',
      scene: `[sub_resource type="${className}" id="r"]\n${body}`,
      files: {},
    },
    elsewhere: [
      {
        name: 'a .tres of its own',
        ref: 'ExtResource("1_r")',
        scene: `[ext_resource type="${className}" path="res://own.tres" id="1_r"]`,
        files: { 'res://own.tres': `[gd_resource type="${className}" format=3]\n\n[resource]\n${body}\n` },
      },
      {
        name: 'a sub-resource of another .tres',
        ref: 'res://holder.tres::r',
        scene: '',
        files: {
          'res://holder.tres': `[gd_resource type="Resource" format=3]\n\n[sub_resource type="${className}" id="r"]\n${body}\n\n[resource]\n`,
        },
      },
    ],
  };
}

/** The value `kind` loads at `ref` in a scene written as `sceneText`. Throws unless the read loads. */
export function loadedValue<T>(
  kind: ResourceKind<T>,
  ref: string,
  sceneText: string,
  files: Readonly<Record<string, string>> = {}
): T {
  const read = staticSnapshot(files).read(nodeReference(ref, sceneTables(sceneText)), kind);
  if (read.status !== 'loaded') throw new Error(`expected the ${kind.name} to load, got ${read.status}`);
  return read.value;
}

/** The value `kind` loads at `origin`. */
export function loadedAt<T>(kind: ResourceKind<T>, origin: Origin): T {
  return loadedValue(kind, origin.ref, origin.scene, origin.files);
}

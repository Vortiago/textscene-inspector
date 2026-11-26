import { describe, expect, it } from 'vitest';
import {
  HEADING_KINDS,
  previewerLoadResult,
  SCENE_TREE,
  sweepFile,
  type HeadingKind,
} from './headingSweep.testkit';

/** Each value kind a heading field holds, as the oracle's `headingValueKindSweep.mjs` writes it. */
const VALUES = {
  string: '"v"',
  number: '7',
  identifier: 'abc',
  bool: 'true',
  ext_resource: 'ExtResource("1")',
  sub_resource: 'SubResource("s")',
  sub_resource_own_id: 'SubResource("t")',
  resource_absolute: 'Resource("res://gone_abs.tres")',
  resource_relative: 'Resource("sub/gone_rel.tres")',
  array: '[1, "a"]',
  dictionary: '{"k": 2}',
  nested: '{"k": [ExtResource("1"), {"j": Resource("res://gone_nest.tres")}]}',
  unknown_constructor: 'Foo(1)',
};
type ValueKind = keyof typeof VALUES;

const LOADS = `loads ${SCENE_TREE}`;

/** The first parse error Godot 4.6.3 prints for each cell, `@` for the file, or what it loads. */
const GODOT: Record<HeadingKind, Record<ValueKind, string>> = {
  gd_resource: {
    string: 'loads',
    number: 'loads',
    identifier: "@:1 - Parse Error: Unexpected identifier 'abc'.",
    bool: 'loads',
    ext_resource: "@:1 - Parse Error: Can't load resource at path: 1 with uid: .",
    sub_resource: "@:1 - Parse Error: Can't load resource at path: s with uid: .",
    sub_resource_own_id: "@:1 - Parse Error: Can't load resource at path: t with uid: .",
    resource_absolute: "@:1 - Parse Error: Can't load resource at path: res://gone_abs.tres with uid: .",
    resource_relative: "@:1 - Parse Error: Can't load resource at path: sub/gone_rel.tres with uid: .",
    array: 'loads',
    dictionary: 'loads',
    nested: "@:1 - Parse Error: Can't load resource at path: 1 with uid: .",
    unknown_constructor: "@:1 - Parse Error: Unexpected identifier 'Foo'.",
  },
  gd_scene: {
    string: LOADS,
    number: LOADS,
    identifier: "@:1 - Parse Error: Unexpected identifier 'abc'.",
    bool: LOADS,
    ext_resource: "@:1 - Parse Error: Can't load resource at path: 1 with uid: .",
    sub_resource: "@:1 - Parse Error: Can't load resource at path: s with uid: .",
    sub_resource_own_id: "@:1 - Parse Error: Can't load resource at path: t with uid: .",
    resource_absolute: "@:1 - Parse Error: Can't load resource at path: res://gone_abs.tres with uid: .",
    resource_relative: "@:1 - Parse Error: Can't load resource at path: sub/gone_rel.tres with uid: .",
    array: LOADS,
    dictionary: LOADS,
    nested: "@:1 - Parse Error: Can't load resource at path: 1 with uid: .",
    unknown_constructor: "@:1 - Parse Error: Unexpected identifier 'Foo'.",
  },
  ext_resource: {
    string: LOADS,
    number: LOADS,
    identifier: '@:5 - Parse Error: Unexpected end of file.',
    bool: LOADS,
    ext_resource:
      '@:5 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    sub_resource: '@:5 - Parse Error: Unexpected end of file.',
    sub_resource_own_id: '@:5 - Parse Error: Unexpected end of file.',
    resource_absolute: '@:5 - Parse Error: Unexpected end of file.',
    resource_relative: '@:5 - Parse Error: Unexpected end of file.',
    array: LOADS,
    dictionary: LOADS,
    nested: '@:5 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    unknown_constructor: '@:5 - Parse Error: Unexpected end of file.',
  },
  sub_resource: {
    string: LOADS,
    number: LOADS,
    identifier: "@:9 - Parse Error: Unexpected identifier 'abc'.",
    bool: LOADS,
    ext_resource:
      '@:9 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    sub_resource: LOADS,
    sub_resource_own_id: '@:9 - Parse Error: .',
    resource_absolute: "@:9 - Parse Error: Can't load resource at path: res://gone_abs.tres with uid: .",
    resource_relative: "@:9 - Parse Error: Can't load resource at path: sub/gone_rel.tres with uid: .",
    array: LOADS,
    dictionary: LOADS,
    nested: '@:9 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    unknown_constructor: "@:9 - Parse Error: Unexpected identifier 'Foo'.",
  },
  node: {
    string: LOADS,
    number: LOADS,
    identifier: 'Parse Error: Parse error. [Resource file @:13]',
    bool: LOADS,
    ext_resource:
      '@:13 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres. | loads Root[A, C(1.0, 1.0)]',
    sub_resource: LOADS,
    sub_resource_own_id: LOADS,
    resource_absolute: 'Parse Error: Parse error. [Resource file @:13]',
    resource_relative: 'Parse Error: Parse error. [Resource file @:13]',
    array: LOADS,
    dictionary: LOADS,
    nested: '@:13 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    unknown_constructor: 'Parse Error: Parse error. [Resource file @:13]',
  },
  connection: {
    string: LOADS,
    number: LOADS,
    identifier: 'Parse Error: Parse error. [Resource file @:19]',
    bool: LOADS,
    ext_resource:
      '@:19 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    sub_resource: LOADS,
    sub_resource_own_id: LOADS,
    resource_absolute: 'Parse Error: Parse error. [Resource file @:19]',
    resource_relative: 'Parse Error: Parse error. [Resource file @:19]',
    array: LOADS,
    dictionary: LOADS,
    nested: '@:19 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    unknown_constructor: 'Parse Error: Parse error. [Resource file @:19]',
  },
  editable: {
    string: LOADS,
    number: LOADS,
    identifier: "@:21 - Parse Error: Unexpected identifier 'abc'.",
    bool: LOADS,
    ext_resource:
      '@:21 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    sub_resource: LOADS,
    sub_resource_own_id: LOADS,
    resource_absolute: "@:21 - Parse Error: Can't load resource at path: res://gone_abs.tres with uid: .",
    resource_relative: "@:21 - Parse Error: Can't load resource at path: sub/gone_rel.tres with uid: .",
    array: LOADS,
    dictionary: LOADS,
    nested: '@:21 - Parse Error: [ext_resource] referenced non-existent resource at: res://gone_ext.tres.',
    unknown_constructor: "@:21 - Parse Error: Unexpected identifier 'Foo'.",
  },
};

/** The cells where the previewer differs from Godot's first printed error. */
const PREVIEWER: Partial<Record<`${HeadingKind}.${ValueKind}`, string>> = {
  // Godot skips the failed read and drops A's body after it, loading `Root[A, C(1.0, 1.0)]`.
  'node.ext_resource': LOADS,
  // Godot prints the read it skips, then the literal after it that ends the load, at the same line.
  'node.nested': 'Parse Error: Parse error. [Resource file @:13]',
};

const CELLS = HEADING_KINDS.flatMap((kind) =>
  (Object.keys(VALUES) as ValueKind[]).map((value) => {
    const file = sweepFile(kind, value, `x=${VALUES[value]}`);
    const expected = PREVIEWER[`${kind}.${value}`] ?? GODOT[kind][value];
    return { kind, value, file, expected: expected.replace('@', file.path) };
  })
);

describe('each value kind in each heading kind, as Godot 4.6.3 loads it', () => {
  it.each(CELLS)('$value in $kind', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected);
  });
});

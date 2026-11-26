import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import {
  HEADING_KINDS,
  previewerLoadResult,
  SCENE_TREE,
  sweepFile,
  treeOf,
  type HeadingKind,
} from './headingSweep.testkit';

/** A refusal at each token kind, on the heading's own line and on a later line, as the sweep writes it. */
const REFUSALS = {
  array_own: '[1 2]',
  array_later: '[1,\n2 3]',
  dictionary_own: '{"k" 2}',
  dictionary_later: '{"k": 1,\n"j" 2}',
  string_own: '"a\\uZZZZ"',
  string_later: '"a\nb\\uZZZZ"',
  constructor_own: 'Vector2(1 2)',
  constructor_later: 'Vector2(1,\n2 3)',
  after_equals_own: ')',
  after_equals_later: '\n)',
  after_comma_own: '[1, )]',
  after_comma_later: '[1,\n)]',
};
type Refusal = keyof typeof REFUSALS;

/** The first parse error Godot 4.6.3 prints for each cell, `@` for the file. */
const GODOT: Record<HeadingKind, Record<Refusal, string>> = {
  gd_resource: {
    array_own: "@:1 - Parse Error: Expected ','.",
    array_later: "@:2 - Parse Error: Expected ','.",
    dictionary_own: "@:1 - Parse Error: Expected ':'.",
    dictionary_later: "@:2 - Parse Error: Expected ':'.",
    string_own: "@:1 - Parse Error: Expected value, got 'ERROR'.",
    string_later: "@:2 - Parse Error: Expected value, got 'ERROR'.",
    constructor_own: "@:1 - Parse Error: Expected ',' or ')' in constructor.",
    constructor_later: "@:2 - Parse Error: Expected ',' or ')' in constructor.",
    after_equals_own: "@:1 - Parse Error: Expected value, got '')''.",
    after_equals_later: "@:2 - Parse Error: Expected value, got '')''.",
    after_comma_own: "@:1 - Parse Error: Expected value, got '')''.",
    after_comma_later: "@:2 - Parse Error: Expected value, got '')''.",
  },
  gd_scene: {
    array_own: "@:1 - Parse Error: Expected ','.",
    array_later: "@:2 - Parse Error: Expected ','.",
    dictionary_own: "@:1 - Parse Error: Expected ':'.",
    dictionary_later: "@:2 - Parse Error: Expected ':'.",
    string_own: "@:1 - Parse Error: Expected value, got 'ERROR'.",
    string_later: "@:2 - Parse Error: Expected value, got 'ERROR'.",
    constructor_own: "@:1 - Parse Error: Expected ',' or ')' in constructor.",
    constructor_later: "@:2 - Parse Error: Expected ',' or ')' in constructor.",
    after_equals_own: "@:1 - Parse Error: Expected value, got '')''.",
    after_equals_later: "@:2 - Parse Error: Expected value, got '')''.",
    after_comma_own: "@:1 - Parse Error: Expected value, got '')''.",
    after_comma_later: "@:2 - Parse Error: Expected value, got '')''.",
  },
  ext_resource: {
    array_own: '@:5 - Parse Error: Unexpected end of file.',
    array_later: '@:6 - Parse Error: Unexpected end of file.',
    dictionary_own: '@:5 - Parse Error: Unexpected end of file.',
    dictionary_later: '@:6 - Parse Error: Unexpected end of file.',
    string_own: '@:5 - Parse Error: Unexpected end of file.',
    string_later: '@:6 - Parse Error: Unexpected end of file.',
    constructor_own: '@:5 - Parse Error: Unexpected end of file.',
    constructor_later: '@:6 - Parse Error: Unexpected end of file.',
    after_equals_own: '@:5 - Parse Error: Unexpected end of file.',
    after_equals_later: '@:6 - Parse Error: Unexpected end of file.',
    after_comma_own: '@:5 - Parse Error: Unexpected end of file.',
    after_comma_later: '@:6 - Parse Error: Unexpected end of file.',
  },
  sub_resource: {
    array_own: "@:9 - Parse Error: Expected ','.",
    array_later: "@:10 - Parse Error: Expected ','.",
    dictionary_own: "@:9 - Parse Error: Expected ':'.",
    dictionary_later: "@:10 - Parse Error: Expected ':'.",
    string_own: "@:9 - Parse Error: Expected value, got 'ERROR'.",
    string_later: "@:10 - Parse Error: Expected value, got 'ERROR'.",
    constructor_own: "@:9 - Parse Error: Expected ',' or ')' in constructor.",
    constructor_later: "@:10 - Parse Error: Expected ',' or ')' in constructor.",
    after_equals_own: "@:9 - Parse Error: Expected value, got '')''.",
    after_equals_later: "@:10 - Parse Error: Expected value, got '')''.",
    after_comma_own: "@:9 - Parse Error: Expected value, got '')''.",
    after_comma_later: "@:10 - Parse Error: Expected value, got '')''.",
  },
  node: {
    array_own: 'Parse Error: Parse error. [Resource file @:13]',
    array_later: 'Parse Error: Parse error. [Resource file @:14]',
    dictionary_own: 'Parse Error: Parse error. [Resource file @:13]',
    dictionary_later: 'Parse Error: Parse error. [Resource file @:14]',
    string_own: 'Parse Error: Parse error. [Resource file @:13]',
    string_later: 'Parse Error: Parse error. [Resource file @:14]',
    constructor_own: 'Parse Error: Parse error. [Resource file @:13]',
    constructor_later: 'Parse Error: Parse error. [Resource file @:14]',
    after_equals_own: 'Parse Error: Parse error. [Resource file @:13]',
    after_equals_later: 'Parse Error: Parse error. [Resource file @:14]',
    after_comma_own: 'Parse Error: Parse error. [Resource file @:13]',
    after_comma_later: 'Parse Error: Parse error. [Resource file @:14]',
  },
  connection: {
    array_own: 'Parse Error: Parse error. [Resource file @:19]',
    array_later: 'Parse Error: Parse error. [Resource file @:20]',
    dictionary_own: 'Parse Error: Parse error. [Resource file @:19]',
    dictionary_later: 'Parse Error: Parse error. [Resource file @:20]',
    string_own: 'Parse Error: Parse error. [Resource file @:19]',
    string_later: 'Parse Error: Parse error. [Resource file @:20]',
    constructor_own: 'Parse Error: Parse error. [Resource file @:19]',
    constructor_later: 'Parse Error: Parse error. [Resource file @:20]',
    after_equals_own: 'Parse Error: Parse error. [Resource file @:19]',
    after_equals_later: 'Parse Error: Parse error. [Resource file @:20]',
    after_comma_own: 'Parse Error: Parse error. [Resource file @:19]',
    after_comma_later: 'Parse Error: Parse error. [Resource file @:20]',
  },
  editable: {
    array_own: "@:21 - Parse Error: Expected ','.",
    array_later: "@:22 - Parse Error: Expected ','.",
    dictionary_own: "@:21 - Parse Error: Expected ':'.",
    dictionary_later: "@:22 - Parse Error: Expected ':'.",
    string_own: "@:21 - Parse Error: Expected value, got 'ERROR'.",
    string_later: "@:22 - Parse Error: Expected value, got 'ERROR'.",
    constructor_own: "@:21 - Parse Error: Expected ',' or ')' in constructor.",
    constructor_later: "@:22 - Parse Error: Expected ',' or ')' in constructor.",
    after_equals_own: "@:21 - Parse Error: Expected value, got '')''.",
    after_equals_later: "@:22 - Parse Error: Expected value, got '')''.",
    after_comma_own: "@:21 - Parse Error: Expected value, got '')''.",
    after_comma_later: "@:22 - Parse Error: Expected value, got '')''.",
  },
};

const CELLS = HEADING_KINDS.flatMap((kind) =>
  (Object.keys(REFUSALS) as Refusal[]).map((refusal) => {
    const file = sweepFile(kind, refusal, `x=${REFUSALS[refusal]}`);
    return { kind, refusal, file, expected: GODOT[kind][refusal].replace('@', file.path) };
  })
);

/** Godot loads no node of a refused file. The previewer draws a refused node closed on its own line. */
function lenientTree(kind: HeadingKind, refusal: Refusal): string {
  return kind === 'node' && refusal.endsWith('_later') ? 'Root[C(1.0, 1.0)]' : SCENE_TREE;
}

describe('where a refused heading stops, as Godot 4.6.3 loads it', () => {
  it.each(CELLS)('$refusal in $kind', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected);
  });

  it.each(CELLS.filter(({ kind }) => kind !== 'gd_resource'))(
    '$refusal in $kind draws the headings after it',
    ({ kind, refusal, file }) => {
      expect(new TscnParser().parse(file.text).nodes.map(treeOf).join(', ')).toBe(lenientTree(kind, refusal));
    }
  );
});

import { describe, expect, it } from 'vitest';
import { Linter } from '../../linter/Linter';
import {
  HEADING_KINDS,
  previewerLoadResult,
  SCENE_TREE,
  sweepFile,
  type HeadingKind,
} from './headingSweep.testkit';

/** A body line after each kind of heading, as the oracle's `headingBodySweep.mjs` writes it. */
const PLACES = { same_line: '] x = 1 ;', next_line: ']\nx = 1 ;' };
type Place = keyof typeof PLACES;

/** The line Godot 4.6.3 prints for a body after each heading kind, `@` for the file, by place. */
const GODOT: Record<HeadingKind, Record<Place, string>> = {
  gd_resource: {
    same_line: '@:1 - Parse Error: Unexpected end of file.',
    next_line: '@:2 - Parse Error: Unexpected end of file.',
  },
  gd_scene: {
    same_line: '@:1 - Parse Error: Unexpected end of file.',
    next_line: '@:2 - Parse Error: Unexpected end of file.',
  },
  ext_resource: {
    same_line: "@:5 - Parse Error: Expected '['.",
    next_line: "@:6 - Parse Error: Expected '['.",
  },
  sub_resource: { same_line: `loads ${SCENE_TREE}`, next_line: `loads ${SCENE_TREE}` },
  node: { same_line: `loads ${SCENE_TREE}`, next_line: `loads ${SCENE_TREE}` },
  connection: {
    same_line: "@:19 - Parse Error: Expected '['.",
    next_line: "@:20 - Parse Error: Expected '['.",
  },
  editable: {
    same_line: "@:21 - Parse Error: Expected '['.",
    next_line: "@:22 - Parse Error: Expected '['.",
  },
};

const CELLS = HEADING_KINDS.flatMap((kind) =>
  (Object.keys(PLACES) as Place[]).map((place) => {
    const file = sweepFile(kind, place, PLACES[place]);
    return { kind, place, file, expected: GODOT[kind][place].replace('@', file.path) };
  })
);

describe('a body line after each kind of heading, as Godot 4.6.3 loads it', () => {
  it.each(CELLS)('$place after [$kind]', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected);
  });

  it.each(CELLS)(
    '$place after [$kind] gives a diagnostic only where Godot refuses it',
    ({ file, expected }) => {
      const refused = new Linter()
        .lint(file.text)
        .some((diagnostic) => diagnostic.message.startsWith('Godot reads no body after'));
      expect(refused).toBe(!expected.startsWith('loads'));
    }
  );
});

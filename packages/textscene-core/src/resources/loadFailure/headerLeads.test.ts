import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import { previewerLoadResult, treeOf } from './headingSweep.testkit';

/** Text before a file's header, as the oracle's `headerLeadSweep.mjs` writes it. */
const LEADS = {
  bom: '﻿',
  bom_comment: '﻿; c\n',
  comment: '; c\n',
  blank_lines: '\n\n',
  tab: '\t',
  code_1: '\x01',
  body_line: 'x = 1\n',
  word: 'garbage\n',
  number: '1\n',
  string: '"s"\n',
  close_bracket: ']\n',
};
type Lead = keyof typeof LEADS;

const LEAD_FILES = {
  tscn: '@[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n[node name="A" type="Node2D" parent="."]\nposition = Vector2(1, 2)\n',
  tres: '@[gd_resource type="Gradient" format=3]\n\n[resource]\noffsets = PackedFloat32Array(0, 1)\n',
};
type Extension = keyof typeof LEAD_FILES;

const REFUSED = "@:1 - Parse Error: Expected '['.";

/** What Godot 4.6.3 prints for each lead, `@` for the file: the same for a scene and a resource. */
const GODOT: Record<Lead, string | Record<Extension, string>> = {
  bom: REFUSED,
  bom_comment: REFUSED,
  comment: { tscn: 'loads Root[A(1.0, 2.0)]', tres: 'loads' },
  blank_lines: { tscn: 'loads Root[A(1.0, 2.0)]', tres: 'loads' },
  tab: { tscn: 'loads Root[A(1.0, 2.0)]', tres: 'loads' },
  code_1: { tscn: 'loads Root[A(1.0, 2.0)]', tres: 'loads' },
  body_line: REFUSED,
  word: REFUSED,
  number: REFUSED,
  string: REFUSED,
  close_bracket: REFUSED,
};

const CELLS = (Object.keys(LEADS) as Lead[]).flatMap((lead) =>
  (Object.keys(LEAD_FILES) as Extension[]).map((extension) => {
    const path = `res://${lead}.${extension}`;
    const text = LEAD_FILES[extension].replace('@', LEADS[lead]);
    const godot = GODOT[lead];
    const expected = (typeof godot === 'string' ? godot : godot[extension]).replace('@', path);
    return { lead, extension, file: { path, text }, expected };
  })
);

describe('text before the header, as Godot 4.6.3 loads it', () => {
  it.each(CELLS)('$lead before a .$extension header', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected);
  });

  it.each(CELLS.filter(({ extension }) => extension === 'tscn'))(
    '$lead before a scene header draws the scene',
    ({ file }) => {
      expect(new TscnParser().parse(file.text).nodes.map(treeOf).join(', ')).toBe('Root[A(1.0, 2.0)]');
    }
  );
});

import { writeCaseFiles } from './writeCaseFiles.mjs';

/** Text before a file's header: what Godot's first `parse_tag` reads, as each case names it. */
export const LEADS = {
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

/** A scene and a resource, each with `@` where the lead goes. */
export const LEAD_FILES = {
  tscn: '@[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n[node name="A" type="Node2D" parent="."]\nposition = Vector2(1, 2)\n',
  tres: '@[gd_resource type="Gradient" format=3]\n\n[resource]\noffsets = PackedFloat32Array(0, 1)\n',
};

const cases = Object.entries(LEADS).flatMap(([lead, text]) =>
  Object.entries(LEAD_FILES).map(([extension, file]) => ({
    file: `${lead}.${extension}`,
    text: file.replace('@', text),
  }))
);
console.log(writeCaseFiles(process.argv[2], cases));

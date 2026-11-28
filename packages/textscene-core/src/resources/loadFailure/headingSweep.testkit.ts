import { parseTresFile } from '../../parser/parsedResource';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import type { SceneFile } from '../../scene/sceneFiles';
import { resourceFailingReads, sceneFailingReads } from './fileReads';
import { sceneFailureOf } from './sceneFailure';

/** The heading kinds the sweeps write a field into, as the oracle's `headingSweepScene.mjs` does. */
export const HEADING_KINDS = [
  'gd_resource',
  'gd_scene',
  'ext_resource',
  'sub_resource',
  'node',
  'connection',
  'editable',
] as const;

export type HeadingKind = (typeof HEADING_KINDS)[number];

const SCENE_LINES = [
  '[gd_scene format=3@gd_scene]',
  '',
  '@ext_1',
  '',
  '[ext_resource type="Resource" path="res://real.tres" id="2"@ext_resource]',
  '',
  '[sub_resource type="Resource" id="s"]',
  '',
  '[sub_resource type="Resource" id="t"@sub_resource]',
  '',
  '[node name="Root" type="Node2D"]',
  '',
  '[node name="A" type="Node2D" parent="."@node]',
  'position = Vector2(5, 5)',
  '',
  '[node name="C" type="Node2D" parent="."]',
  'position = Vector2(1, 1)',
  '',
  '[connection signal="ready" from="." to="." method="get_class"@connection]',
  '',
  '[editable path="A"@editable]',
  '',
  '[editable path="C"]',
  '',
];

const MISSING_EXT = '[ext_resource type="Resource" path="res://gone_ext.tres" id="1"]';

/** The tree of the sweep scene where every heading loads. */
export const SCENE_TREE = 'Root[A(5.0, 5.0), C(1.0, 1.0)]';

/** The path and text of the sweep file with ` <field>` in a heading of that kind. */
export function sweepFile(kind: HeadingKind, name: string, field: string): { path: string; text: string } {
  if (kind === 'gd_resource')
    return {
      path: `res://${kind}__${name}.tres`,
      text: `[gd_resource type="Resource" format=3 ${field}]\n\n[resource]\n`,
    };
  const text = SCENE_LINES.join('\n')
    .replace('@ext_1', field.includes('ExtResource') ? MISSING_EXT : '; no ext_resource 1')
    .replace(`@${kind}`, ` ${field}`)
    .replace(/@[a-z_]+/g, '');
  return { path: `res://${kind}__${name}.tscn`, text };
}

/** How a heading that never closes opens, as the oracle's `headingSweepScene.mjs` writes it. */
export const NEVER_CLOSED_OPENINGS = { bracket: '', string: ' x="a' };
export type NeverClosedOpening = keyof typeof NEVER_CLOSED_OPENINGS;

/** What follows a heading that never closes before the next heading. */
export const NEVER_CLOSED_STOPS = ['heading', 'body', 'eof'] as const;
export type NeverClosedStop = (typeof NEVER_CLOSED_STOPS)[number];

const OPEN_MARK = '%open%';

/** The sweep file with that kind of heading never closed, and only `stop` before the next heading. */
export function sweepUnclosedFile(
  kind: HeadingKind,
  opening: NeverClosedOpening,
  stop: NeverClosedStop
): { path: string; text: string } {
  const { path, text } = sweepFile(kind, `never_closed_${opening}_then_${stop}`, OPEN_MARK);
  const lines = text.split('\n');
  const at = lines.findIndex((line) => line.includes(` ${OPEN_MARK}]`));
  lines[at] = lines[at]!.replace(` ${OPEN_MARK}]`, NEVER_CLOSED_OPENINGS[opening]);
  let next = at + 1;
  while (next < lines.length && !lines[next]!.startsWith('[')) next += 1;
  const after = stop === 'eof' ? [''] : [...(stop === 'body' ? ['x = 1'] : []), '', ...lines.slice(next)];
  return { path, text: [...lines.slice(0, at + 1), ...after].join('\n') };
}

/** A node as the Godot load oracle prints it: `Root[A(1.0, 2.0), B]`. */
export function treeOf(node: TscnNode): string {
  const position = (node.properties as { position?: { x: number; y: number } }).position;
  const at =
    position && (position.x || position.y) ? `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})` : '';
  const children = node.children.map(treeOf);
  return `${node.name}${at}${children.length ? `[${children.join(', ')}]` : ''}`;
}

/** Every file a sweep file reads is missing but `real.tres`, so each failing read fails. */
function missing(path: string, owner: string): SceneFile {
  const reason = { chain: [path], cause: 'missing' as const, addresses: [] };
  return { path, type: null, state: 'missing', owners: [owner], reason, addresses: [] };
}

/** The previewer's result in the oracle's form: Godot's error line, else `loads` and the tree. */
export function previewerLoadResult({ path, text }: { path: string; text: string }): string {
  const scene = path.endsWith('.tscn') ? new TscnParser().parse(text) : null;
  const { failing, parseStop } = scene
    ? sceneFailingReads(path, scene)
    : resourceFailingReads(path, parseTresFile(text));
  const files = failing.map((read) => missing(read.path, path));
  const failure = sceneFailureOf(files, { scene: path, reads: failing, parseStop });
  if (failure) return failure.line;
  return scene ? `loads ${scene.nodes.map(treeOf).join(', ')}` : 'loads';
}

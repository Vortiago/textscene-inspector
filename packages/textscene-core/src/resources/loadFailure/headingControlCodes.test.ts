import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { sceneFailingReads } from './fileReads';
import { sceneFailureOf } from './sceneFailure';

const sceneHead = '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n';
const childBody = '\nposition = Vector2(5, 5)\n';
const refusedHeading = '\n[node name="Z" parent="." type=]\n';
const codes = { nul: '\0', tab: '\t', soh: '\x01', cr: '\r' };
type Code = keyof typeof codes;

/** Each place in a child heading, `@` where the code goes, and the codes Godot refuses there at line 5. */
const PLACES: { place: string; heading: string; refusedBy: Code[] }[] = [
  { place: 'before `[`', heading: '@[node name="A" type="Node2D" parent="."]', refusedBy: [] },
  { place: 'after `[`', heading: '[@node name="A" type="Node2D" parent="."]', refusedBy: ['nul'] },
  {
    place: 'inside the tag name',
    heading: '[no@de name="A" type="Node2D" parent="."]',
    refusedBy: ['nul', 'tab', 'soh', 'cr'],
  },
  { place: 'after the tag name', heading: '[node@ name="A" type="Node2D" parent="."]', refusedBy: [] },
  { place: 'before `=`', heading: '[node name@="A" type="Node2D" parent="."]', refusedBy: [] },
  { place: 'after `=`', heading: '[node name=@"A" type="Node2D" parent="."]', refusedBy: ['nul'] },
  { place: 'inside a value', heading: '[node name="A@" type="Node2D" parent="."]', refusedBy: ['nul'] },
  { place: 'after a value', heading: '[node name="A"@ type="Node2D" parent="."]', refusedBy: ['nul'] },
  { place: 'before `]`', heading: '[node name="A" type="Node2D" parent="."@]', refusedBy: ['nul'] },
  { place: 'after `]`', heading: '[node name="A" type="Node2D" parent="."]@', refusedBy: [] },
];

/** Each code at each place, as Godot 4.6.3 loads it, measured by `headingControlCodeSweep.mjs`. */
const CASES = PLACES.flatMap(({ place, heading, refusedBy }) =>
  (Object.keys(codes) as Code[]).map((code) => {
    const name = heading === PLACES[6]!.heading ? `A${codes[code]}` : 'A';
    return {
      code,
      place,
      scene: sceneHead + heading.replace('@', codes[code]) + childBody,
      // A refused heading stops the load at its line, else the refused heading after it does.
      stop: refusedBy.includes(code) ? 5 : 8,
      tree: refusedBy.includes(code) ? null : `Root[${name}(5.0, 5.0)]`,
    };
  })
);

function stopLineOf(text: string): string | null {
  const scene = 'res://case.tscn';
  const { parseStop } = sceneFailingReads(scene, new TscnParser().parse(text));
  return sceneFailureOf([], { scene, reads: [], parseStop })?.line ?? null;
}

function treeOf(node: TscnNode): string {
  const position = (node.properties as { position?: { x: number; y: number } }).position;
  const at =
    position && (position.x || position.y) ? `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})` : '';
  const children = node.children.map(treeOf);
  return `${node.name}${at}${children.length ? `[${children.join(', ')}]` : ''}`;
}

describe('a control code in a heading, as Godot 4.6.3 loads it', () => {
  it.each(CASES)('$code $place stops at line $stop', ({ scene, stop }) => {
    expect(stopLineOf(scene + refusedHeading)).toBe(
      `Parse Error: Parse error. [Resource file res://case.tscn:${stop}]`
    );
  });

  it.each(CASES.filter(({ tree }) => tree))('$code $place draws $tree', ({ scene, tree }) => {
    expect(new TscnParser().parse(scene).nodes.map(treeOf).join(', ')).toBe(tree);
  });
});

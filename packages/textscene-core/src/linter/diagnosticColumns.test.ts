import { describe, it, expect } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import { headingLocation, propertyLocation } from './sourceLocation.js';
// The barrel, so every slice has registered its validators.
import './index.js';

const ANCHORS = [
  { anchor: 'the value', type: 'Node3D', key: 'visible', value: '"yes"', on: 'value' },
  { anchor: 'the key', type: 'Skeleton3D', key: 'bones/abc', value: '1', on: 'key' },
  { anchor: 'the value of an alias', type: 'Label', key: 'align', value: '5', on: 'value' },
] as const;

const LEADS = [
  { lead: 'at the start of its line', heading: (type: string) => `[node name="N" type="${type}"]\n` },
  { lead: "after a heading's `]`", heading: (type: string) => `[node name="N" type="${type}"] ` },
] as const;

const SPACINGS = [
  { spacing: 'key=value', join: '=' },
  { spacing: 'key = value', join: ' = ' },
  { spacing: 'key =value', join: ' =' },
  { spacing: 'a value on the next line', join: ' =\n  ' },
] as const;

const CELLS = ANCHORS.flatMap((anchor) =>
  LEADS.flatMap((lead) => SPACINGS.map((spacing) => ({ ...anchor, ...lead, ...spacing })))
);

/** The 1-based line and column of `needle`'s first character at or after `from` in `text`. */
function placeOf(text: string, needle: string, from: number): { line: number; column: number } {
  const at = text.indexOf(needle, from);
  const lineStart = text.lastIndexOf('\n', at - 1) + 1;
  return { line: text.slice(0, at).split('\n').length, column: at - lineStart + 1 };
}

describe('a property diagnostic sits on what its validator anchors', () => {
  it.each(CELLS)(
    'on $anchor, with the key $lead, spaced $spacing',
    ({ type, key, value, on, heading, join }) => {
      const text = `[gd_scene format=3]\n\n${heading(type)}${key}${join}${value}\n`;
      const [error, ...rest] = new StrictTscnParser().parse(text).errors;
      expect(rest).toEqual([]);
      const keyAt = text.indexOf(key, text.indexOf(']', text.indexOf('[node')));
      const expected = on === 'key' ? placeOf(text, key, keyAt) : placeOf(text, value, keyAt + key.length);
      expect({ line: error?.line, column: error?.column }).toEqual(expected);
    }
  );
});

const SECOND_HEADING = '[node name="B" parent="."]';

const HEADING_LEADS = [
  { lead: 'on its own line', text: `[node name="A" type="Node"]\n${SECOND_HEADING} visible = false\n` },
  {
    lead: "after another heading's `]`",
    text: `[node name="A" type="Node"] ${SECOND_HEADING} visible = false\n`,
  },
] as const;

const HEADING_ANCHORS = [
  {
    anchor: "a heading's refusal",
    on: SECOND_HEADING,
    place: (text: string) => {
      const error = new StrictTscnParser()
        .parse(text)
        .errors.find((e) => e.code === 'MISSING_NODE_IDENTIFIER');
      return error && { line: error.line, column: error.column };
    },
  },
  {
    anchor: "a rule's heading",
    on: SECOND_HEADING,
    place: (text: string) => {
      const { scene, lines } = new StrictTscnParser().parse(text);
      return headingLocation(lines, scene!.nodes[0]!.children[0]!);
    },
  },
  {
    anchor: "a rule's property",
    on: 'visible',
    place: (text: string) => {
      const { scene, lines } = new StrictTscnParser().parse(text);
      return propertyLocation(lines, scene!.nodes[0]!.children[0]!, 'visible');
    },
  },
] as const;

const HEADING_CELLS = HEADING_ANCHORS.flatMap((anchor) =>
  HEADING_LEADS.map((lead) => ({ ...anchor, ...lead }))
);

describe('a diagnostic about a heading or its property sits on it, past another heading on its line', () => {
  it.each(HEADING_CELLS)('$anchor, the heading $lead', ({ on, place, text }) => {
    const file = `[gd_scene format=3]\n\n${text}`;
    expect(place(file)).toEqual(placeOf(file, on, file.indexOf('[node', file.indexOf('[node') + 1)));
  });
});

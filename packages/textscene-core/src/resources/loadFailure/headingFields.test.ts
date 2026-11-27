import { describe, expect, it } from 'vitest';
import { Linter } from '../../linter/Linter';
import { parseTresFile } from '../../parser/parsedResource';
import { UnparsedTextError } from '../../parser/unparsedTextError';
import { previewerLoadResult, sweepFile, type HeadingKind } from './headingSweep.testkit';

/** Each field Godot's loader requires, by heading kind, as `headingFieldSweep.mjs` lists them. */
const REQUIRED: Partial<Record<HeadingKind, readonly string[]>> = {
  gd_resource: ['type'],
  ext_resource: ['path', 'type', 'id'],
  sub_resource: ['type', 'id'],
  connection: ['from', 'to', 'signal', 'method'],
  editable: ['path'],
};

/** The sweep file of `kind` without `fields`, its `]` on a new line if `isSplit`, and its heading's line. */
function fileWithout(kind: HeadingKind, name: string, fields: readonly string[], isSplit = false) {
  const { path, text } = sweepFile(kind, name, '');
  const line = text.split('\n').find((one) => one.startsWith(`[${kind} `) && one.endsWith(' ]'))!;
  let heading = line.replace(/ \]$/, isSplit ? '\n]' : ']');
  for (const field of fields)
    heading = heading.replace(new RegExp(` ${field}=("[^"]*"|\\S+?)(?=[ \\]\\n])`), '');
  return { path, text: text.replace(line, heading), headingLine: text.split('\n').indexOf(line) + 1 };
}

/** The line Godot 4.6.3 prints for each case, `@` for the file, measured with the load oracle. */
const GODOT: Record<string, string> = {
  gd_resource__no_type: "@:1 - Parse Error: Missing 'type' field in 'gd_resource' tag.",
  gd_resource__no_type__split: "@:2 - Parse Error: Missing 'type' field in 'gd_resource' tag.",
  ext_resource__no_path: "@:5 - Parse Error: Missing 'path' in external resource tag.",
  ext_resource__no_type: "@:5 - Parse Error: Missing 'type' in external resource tag.",
  ext_resource__no_id: "@:5 - Parse Error: Missing 'id' in external resource tag.",
  ext_resource__none: "@:5 - Parse Error: Missing 'path' in external resource tag.",
  ext_resource__no_id__split: "@:6 - Parse Error: Missing 'id' in external resource tag.",
  sub_resource__no_type: "@:9 - Parse Error: Missing 'type' in external resource tag.",
  sub_resource__no_id: "@:9 - Parse Error: Missing 'id' in external resource tag.",
  sub_resource__none: "@:9 - Parse Error: Missing 'type' in external resource tag.",
  sub_resource__no_id__split: "@:10 - Parse Error: Missing 'id' in external resource tag.",
  connection__no_from: 'Failed loading resource: @.',
  connection__no_to: 'Failed loading resource: @.',
  connection__no_signal: 'Failed loading resource: @.',
  connection__no_method: 'Failed loading resource: @.',
  connection__none: 'Failed loading resource: @.',
  connection__no_method__split: 'Failed loading resource: @.',
  editable__no_path: "@:21 - Parse Error: Missing 'path' field from editable tag.",
  editable__no_path__split: "@:22 - Parse Error: Missing 'path' field from editable tag.",
};

const KINDS = Object.entries(REQUIRED) as [HeadingKind, readonly string[]][];

const CASES = [
  ...KINDS.flatMap(([kind, fields]) =>
    fields.map((field) => ({ kind, name: `no_${field}`, fields: [field] }))
  ),
  ...KINDS.filter(([, fields]) => fields.length > 1).map(([kind, fields]) => ({
    kind,
    name: 'none',
    fields,
  })),
  ...KINDS.map(([kind, fields]) => ({ kind, name: `no_${fields.at(-1)}__split`, fields: [fields.at(-1)!] })),
].map(({ kind, name, fields }) => {
  const file = fileWithout(kind, name, fields, name.endsWith('__split'));
  return {
    kind,
    name: `${kind}__${name}`,
    file,
    expected: GODOT[`${kind}__${name}`]!.replace('@', file.path),
  };
});
const SCENE_CASES = CASES.filter(({ kind }) => kind !== 'gd_resource');
const RESOURCE_CASES = CASES.filter(({ kind }) => kind === 'gd_resource');

describe('a heading without a field Godot requires, as Godot 4.6.3 loads it', () => {
  it('measures every case', () => {
    expect(CASES.map(({ name }) => name).sort()).toEqual(Object.keys(GODOT).sort());
  });

  it.each(SCENE_CASES)('$name', ({ file, expected }) => {
    expect(previewerLoadResult(file)).toBe(expected);
  });

  // The loader marks a resource with no type unparsed, so every scene that reads it fails.
  it.each(RESOURCE_CASES)('$name refuses the resource', ({ file }) => {
    expect(() => parseTresFile(file.text)).toThrow(UnparsedTextError);
  });

  // The `connection-missing-field` and `editable-missing-path` rules report their kinds, once.
  it.each(CASES)('$name gives one diagnostic, on the heading', ({ file }) => {
    const diagnostics = new Linter()
      .lint(file.text)
      .filter(({ message }) => / with no '|heading is missing '/.test(message));
    expect(diagnostics.map(({ location }) => location?.line)).toEqual([file.headingLine]);
  });
});

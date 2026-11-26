import { describe, expect, it } from 'vitest';
import { HEADER_READING, readTag, SECTION_READING } from './tagReader';

describe('readTag', () => {
  it('reads a tag over several lines to its ], with each field and its line', () => {
    const text = '[node name="A"\ntype="Node2D"]\n';
    const tag = readTag(text, 0, 1, SECTION_READING);

    expect(tag).toEqual({
      name: 'node',
      fields: [
        { key: 'name', start: 11, end: 14, line: 1 },
        { key: 'type', start: 20, end: 28, line: 2 },
      ],
      end: text.indexOf(']') + 1,
      endLine: 2,
    });
  });

  it('refuses a field with no value, with the message, code and line Godot gives', () => {
    expect(readTag('[node name="A"\ntype=]', 0, 4, SECTION_READING)).toMatchObject({
      name: 'node',
      error: "Expected value, got '']''",
      code: 'ERR_PARSE_ERROR',
      line: 5,
    });
  });

  it('gives a tag whose last number reads past the end of the text a corrupt file', () => {
    expect(readTag('[node x=1', 0, 1, SECTION_READING)).toMatchObject({
      error: "Unexpected EOF while parsing tag 'node'",
      code: 'ERR_FILE_CORRUPT',
    });
  });

  it('gives nothing at the end of the text', () => {
    expect(readTag('  \n', 0, 1, SECTION_READING)).toBeNull();
  });
});

describe('readTag with the header reading', () => {
  it('refuses a reference whose id is not a string, as a Resource() path is one', () => {
    expect(readTag('[gd_scene foo=ExtResource( 1 )]', 0, 1, HEADER_READING)).toMatchObject({
      error: 'Expected string as argument for Resource()',
    });
  });
});

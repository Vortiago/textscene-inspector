import { describe, expect, it } from 'vitest';
import { XmlNodeType, XmlParser } from './xmlParser';

const TYPE_NAMES = Object.fromEntries(Object.entries(XmlNodeType).map(([name, type]) => [type, name]));

const parserOf = (text: string) => new XmlParser(new TextEncoder().encode(text));

/** Each node `read` reports, as its type and its name or text. */
function nodesOf(text: string): string[] {
  const parser = parserOf(text);
  const nodes: string[] = [];
  while (parser.read()) {
    const type = parser.nodeType;
    nodes.push(`${TYPE_NAMES[type]}:${type === XmlNodeType.TEXT ? parser.nodeData : parser.nodeName}`);
  }
  return nodes;
}

describe('XmlParser', () => {
  it('reads elements, their ends and the text between them', () => {
    expect(nodesOf('<a><b>hello</b></a> ')).toEqual([
      'ELEMENT:a',
      'ELEMENT:b',
      'TEXT:hello',
      'ELEMENT_END:b',
      'ELEMENT_END:a',
    ]);
  });

  it('reports no text of fewer than three characters that are all white space', () => {
    expect(nodesOf('<a>\n <b/>   <c/></a>.')).toEqual([
      'ELEMENT:a',
      'ELEMENT:b',
      'TEXT:   ',
      'ELEMENT:c',
      'ELEMENT_END:a',
    ]);
  });

  it('reads attributes in either quote, unescaped', () => {
    const parser = parserOf(`<a x="1 &amp; 2" y='&lt;'/> `);
    parser.read();
    expect(parser.attributes).toEqual([
      { name: 'x', value: '1 & 2' },
      { name: 'y', value: '<' },
    ]);
    expect(parser.isEmpty).toBe(true);
  });

  it('reads an element closed by a slash after its name as empty', () => {
    const parser = parserOf('<br/> ');
    parser.read();
    expect([parser.nodeName, parser.isEmpty]).toEqual(['br', true]);
  });

  it('reads a comment, a CDATA section and a definition as nodes of their own', () => {
    expect(nodesOf('<?xml version="1.0"?><!-- c --><![CDATA[x<y]]><a/> ')).toEqual([
      'UNKNOWN:?xml version="1.0"?',
      'COMMENT: c ',
      'CDATA:x<y',
      'ELEMENT:a',
    ]);
  });

  it('keeps the last element attributes through a text node', () => {
    const parser = parserOf('<g id="glyph1">text</g>');
    parser.read();
    parser.read();
    expect([parser.nodeType, parser.hasAttribute('id')]).toEqual([XmlNodeType.TEXT, true]);
  });

  it('gives each node the offset its read started at', () => {
    const parser = parserOf('<a>\n<b/></a> ');
    parser.read();
    parser.read();
    expect([parser.nodeName, parser.nodeOffset]).toEqual(['b', 3]);
  });

  it('skips the section of an element, through its end', () => {
    const parser = parserOf('<a><b><c/></b><d/></a> ');
    parser.read();
    parser.read();
    parser.skipSection();
    parser.read();
    expect(parser.nodeName).toBe('d');
  });

  it('reads again from an offset it seeks to', () => {
    const parser = parserOf('<a><b/><c/></a> ');
    expect(parser.seek(7)).toBe(true);
    expect(parser.nodeName).toBe('c');
  });

  it('stops before the last byte, as Godot reads', () => {
    expect(nodesOf('<a/>')).toEqual(['ELEMENT:a']);
    expect(nodesOf('<a/><b/>')).toEqual(['ELEMENT:a', 'ELEMENT:b']);
    expect(nodesOf('<a/>x')).toEqual(['ELEMENT:a']);
  });
});

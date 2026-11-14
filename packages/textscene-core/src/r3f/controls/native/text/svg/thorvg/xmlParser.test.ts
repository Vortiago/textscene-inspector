import { describe, expect, it } from 'vitest';
import {
  SimpleXmlType,
  simpleXmlFindAttributesTag,
  simpleXmlParse,
  simpleXmlParseAttributes,
  simpleXmlParseCssAttribute,
  simpleXmlParseW3CAttribute,
} from './xmlParser';

const TYPE_NAMES = Object.fromEntries(Object.entries(SimpleXmlType).map(([name, type]) => [type, name]));

/** Each node the parse reports, stripped, except the white space it ignores. */
function nodesOf(text: string): string[] {
  const nodes: string[] = [];
  const isParsed = simpleXmlParse(text, true, (type, content) => {
    if (type !== SimpleXmlType.Ignored) nodes.push(`${TYPE_NAMES[type]}:${content}`);
    return true;
  });
  return isParsed ? nodes : ['failed'];
}

function attributesOf(text: string): string[][] {
  const attributes: string[][] = [];
  simpleXmlParseAttributes(text, (key, value) => attributes.push([key, value]) > 0);
  return attributes;
}

function declarationsOf(text: string): string[][] {
  const declarations: string[][] = [];
  simpleXmlParseW3CAttribute(text, (key, value) => declarations.push([key, value]) > 0);
  return declarations;
}

describe('simpleXmlParse', () => {
  it('reports open, empty and close tags and the text between them', () => {
    expect(nodesOf('<svg a="1"><path d="M0"/> hi </svg>')).toEqual([
      'Open:svg a="1"',
      'OpenEmpty:path d="M0"',
      'Data:hi',
      'Close:svg',
    ]);
  });

  it('reports a comment, CDATA, a processing tag and a doctype', () => {
    expect(nodesOf('<?xml v="1"?><!DOCTYPE svg><!-- c --><style><![CDATA[ x ]]></style>')).toEqual([
      'Processing:xml v="1"',
      'Doctype:svg',
      'Comment:c',
      'Open:style',
      'CData: x ',
      'Close:style',
    ]);
  });

  it('ends a tag at a > outside its quotes', () => {
    expect(nodesOf('<a t="x>y"/>')).toEqual(['OpenEmpty:a t="x>y"']);
  });

  it('fails on a < inside a tag, or a tag with no end', () => {
    expect(nodesOf('<a <b>')).toEqual(['failed']);
    expect(nodesOf('<a')).toEqual(['failed']);
  });
});

describe('simpleXmlParseAttributes', () => {
  it('reads quoted and bare values', () => {
    expect(attributesOf(`a="1" b='2' c=3`)).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
  });

  it('drops an entity in a value and keeps the character after it', () => {
    expect(attributesOf('a="x&amp;y"')).toEqual([['a', 'xy']]);
  });

  it('trims an entity that ends the value', () => {
    expect(attributesOf('a="x&amp;"')).toEqual([['a', 'x']]);
  });

  it('reads a key spaced from its equals sign', () => {
    expect(attributesOf('a = "1"')).toEqual([['a', '1']]);
  });
});

describe('simpleXmlParseW3CAttribute', () => {
  it('reads each declaration, trimmed', () => {
    expect(declarationsOf(' fill : red ;stroke:blue')).toEqual([
      ['fill', 'red'],
      ['stroke', 'blue'],
    ]);
  });

  it('reads a declaration with no value as a key alone', () => {
    expect(declarationsOf('bare;fill:red')).toEqual([
      ['bare', ''],
      ['fill', 'red'],
    ]);
  });

  it('skips the semicolon a font face source holds', () => {
    expect(declarationsOf('src:url(data:a;b);fill:red')).toEqual([
      ['src', 'url(data:a;b)'],
      ['fill', 'red'],
    ]);
  });
});

describe('simpleXmlParseCssAttribute', () => {
  it('reads a tag rule, a class rule and a tag with a class', () => {
    expect(simpleXmlParseCssAttribute(' path {fill:red} ')).toMatchObject({
      tag: 'path',
      name: null,
      declarations: 'fill:red',
    });
    expect(simpleXmlParseCssAttribute('.a{fill:red}')).toMatchObject({ tag: 'all', name: 'a' });
    expect(simpleXmlParseCssAttribute('rect.b {x:1}')).toMatchObject({ tag: 'rect', name: 'b', next: 12 });
  });

  it('reads no rule with no braces, or a selector ending in a dot', () => {
    expect(simpleXmlParseCssAttribute('path')).toBeNull();
    expect(simpleXmlParseCssAttribute('path. {x:1}')).toBeNull();
  });
});

describe('simpleXmlFindAttributesTag', () => {
  it('finds the attributes after a tag name, or none', () => {
    expect(simpleXmlFindAttributesTag('path d="M0"')).toBe(4);
    expect(simpleXmlFindAttributesTag('path')).toBe(-1);
    expect(simpleXmlFindAttributesTag('d="M0"')).toBe(0);
  });
});

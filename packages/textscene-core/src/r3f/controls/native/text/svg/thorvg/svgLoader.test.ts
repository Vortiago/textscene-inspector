import { describe, expect, it } from 'vitest';
import { readSvgBody, readSvgHeader } from './svgLoader';
import type { SvgNode } from './svgNode';

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

function load(body: string) {
  const header = readSvgHeader(svg(body));
  const document = header && readSvgBody(header);
  if (!document) throw new Error(`expected a document for ${body}`);
  return document;
}

const types = (node: SvgNode): string[] => node.child.map((child) => child.type);

describe('loadSvg', () => {
  it('answers null for text with no svg element', () => {
    expect(loadSvg('<g><rect width="1" height="1"/></g>')).toBeNull();
  });

  it('builds the element tree under the document', () => {
    const { doc } = load('<g><rect width="4" height="2"/><circle r="1"/></g>');
    expect(types(doc)).toEqual(['G']);
    expect(types(doc.child[0]!)).toEqual(['Rect', 'Circle']);
    expect(doc.child[0]!.child[0]!.node.rect).toMatchObject({ w: 4, h: 2 });
  });

  it('lets a child inherit the fill its group sets', () => {
    const { doc } = load('<g fill="#ff0000"><rect width="1" height="1"/></g>');
    expect(doc.child[0]!.child[0]!.style.fill.paint.color).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('clones the element a use names, even one declared after it', () => {
    const { doc } = load('<use href="#late"/><rect id="late" width="3" height="3"/>');
    const use = doc.child[0]!;
    expect(types(use)).toEqual(['Rect']);
    expect(use.child[0]!.node.rect.w).toBe(3);
  });

  it('resolves a fill that names a gradient in the defs', () => {
    const { doc } = load(
      '<defs><linearGradient id="paint"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>' +
        '<rect fill="url(#paint)" width="1" height="1"/>'
    );
    const rect = doc.child.find((child) => child.type === 'Rect')!;
    expect(rect.style.fill.paint.gradient?.stops.map((stop) => stop.offset)).toEqual([0, 1]);
  });

  it('applies a style sheet class', () => {
    const { doc } = load('<style>.red{fill:#f00}</style><rect class="red" width="1" height="1"/>');
    const rect = doc.child.find((child) => child.type === 'Rect')!;
    expect(rect.style.fill.paint.color).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('puts the children of a graphic element into the shared defs, as ThorVG does', () => {
    const { doc, defs } = load('<path d="M0 0L1 1"><circle id="inner" r="1"/></path>');
    expect(types(doc)).toContain('Path');
    expect(defs?.child.map((child) => child.id)).toContain('inner');
  });
});

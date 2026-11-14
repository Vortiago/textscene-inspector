import { describe, expect, it } from 'vitest';
import { thorvgContentBox } from './contentBox';

const box = (body: string) =>
  thorvgContentBox(
    new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${body}</svg>`,
      'image/svg+xml'
    ).documentElement
  );

describe('thorvgContentBox', () => {
  it("takes a curve's control points into the box, as ThorVG's path bounds do", () => {
    expect(box('<path d="M0 0 C0 -10 10 -10 10 0"/>')).toEqual({ x: 0, y: -10, width: 10, height: 10 });
  });

  it('takes the box of a circle, an ellipse, a rect, a line and a polygon', () => {
    expect(
      box(
        '<circle cx="5" cy="5" r="5"/><ellipse cx="20" cy="5" rx="2" ry="1"/><rect x="-3" y="2" width="1" height="1"/>' +
          '<line x1="0" y1="20" x2="1" y2="21"/><polygon points="30,0 31,1 30,2"/>'
      )
    ).toEqual({ x: -3, y: 0, width: 34, height: 21 });
  });

  it('moves the corners of each box through its transform', () => {
    expect(
      box('<g transform="translate(5,0) scale(2)"><rect x="1" y="1" width="2" height="3"/></g>')
    ).toEqual({
      x: 7,
      y: 2,
      width: 4,
      height: 6,
    });
  });

  it('leaves out a group that does not display and the content of definitions', () => {
    expect(
      box(
        '<defs><rect x="-50" y="-50" width="1" height="1"/></defs><g display="none"><rect x="90" y="90" width="1" height="1"/></g>' +
          '<rect x="0" y="0" width="1" height="1"/>'
      )
    ).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('places a use at its own position and transform', () => {
    expect(
      box('<defs><rect id="r" width="2" height="2"/></defs><use xlink:href="#r" x="10" y="20"/>')
    ).toEqual({ x: 10, y: 20, width: 2, height: 2 });
  });

  it('has no box for a document with no shape', () => {
    expect(box('<defs/>')).toBeNull();
  });
});

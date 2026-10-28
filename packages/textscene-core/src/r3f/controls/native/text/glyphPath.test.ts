import { describe, expect, it } from 'vitest';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { traceGlyphContours } from './glyphPath';
import type { ContourPoint, GlyphContours } from './glyphContours';

const { ON, OFF_CONIC, OFF_CUBIC } = ContourPointTag;

type PathSink = Parameters<typeof traceGlyphContours>[0];

function recordingSink(): { sink: PathSink; calls: (string | number)[][] } {
  const calls: (string | number)[][] = [];
  const sink: PathSink = {
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    quadraticCurveTo: (...args) => calls.push(['quadraticCurveTo', ...args]),
    bezierCurveTo: (...args) => calls.push(['bezierCurveTo', ...args]),
    closePath: () => calls.push(['closePath']),
  };
  return { sink, calls };
}

function contoursOf(
  points: [number, number, ContourPoint['tag']][],
  contourEnds = [points.length - 1]
): GlyphContours {
  return {
    points: points.map(([x, y, tag]) => ({ x, y, tag })),
    contourEnds,
    isFillRight: true,
  };
}

describe('traceGlyphContours', () => {
  it('moves to the first on-curve point and closes a polygon, offset by the origin', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [0, 0, ON],
        [4, 0, ON],
        [4, -4, ON],
      ]),
      10,
      20
    );

    expect(calls).toEqual([['moveTo', 10, 20], ['lineTo', 14, 20], ['lineTo', 14, 16], ['closePath']]);
  });

  it('starts a contour at its last point when that is on the curve and the first is a control point', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [2, -4, OFF_CONIC],
        [4, 0, ON],
        [0, 0, ON],
      ]),
      0,
      0
    );

    expect(calls).toEqual([['moveTo', 0, 0], ['quadraticCurveTo', 2, -4, 4, 0], ['closePath']]);
  });

  it('starts between the first and last points when both are control points', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [0, -4, OFF_CONIC],
        [4, 0, ON],
        [0, 4, OFF_CONIC],
      ]),
      0,
      0
    );

    expect(calls).toEqual([
      ['moveTo', 0, 0],
      ['quadraticCurveTo', 0, -4, 4, 0],
      ['quadraticCurveTo', 0, 4, 0, 0],
      ['closePath'],
    ]);
  });

  it('splits two control points in a row at their midpoint', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [0, 0, ON],
        [2, -4, OFF_CONIC],
        [6, -4, OFF_CONIC],
        [8, 0, ON],
      ]),
      0,
      0
    );

    expect(calls).toEqual([
      ['moveTo', 0, 0],
      ['quadraticCurveTo', 2, -4, 4, -4],
      ['quadraticCurveTo', 6, -4, 8, 0],
      ['closePath'],
    ]);
  });

  it('draws a cubic arc from its two control points to the next point', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [0, 0, ON],
        [0, -4, OFF_CUBIC],
        [4, -4, OFF_CUBIC],
        [4, 0, ON],
      ]),
      0,
      0
    );

    expect(calls).toEqual([['moveTo', 0, 0], ['bezierCurveTo', 0, -4, 4, -4, 4, 0], ['closePath']]);
  });

  it('closes a cubic arc that ends on the start of the contour', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf([
        [0, 0, ON],
        [4, 0, ON],
        [4, -4, OFF_CUBIC],
        [0, -4, OFF_CUBIC],
      ]),
      0,
      0
    );

    expect(calls).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 4, 0],
      ['bezierCurveTo', 4, -4, 0, -4, 0, 0],
      ['closePath'],
    ]);
  });

  it('traces each contour on its own', () => {
    const { sink, calls } = recordingSink();

    traceGlyphContours(
      sink,
      contoursOf(
        [
          [0, 0, ON],
          [4, 0, ON],
          [4, -4, ON],
          [1, -1, ON],
          [2, -1, ON],
          [2, -2, ON],
        ],
        [2, 5]
      ),
      0,
      0
    );

    expect(calls.filter(([op]) => op === 'moveTo')).toEqual([
      ['moveTo', 0, 0],
      ['moveTo', 1, -1],
    ]);
    expect(calls.filter(([op]) => op === 'closePath')).toHaveLength(2);
  });
});

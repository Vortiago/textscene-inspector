import { describe, expect, it } from 'vitest';
import { freeTypeChordSink, ONE_PIXEL } from './freeTypeChords';

/** A 1/256 px step, the precision of FreeType's smooth rasteriser. */
const SUBPIXEL = 1 / ONE_PIXEL;

/** The chord ends after the first point, back in canvas px with y down. */
function recordedChords(draw: (sink: ReturnType<typeof freeTypeChordSink>) => void): number[][] {
  const calls: number[][] = [];
  const sink = freeTypeChordSink({
    moveTo: (x, y) => calls.push([x / ONE_PIXEL, -y / ONE_PIXEL]),
    lineTo: (x, y) => calls.push([x / ONE_PIXEL, -y / ONE_PIXEL]),
    closePath: () => {},
  });
  draw(sink);
  return calls.slice(1);
}

describe('freeTypeChordSink', () => {
  it('draws a conic within 1/16 px of its chord as that one chord', () => {
    const chords = recordedChords((sink) => {
      sink.moveTo(0, 0);
      sink.quadraticCurveTo(0.25, 0, 0.25, 0.25);
    });

    expect(chords).toEqual([[0.25, 0.25]]);
  });

  it('cuts a deeper conic into the power-of-two chords whose deviation is within 1/16 px', () => {
    const chords = recordedChords((sink) => {
      sink.moveTo(0, 0);
      sink.quadraticCurveTo(2, 0, 2, 2);
    });

    // The Bézier points at t = 1/4, 1/2, 3/4 and 1.
    expect(chords).toEqual([
      [0.875, 0.125],
      [1.5, 0.5],
      [1.875, 1.125],
      [2, 2],
    ]);
  });

  it('floors each chord point to 1/256 px with y up, as the outline frame of FreeType runs', () => {
    const chords = recordedChords((sink) => {
      sink.moveTo(0, 0);
      sink.quadraticCurveTo(129 * SUBPIXEL, SUBPIXEL, 0.5, 0.5);
    });

    // At t = 1/2 the curve sits at x 96.5 and y 32.5 steps down: x floors, and y rounds up the page.
    expect(chords).toEqual([
      [96 * SUBPIXEL, 33 * SUBPIXEL],
      [0.5, 0.5],
    ]);
  });

  it('splits a cubic in halves until each control point is within 1/2 px of its chord trisection', () => {
    const chords = recordedChords((sink) => {
      sink.moveTo(0, 0);
      sink.bezierCurveTo(0, 0.5, 0.5, 0.5, 0.5, 0);
    });

    expect(chords).toEqual([
      [0.25, 0.375],
      [0.5, 0],
    ]);
  });

  it('passes lines through in 1/256 px with y up, and closes on the sink', () => {
    const calls: string[] = [];
    const sink = freeTypeChordSink({
      moveTo: (x, y) => calls.push(`M${x},${y}`),
      lineTo: (x, y) => calls.push(`L${x},${y}`),
      closePath: () => calls.push('Z'),
    });

    sink.moveTo(1, 2);
    sink.lineTo(3.25, 4);
    sink.closePath();

    expect(calls).toEqual(['M256,-512', 'L832,-1024', 'Z']);
  });
});

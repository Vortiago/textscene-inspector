import { describe, expect, it } from 'vitest';
import { SENTINEL_BITS } from '../../../../scripts/godot-probes/probeShader.mjs';
import { printedProbes, printedTextFaults } from '../../../../scripts/godot-probes/printedText.mjs';

const SOURCE = 'float probe(float a0) { return a0 + a0 * a0; }';
const PROBE = { name: 'sum', source: SOURCE, inputs: [[1]], rows: [] };
const PRINT = (source) =>
  source === SOURCE ? 'float probe(float a0) {\n\treturn (a0 + (a0 * a0));\n}' : undefined;

/** Pixels of a one-lane float probe: the result bits, then the sentinel. */
const drawn = (bits) => [bits, SENTINEL_BITS];
const [PRINTED] = printedProbes([PROBE], PRINT);

describe('the printed form of each probe', () => {
  it('holds the printed text under its own name, with its original', () => {
    expect(PRINTED).toMatchObject({ name: 'printed-sum', source: PRINT(SOURCE), original: PROBE });
  });

  it('leaves out a probe the front end refuses', () => {
    expect(printedProbes([{ ...PROBE, source: 'float probe(float a0) { return b; }' }], PRINT)).toEqual([]);
  });

  it('leaves out a probe that ends Godot', () => {
    expect(printedProbes([{ ...PROBE, endsGodot: true }], PRINT)).toEqual([]);
  });
});

describe("Godot's answer to a printed text", () => {
  const faults = (printedPixels, rejections = new Map()) =>
    printedTextFaults(
      [PRINTED],
      {
        pixels: new Map([
          ['sum', drawn(0x40000000)],
          ['printed-sum', printedPixels],
        ]),
      },
      rejections
    );

  it('passes with the same result bits', () => {
    expect(faults(drawn(0x40000000))).toEqual([]);
  });

  it('fails on other result bits', () => {
    expect(faults(drawn(0x40000001))).toEqual([expect.stringMatching(/^sum: Godot answers/)]);
  });

  it('fails when Godot refuses the printed text only', () => {
    const refusal = new Map([['printed-sum', { stage: 'GLSL', message: 'x' }]]);
    expect(faults([0, 0], refusal)).toHaveLength(1);
  });

  it('passes on the same refusal at another line', () => {
    const refusal = (line) => ({ stage: 'shading language', message: 'Division by zero error.', line });
    const pixels = new Map([
      ['sum', [0, 0]],
      ['printed-sum', [0, 0]],
    ]);
    const rejections = new Map([
      ['sum', refusal(9)],
      ['printed-sum', refusal(11)],
    ]);
    expect(printedTextFaults([PRINTED], { pixels }, rejections)).toEqual([]);
  });
});

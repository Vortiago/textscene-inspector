import { describe, expect, it } from 'vitest';
import { glVaryingSlots } from './glVaryingSlots';

/** A context whose vertex stage writes `vertexOutputs` lanes and fragment stage reads `fragmentInputs`. */
function contextOf(vertexOutputs: number, fragmentInputs: number): WebGL2RenderingContext {
  const parameters = new Map([
    [0x9122, vertexOutputs],
    [0x9125, fragmentInputs],
  ]);
  return {
    MAX_VERTEX_OUTPUT_COMPONENTS: 0x9122,
    MAX_FRAGMENT_INPUT_COMPONENTS: 0x9125,
    getParameter: (name: number) => parameters.get(name),
  } as unknown as WebGL2RenderingContext;
}

describe('glVaryingSlots', () => {
  it('gives four lanes a slot', () => {
    expect(glVaryingSlots(contextOf(128, 128))).toBe(32);
  });

  it('takes the smaller of the two stages', () => {
    expect(glVaryingSlots(contextOf(128, 124))).toBe(31);
  });

  it('drops a part slot, as Godot divides integers (edge case)', () => {
    expect(glVaryingSlots(contextOf(64, 62))).toBe(15);
  });
});

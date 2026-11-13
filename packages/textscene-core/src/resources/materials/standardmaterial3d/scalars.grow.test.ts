/**
 * StandardMaterial3D's chain fields, parse layer: the `next_pass` reference as authored,
 * and the `grow`/`grow_amount` pair whose shader line `material.cpp:1458-1461` emits. The
 * `readsStencil` decision mirrors `render_forward_clustered.cpp:4099-4114`'s read, and a
 * link that reads the stencil draws no coverage here, since the buffer itself is not
 * requested. The chain walk itself lives in `nextPassWalk.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { decodeStandardMaterial3D } from './decode';
import { parseStandardMaterial3DScalars } from './scalars';

const blueTresOutlinePass = {
  render_priority: '1',
  transparency: '1',
  shading_mode: '0',
  albedo_color: 'Color(0, 0, 0, 1)',
  grow: 'true',
  grow_amount: '0.03',
  stencil_mode: '3',
  stencil_flags: '1',
  stencil_compare: '5',
};

describe('decodeStandardMaterial3D: next_pass', () => {
  it('carries the authored reference verbatim, undefined when absent', () => {
    // The raw string, as `textureSlots` does: resolving it needs the tables of
    // the file the material arrived in, so decode stops here.
    expect(decodeStandardMaterial3D({}).nextPass).toBeUndefined();
    const reference = 'SubResource("StandardMaterial3D_1")';
    expect(decodeStandardMaterial3D({ next_pass: reference }).nextPass).toBe(reference);
  });

  it('carries a file reference and a malformed one alike', () => {
    // A lookup, not a validator: the chain resolver decides what a reference
    // names, and a malformed one ends the chain there.
    expect(decodeStandardMaterial3D({ next_pass: 'ExtResource("7")' }).nextPass).toBe('ExtResource("7")');
    expect(decodeStandardMaterial3D({ next_pass: 'Color(1, 0, 0, 1)' }).nextPass).toBe('Color(1, 0, 0, 1)');
  });
});

describe('parseStandardMaterial3DScalars: grow', () => {
  it('reads an authored grow with its amount', () => {
    const scalars = parseStandardMaterial3DScalars({ grow: 'true', grow_amount: '0.03' });
    expect([scalars.grows, scalars.growAmount]).toEqual([true, 0.03]);
  });

  it("takes Godot's constructor defaults from an empty bag (material.cpp:3990)", () => {
    // `set_grow(0.0)`, so `grow` is off and the amount 0.0.
    const scalars = parseStandardMaterial3DScalars({});
    expect([scalars.grows, scalars.growAmount]).toEqual([false, 0]);
  });

  it('reads the amount only behind the flag, as the shader generates the uniform only when on', () => {
    // An authored `grow_amount` with `grow` unset still leaves the shader bare,
    // since `material.cpp:973-974` emits the uniform under `grow_enabled`.
    expect(parseStandardMaterial3DScalars({ grow_amount: '0.03' }).grows).toBe(false);
  });

  it('keeps a negative amount that shrinks, and one outside the inspector hint (edge case)', () => {
    // `set_grow` (`material.cpp:2942`) bare assigns; `-16,16,0.001` is only the hint.
    expect(parseStandardMaterial3DScalars({ grow: 'true', grow_amount: '-0.03' }).growAmount).toBe(-0.03);
    expect(parseStandardMaterial3DScalars({ grow: 'true', grow_amount: '20' }).growAmount).toBe(20);
  });

  it('reads a flag value that is no boolean as false (error case)', () => {
    expect(parseStandardMaterial3DScalars({ grow: 'sure' }).grows).toBe(false);
  });
});

describe('parseStandardMaterial3DScalars: readsStencil', () => {
  it('reads the ragdoll outline pass as a stencil reader', () => {
    // `material.cpp:3159-3215` builds every owned outline pass exactly so:
    // CUSTOM mode, the READ bit, NOT_EQUAL.
    expect(parseStandardMaterial3DScalars(blueTresOutlinePass).readsStencil).toBe(true);
  });

  it('reads an owned OUTLINE shape and an owned XRAY shape as stencil readers', () => {
    expect(
      parseStandardMaterial3DScalars({ stencil_mode: '1', stencil_flags: '1', stencil_compare: '5' })
        .readsStencil
    ).toBe(true);
    expect(
      parseStandardMaterial3DScalars({ stencil_mode: '2', stencil_flags: '1', stencil_compare: '3' })
        .readsStencil
    ).toBe(true);
  });

  it('reads a disabled mode as no stencil reader (edge case)', () => {
    // The generated shader emits no stencil block at all (material.cpp:916-968).
    expect(
      parseStandardMaterial3DScalars({ stencil_mode: '0', stencil_flags: '1', stencil_compare: '5' })
        .readsStencil
    ).toBe(false);
  });

  it('reads a write-only flag set as no stencil reader (edge case)', () => {
    // The link reads no stencil value, so its draw can go ahead.
    expect(
      parseStandardMaterial3DScalars({ stencil_mode: '3', stencil_flags: '2', stencil_compare: '5' })
        .readsStencil
    ).toBe(false);
  });

  it('reads an ALWAYS compare as no stencil reader (edge case)', () => {
    // Every fragment passes, so the draw needs no stencil value.
    expect(
      parseStandardMaterial3DScalars({ stencil_mode: '3', stencil_flags: '1', stencil_compare: '0' })
        .readsStencil
    ).toBe(false);
  });

  it('reads no flags as no stencil reader (error case)', () => {
    expect(parseStandardMaterial3DScalars({ stencil_mode: '3', stencil_compare: '5' }).readsStencil).toBe(
      false
    );
  });
});

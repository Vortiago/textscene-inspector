/**
 * `<ColorPicker>` — the colour sample row (including `btn_pick`/`btn_shape`),
 * the `SHAPE_HSV_RECTANGLE` SV square/hue slider, and the mode/slider-grid/
 * hex/swatches rows (`color_picker.cpp`/`color_mode.cpp`, this component's
 * own doc for exact line citations).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { ColorPicker } from './Component';

const THEME = nativeTheme(1);

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = { name: 'P', type: 'ColorPicker', children: [], properties };
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

/** Hides every row this file's shape/sample-only tests are not about, isolating the mesh counts the original tests already pinned. */
const ONLY_SHAPE_AND_SAMPLE = {
  colorModesVisible: false,
  slidersVisible: false,
  hexVisible: false,
  presetsVisible: false,
};

async function meshCount(properties: Record<string, unknown>): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(
    <ColorPicker {...painterEnv()} theme={THEME} solveNode={node(properties)} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
  );
  return renderer.scene.findAllByType('Mesh').length;
}

describe('<ColorPicker> (isolated painter contract)', () => {
  it('draws the pick button box, the sample swatch and the full SV-rectangle shape at the default picker_shape', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // btn_pick box + swatch + (sv base, sv hue, cursor bg, cursor ring, hue strip, hue line)
    expect(meshes).toHaveLength(8);
  });

  it('draws the checkerboard only when the colour is translucent — color_picker.cpp:1400', async () => {
    const opaqueCount = await meshCount({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE });
    const translucentCount = await meshCount({ color: 'Color(1, 0, 0, 0.5)', ...ONLY_SHAPE_AND_SAMPLE });
    expect(translucentCount).toBe(opaqueCount + 1);
  });

  it('draws an overbright indicator when a channel exceeds 1 — color_picker.cpp:1411-1413', async () => {
    expect(await meshCount({ color: 'Color(1.5, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })).toBe(9);
  });

  it('draws only the pick/shape buttons\' box and the sample swatch for any picker_shape but SHAPE_HSV_RECTANGLE (0)', async () => {
    // picker_shape=1 keeps btn_shape visible (only SHAPE_NONE=4 hides it), but
    // draws no icon (themeIcons.ts is out of scope) — so still just the box + swatch.
    expect(await meshCount({ color: 'Color(1, 0, 0, 1)', pickerShape: 1, ...ONLY_SHAPE_AND_SAMPLE })).toBe(2);
  });

  it('draws only the pick button box and the sample swatch at SHAPE_NONE (4), matching Godot exactly', async () => {
    expect(await meshCount({ color: 'Color(1, 0, 0, 1)', pickerShape: 4, ...ONLY_SHAPE_AND_SAMPLE })).toBe(2);
  });

  it('colours the SV square gradient at hue=0 (pure red) unmodulated by an opaque-white tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // 0: pick button box, 1: swatch, 2: sv base, 3: sv hue layer (base=0, hue=1).
    const hueMesh = meshes[3]!.instance as THREE.Mesh;
    const color = hueMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    // top-right vertex (index 1): full red, alpha 1.
    expect(color.getX(1)).toBeCloseTo(1);
    expect(color.getY(1)).toBeCloseTo(0);
    expect(color.getZ(1)).toBeCloseTo(0);
    expect(color.getW(1)).toBeCloseTo(1);
  });

  it('multiplies every gradient vertex by the walker-composed tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={node({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    const baseMesh = meshes[2]!.instance as THREE.Mesh;
    const color = baseMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    // top-left vertex is white(1,1,1,1) in the untinted layer; tinted by 0.5.
    expect(color.getX(0)).toBeCloseTo(0.5);
    expect(color.getY(0)).toBeCloseTo(0.5);
    expect(color.getZ(0)).toBeCloseTo(0.5);
  });

  it('positions the cursor at the square bounds for s=0, v=1 (pure white)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker {...painterEnv()} theme={THEME} solveNode={node({ color: 'Color(1, 1, 1, 1)', ...ONLY_SHAPE_AND_SAMPLE })} rect={{ x: 0, y: 0, w: 400, h: 400 }} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // Cursor bg is mesh index 4 (pick box, swatch, base, hue, cursorBg, cursorRing, hueStrip, hueLine).
    const cursorBgMesh = meshes[4]!.instance as THREE.Mesh;
    const groupPosition = cursorBgMesh.parent!.position;
    // s=0 -> cursor.x = svSquare.x = 0; v=1 -> cursor.y = svSquare.y = 0.
    // The group offsets by -size/2 in local x and +size/2 (negated) in y.
    expect(groupPosition.x).toBeCloseTo(-6);
    expect(groupPosition.y).toBeCloseTo(6);
  });

  it('draws nothing at all when every row is hidden but shape stays a zero-height stacking slot', async () => {
    expect(
      await meshCount({
        color: 'Color(1, 0, 0, 1)',
        pickerShape: 4,
        samplerVisible: false,
        ...ONLY_SHAPE_AND_SAMPLE,
      })
    ).toBe(0);
  });

  it('mode row: drops to 0 extra meshes when hidden, adds label meshes when shown', async () => {
    const hidden = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: false, slidersVisible: false, hexVisible: false, presetsVisible: false });
    const shown = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: true, slidersVisible: false, hexVisible: false, presetsVisible: false });
    expect(shown).toBeGreaterThan(hidden);
  });

  it('slider grid draws a gradient band per channel row for MODE_RGB (default)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({ color: 'Color(1, 0, 0, 1)', pickerShape: 4, samplerVisible: false, colorModesVisible: false, hexVisible: false, presetsVisible: false })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    // 5 rows (R,G,B,I,A — edit_alpha/edit_intensity both default true), each
    // with a label TextRun, a StyleBoxQuad value box and a value TextRun;
    // R/G/B/A additionally draw a gradient band (intensity has no gradient —
    // `colorModes.ts` gives it an empty stops list).
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(5 /* labels */ + 5 /* value boxes */ + 5 /* value text */ + 4 /* R,G,B,A gradient bands */);
  });

  it('hex row draws a field box and its text — hex_visible default true', async () => {
    const hidden = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: false, slidersVisible: false, hexVisible: false, presetsVisible: false });
    const shown = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: false, slidersVisible: false, hexVisible: true, presetsVisible: false });
    expect(shown).toBeGreaterThan(hidden);
  });

  it('swatches row draws its two button labels — presets_visible default true', async () => {
    const hidden = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: false, slidersVisible: false, hexVisible: false, presetsVisible: false });
    const shown = await meshCount({ pickerShape: 4, samplerVisible: false, colorModesVisible: false, slidersVisible: false, hexVisible: false, presetsVisible: true });
    expect(shown).toBeGreaterThan(hidden);
  });
});

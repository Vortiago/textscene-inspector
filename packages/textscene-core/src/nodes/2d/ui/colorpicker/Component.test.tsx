/**
 * `<ColorPicker>`: the colour sample row (with `btn_pick` and `btn_shape`), the
 * `SHAPE_HSV_RECTANGLE` SV square and hue slider, and the mode, slider-grid, hex and
 * swatches rows (`color_picker.cpp`, `color_mode.cpp`, cited in the component's doc).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { ColorPicker } from './Component';
import { canvasColorSpaceOf, CanvasColorSpaceProvider } from '../../../../r3f/canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

const THEME = nativeTheme(1);

function node(properties: Record<string, unknown>): SolveNode {
  const tscnNode: TscnNode = controlNode('P', 'ColorPicker', properties);
  return { ...emptySolveNode(), path: 'P', node: tscnNode };
}

/** Hides every row the shape and sample tests are not about, so their mesh counts stay isolated. */
const ONLY_SHAPE_AND_SAMPLE = {
  colorModesVisible: false,
  slidersVisible: false,
  hexVisible: false,
  presetsVisible: false,
};

/** Hides every row but the slider grid. */
const ONLY_SLIDERS = {
  color: 'Color(0.8, 0.6, 0.4, 1)',
  pickerShape: 4,
  samplerVisible: false,
  colorModesVisible: false,
  hexVisible: false,
  presetsVisible: false,
};

/** Hides every row but the hex row. */
const ONLY_HEX = {
  pickerShape: 4,
  samplerVisible: false,
  colorModesVisible: false,
  slidersVisible: false,
  presetsVisible: false,
};

async function meshCount(properties: Record<string, unknown>): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(
    <ColorPicker
      {...painterEnv()}
      theme={THEME}
      solveNode={node(properties)}
      rect={{ x: 0, y: 0, w: 400, h: 400 }}
      renderOrder={0}
    />
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
    // btn_pick box + btn_pick icon + btn_shape icon + swatch + (sv base, sv
    // hue, cursor bg, cursor ring, hue strip, hue line)
    expect(meshes).toHaveLength(10);
  });

  it('draws the checkerboard only when the colour is translucent — color_picker.cpp:1400', async () => {
    const opaqueCount = await meshCount({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE });
    const translucentCount = await meshCount({ color: 'Color(1, 0, 0, 0.5)', ...ONLY_SHAPE_AND_SAMPLE });
    expect(translucentCount).toBe(opaqueCount + 1);
  });

  it('draws an overbright indicator when a channel exceeds 1 — color_picker.cpp:1411-1413', async () => {
    expect(await meshCount({ color: 'Color(1.5, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })).toBe(11);
  });

  it('draws only the pick button box + icon and the sample swatch for any picker_shape but SHAPE_HSV_RECTANGLE (0)', async () => {
    // picker_shape=1 keeps btn_shape visible (only SHAPE_NONE=4 hides it) and
    // draws its box, but `shape_rect` is only correct at SHAPE_HSV_RECTANGLE
    // (other shapes are out of scope, `comparison.md`) so its icon stays undrawn.
    expect(await meshCount({ color: 'Color(1, 0, 0, 1)', pickerShape: 1, ...ONLY_SHAPE_AND_SAMPLE })).toBe(3);
  });

  it('draws only the pick button box + icon and the sample swatch at SHAPE_NONE (4), matching Godot exactly', async () => {
    expect(await meshCount({ color: 'Color(1, 0, 0, 1)', pickerShape: 4, ...ONLY_SHAPE_AND_SAMPLE })).toBe(3);
  });

  it('colours the SV square gradient at hue=0 (pure red) unmodulated by an opaque-white tint', async () => {
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
    // 0: pick box, 1: pick icon, 2: shape icon, 3: swatch, 4: sv base, 5: sv hue layer.
    const hueMesh = meshes[5]!.instance as THREE.Mesh;
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
    // 0: pick box, 1: pick icon, 2: shape icon, 3: swatch, 4: sv base.
    const baseMesh = meshes[4]!.instance as THREE.Mesh;
    const color = baseMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    // The top-left vertex is white(1,1,1,1) in the untinted layer, tinted by 0.5.
    expect(color.getX(0)).toBeCloseTo(0.5);
    expect(color.getY(0)).toBeCloseTo(0.5);
    expect(color.getZ(0)).toBeCloseTo(0.5);
  });

  it('carries the tint on the material in a linear canvas, which decodes the vertex colours apart', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CanvasColorSpaceProvider value={LINEAR_CANVAS}>
        <ColorPicker
          {...painterEnv()}
          theme={THEME}
          tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
          solveNode={node({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })}
          rect={{ x: 0, y: 0, w: 400, h: 400 }}
          renderOrder={0}
        />
      </CanvasColorSpaceProvider>
    );
    const baseMesh = renderer.scene.findAllByType('Mesh')[4]!.instance as THREE.Mesh;
    const material = baseMesh.material as THREE.MeshBasicMaterial;
    expect((baseMesh.geometry.getAttribute('color') as THREE.BufferAttribute).getX(0)).toBeCloseTo(1);
    expect(material.color.r).toBeCloseTo(0.214041, 5);
    expect(material.defines).toEqual(LINEAR_CANVAS.defines);
  });

  it('positions the cursor at the square bounds for s=0, v=1 (pure white)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({ color: 'Color(1, 1, 1, 1)', ...ONLY_SHAPE_AND_SAMPLE })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    // Cursor bg is mesh index 6 (pick box, pick icon, shape icon, swatch, base, hue, cursorBg, …).
    const cursorBgMesh = meshes[6]!.instance as THREE.Mesh;
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
    const hidden = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: false,
      slidersVisible: false,
      hexVisible: false,
      presetsVisible: false,
    });
    const shown = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: true,
      slidersVisible: false,
      hexVisible: false,
      presetsVisible: false,
    });
    expect(shown).toBeGreaterThan(hidden);
  });

  it('slider grid draws a gradient band per channel row for MODE_RGB (default)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({
          color: 'Color(1, 0, 0, 1)',
          pickerShape: 4,
          samplerVisible: false,
          colorModesVisible: false,
          hexVisible: false,
          presetsVisible: false,
        })}
        rect={{ x: 0, y: 0, w: 400, h: 400 }}
        renderOrder={0}
      />
    );
    // 5 rows (R, G, B, I, A: edit_alpha and edit_intensity default true), each a label,
    // a value field box, a value TextRun and two SpinBox arrows. R, G, B and A are colorized
    // (`_reset_sliders_theme`): a gradient band and the `bar_arrow` grabber. Intensity keeps
    // the stock HSlider chrome: track, grabber_area fill and the circle grabber.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBe(
      5 /* labels */ +
        5 /* value field boxes */ +
        5 /* value text */ +
        10 /* 5 rows * (up+down arrows) */ +
        4 /* R,G,B,A gradient bands */ +
        1 /* the checkerboard under the A band: color_picker.cpp:1434 */ +
        4 /* R,G,B,A bar_arrow grabbers */ +
        3 /* intensity: track+fill+grabber */
    );
  });

  it('sizes the slider band to 185px in a 300px picker, as Godot measures: band 25..210, field at 214', async () => {
    // The value column is the SpinBox minimum with the W advance unrounded (15.125 px), then truncated by
    // `GridContainer` to 86 (`grid_container.cpp:290`). A ceiled advance gave 90 and a 181px band.
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        theme={THEME}
        solveNode={node({
          color: 'Color(0.8, 0.6, 0.4, 1)',
          colorMode: 1,
          pickerShape: 4,
          samplerVisible: false,
          colorModesVisible: false,
          hexVisible: false,
          presetsVisible: false,
        })}
        rect={{ x: 0, y: 0, w: 300, h: 160 }}
        renderOrder={0}
      />
    );
    const bandWidths = renderer.scene
      .findAllByType('Mesh')
      .map((mesh) => {
        const geometry = (mesh.instance as THREE.Mesh).geometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        return box.max.x - box.min.x;
      })
      .filter((width) => width > 100);
    // Every band is 185px wide. The intensity track is 186px: it is not a band.
    expect(new Set(bandWidths)).toEqual(new Set([185, 186]));
  });

  it('draws the H row of color_mode HSV as a grey polygon and the color_hue rainbow over it — color_mode.cpp:200-221', async () => {
    const rgb = await meshCount({ ...ONLY_SLIDERS, colorMode: 0 });
    // R's one gradient band becomes H's grey base plus its rainbow.
    expect(await meshCount({ ...ONLY_SLIDERS, colorMode: 1 })).toBe(rgb + 1);
  });

  it('hex row draws a field box and its text — hex_visible default true', async () => {
    const hidden = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: false,
      slidersVisible: false,
      hexVisible: false,
      presetsVisible: false,
    });
    const shown = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: false,
      slidersVisible: false,
      hexVisible: true,
      presetsVisible: false,
    });
    expect(shown).toBeGreaterThan(hidden);
  });

  it('draws the disabled script icon in text_type for an HDR colour, not for an ordinary one — color_picker.cpp:1319-1325', async () => {
    // `icon_disabled_color` is `Color(1, 1, 1, 0.4)` (`default_theme.cpp:169`).
    const iconOpacities = async (color: string) => {
      const renderer = await ReactThreeTestRenderer.create(
        <ColorPicker
          {...painterEnv()}
          theme={THEME}
          solveNode={node({ color, ...ONLY_HEX })}
          rect={{ x: 0, y: 0, w: 300, h: 60 }}
          renderOrder={0}
        />
      );
      return renderer.scene
        .findAllByType('Mesh')
        .map((mesh) => ((mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity)
        .filter((opacity) => Math.abs(opacity - 0.4) < 1e-6);
    };
    expect(await iconOpacities('Color(1.5, 0.5, 0.25, 1)')).toHaveLength(1);
    expect(await iconOpacities('Color(0.8, 0.6, 0.4, 1)')).toHaveLength(0);
  });

  it('swatches row draws its two button labels — presets_visible default true', async () => {
    const hidden = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: false,
      slidersVisible: false,
      hexVisible: false,
      presetsVisible: false,
    });
    const shown = await meshCount({
      pickerShape: 4,
      samplerVisible: false,
      colorModesVisible: false,
      slidersVisible: false,
      hexVisible: false,
      presetsVisible: true,
    });
    expect(shown).toBeGreaterThan(hidden);
  });
});

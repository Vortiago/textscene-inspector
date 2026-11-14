/**
 * `<ColorPicker>`: the shape row of each `picker_shape`, the colour sample row (with `btn_pick`
 * and `btn_shape`), and the mode, slider-grid, hex and swatches rows (`color_picker.cpp`,
 * `color_picker_shape.cpp`, `color_mode.cpp`, cited in the component's doc).
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { ColorPicker } from './Component';
import { countTintSplit, splitTints } from '../../../../r3f/controls/native/testing/tintSplit';
import { canvasColorSpaceOf, CanvasColorSpaceProvider } from '../../../../r3f/canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const THEME = nativeTheme(1);

function node(properties: Record<string, unknown>, themeChain: ThemeResource[] = []): SolveNode {
  const tscnNode: TscnNode = controlNode('P', 'ColorPicker', properties);
  return withThemeItems({ ...emptySolveNode(), path: 'P', node: tscnNode, themeChain });
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

/** Hides every row but the swatches row. */
const ONLY_SWATCHES = {
  pickerShape: 4,
  samplerVisible: false,
  colorModesVisible: false,
  slidersVisible: false,
  hexVisible: false,
};

/** Hides every row but the hex row. */
const ONLY_HEX = {
  pickerShape: 4,
  samplerVisible: false,
  colorModesVisible: false,
  slidersVisible: false,
  presetsVisible: false,
};

async function renderPicker(
  properties: Record<string, unknown>,
  size = { w: 400, h: 400 },
  themeChain: ThemeResource[] = []
) {
  return ReactThreeTestRenderer.create(
    <ColorPicker
      {...painterEnv()}
      theme={THEME}
      solveNode={node(properties, themeChain)}
      rect={{ x: 0, y: 0, ...size }}
      renderOrder={0}
    />
  );
}

async function meshCount(properties: Record<string, unknown>): Promise<number> {
  return (await renderPicker(properties)).scene.findAllByType('Mesh').length;
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

  it('draws the checkerboard only when the colour is translucent: color_picker.cpp:1400', async () => {
    const opaqueCount = await meshCount({ color: 'Color(1, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE });
    const translucentCount = await meshCount({ color: 'Color(1, 0, 0, 0.5)', ...ONLY_SHAPE_AND_SAMPLE });
    expect(translucentCount).toBe(opaqueCount + 1);
  });

  it('draws an overbright indicator when a channel exceeds 1: color_picker.cpp:1411-1413', async () => {
    expect(await meshCount({ color: 'Color(1.5, 0, 0, 1)', ...ONLY_SHAPE_AND_SAMPLE })).toBe(11);
  });

  it('draws the wheel: its shader fill, the SV square, the SV and hue cursors, and the btn_shape icon', async () => {
    // btn_pick box + btn_pick icon + btn_shape icon + swatch + (wheel fill, sv base, sv hue,
    // sv cursor bg, sv cursor ring, hue cursor ring)
    expect(await meshCount({ color: 'Color(1, 0, 0, 1)', pickerShape: 1, ...ONLY_SHAPE_AND_SAMPLE })).toBe(
      10
    );
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
        childTint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
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
          childTint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
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

  it('sizes every slider band to 185px in a 300px picker, as Godot measures (band ends at x = 210)', async () => {
    // The value column is the SpinBox minimum with the W advance unrounded (15.125 px), then truncated by
    // `GridContainer` to 86 (`grid_container.cpp:290`).
    const renderer = await renderPicker({ ...ONLY_SLIDERS, colorMode: 1 }, { w: 300, h: 160 });
    const bandWidths = renderer.scene
      .findAllByType('Mesh')
      .map((mesh) => {
        const geometry = (mesh.instance as THREE.Mesh).geometry;
        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        return box.max.x - box.min.x;
      })
      .filter((width) => width > 100);
    // H's grey base and rainbow, S, V, A and the checkerboard under A: six 185px bands. The intensity
    // track is the one 186px mesh.
    expect(bandWidths.filter((width) => width === 185)).toHaveLength(6);
    expect(bandWidths.filter((width) => width === 186)).toHaveLength(1);
    expect(bandWidths).toHaveLength(7);
  });

  it('draws the H row of color_mode HSV as a grey polygon and the color_hue rainbow over it: color_mode.cpp:200-221', async () => {
    const rgb = await meshCount({ ...ONLY_SLIDERS, colorMode: 0 });
    // R's one gradient band becomes H's grey base plus its rainbow.
    expect(await meshCount({ ...ONLY_SLIDERS, colorMode: 1 })).toBe(rgb + 1);
  });

  it('hex row draws a field box and its text: hex_visible default true', async () => {
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

  it('draws the disabled script icon in text_type for an HDR colour, not for an ordinary one: color_picker.cpp:1319-1325', async () => {
    // `icon_disabled_color` is `Color(1, 1, 1, 0.4)` (`default_theme.cpp:169`).
    const iconOpacities = async (color: string) => {
      const renderer = await renderPicker({ color, ...ONLY_HEX }, { w: 300, h: 60 });
      return (
        renderer.scene
          .findAllByType('Mesh')
          .map((mesh) => (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
          // The icon is the textured quad at `icon_disabled_color`'s alpha.
          .filter((material) => material.map && Math.abs(material.opacity - 0.4) < 1e-6)
      );
    };
    expect(await iconOpacities('Color(1.5, 0.5, 0.25, 1)')).toHaveLength(1);
    expect(await iconOpacities('Color(0.8, 0.6, 0.4, 1)')).toHaveLength(0);
  });

  it('modulates the picker Buttons icons by icon_normal_color of the Theme chain', async () => {
    const half = { r: 1, g: 1, b: 1, a: 0.5 };
    const theme = themeResource({ colors: { Button: { icon_normal_color: half } } });
    const halfIcons = async (themeChain: ThemeResource[]) => {
      const renderer = await renderPicker({ ...ONLY_SWATCHES }, { w: 400, h: 100 }, themeChain);
      return renderer.scene
        .findAllByType('Mesh')
        .map((mesh) => (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
        .filter((material) => material.map && Math.abs(material.opacity - 0.5) < 1e-6);
    };
    expect(await halfIcons([theme])).toHaveLength(3);
    expect(await halfIcons([])).toHaveLength(0);
  });

  describe('the FlatMenuButton normal box of the Theme chain', () => {
    const box = {
      id: 'box',
      type: 'StyleBoxFlat',
      data: { bg_color: 'Color(1, 0, 0, 1)', content_margin_left: '6.0', content_margin_right: '6.0' },
    };
    const themed = themeResource({
      colors: {},
      styles: { FlatMenuButton: { normal: 'SubResource("box")' } },
      resources: { externalResources: [], internalResources: [box] },
    });
    /** A box mesh's first vertex colour, linear: the StyleBox's `bg_color` before the tint. */
    const isRedBox = (mesh: { instance: unknown }) => {
      const colors = (mesh.instance as THREE.Mesh).geometry.getAttribute('color');
      return colors !== undefined && colors.getX(0) === 1 && colors.getY(0) === 0 && colors.getZ(0) === 0;
    };
    const redBoxes = async (themeChain: ThemeResource[]) =>
      (await renderPicker({ ...ONLY_SWATCHES }, { w: 400, h: 100 }, themeChain)).scene
        .findAllByType('Mesh')
        .filter(isRedBox);

    it('draws one box only when the Theme chain gives one', async () => {
      expect(await redBoxes([])).toHaveLength(0);
      expect(await redBoxes([themed])).toHaveLength(1);
    });

    it('draws it behind the menu button on the trailing edge of the swatches row: color_picker.cpp:2255', async () => {
      const [redBox] = await redBoxes([themed]);
      const mesh = redBox!.instance as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      expect(new THREE.Box3().setFromObject(mesh).min.x).toBeGreaterThan(200);
    });
  });

  it('swatches row draws its two button labels: presets_visible default true', async () => {
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

describe('<ColorPicker> — self_modulate', () => {
  it('draws every part with childTint: the picker draws nothing of its own (color_picker.cpp:2072-2305)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ColorPicker
        {...painterEnv()}
        {...splitTints}
        theme={THEME}
        solveNode={node({ pickerShape: 5 })}
        rect={{ x: 0, y: 0, w: 300, h: 500 }}
        renderOrder={0}
      />
    );
    const split = countTintSplit(renderer.scene);
    expect(split.own).toBe(0);
    expect(split.child).toBeGreaterThan(10);
  });
});

describe('<ColorPicker> — value field arrows', () => {
  it('draws each down arrow in SpinBox down_icon_modulate, apart from the up arrow (spin_box.cpp:441-442)', async () => {
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const theme = themeResource({ colors: { SpinBox: { down_icon_modulate: red } } });
    const renderer = await renderPicker({ ...ONLY_SLIDERS, colorMode: 0 }, { w: 400, h: 400 }, [theme]);
    const redQuads = renderer.scene
      .findAllByType('Mesh')
      .map((mesh) => (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .filter((material) => material.color?.r === 1 && material.color.g === 0 && material.color.b === 0);
    // R, G, B, I and A: one down arrow each.
    expect(redQuads).toHaveLength(5);
  });
});

describe('<ColorPicker> — value field arrow alpha', () => {
  it('draws a disabled arrow at the alpha of its modulate (spin_box.cpp:449): the A row at 255 has its up arrow at 0.5', async () => {
    const renderer = await renderPicker({ ...ONLY_SLIDERS, colorMode: 0 });
    const halfOpaque = renderer.scene
      .findAllByType('Mesh')
      .map((mesh) => (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
      .filter((material) => material.opacity === 0.5);
    expect(halfOpaque).toHaveLength(1);
  });
});

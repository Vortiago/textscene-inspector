/**
 * `<ColorPicker>` — the native (WebGL canvas) painter for ColorPicker.
 * ColorPicker builds its whole widget as INTERNAL children in its C++
 * constructor (`scene/gui/color_picker.cpp:2069-2260`); none of that
 * structure is a `.tscn` property, so this ONE painter draws the composite
 * directly rather than a subtree the solve tree could walk.
 *
 * DRAWN, to the depth `nativeSolver.ts`'s `colorPickerRows` sizes:
 *  - The colour sample (`ColorPicker::_sample_draw`, `color_picker.cpp:1362-
 *    1415`, `display_old_color` branch — never true for a `.tscn` node, since
 *    it has no serialised property and only `ColorPickerButton`'s internal
 *    popup ever sets it): checkerboard (gated on `color.a < 1`, `:1400`),
 *    the flat colour rect at 95% height (`:1397`), and the overbright
 *    indicator (`:1411-1413`).
 *  - `picker_shape === SHAPE_HSV_RECTANGLE` (0, the default): the SV square
 *    (`ColorPickerShape::draw_sv_square`, `color_picker_shape.cpp:231-267`)
 *    as two alpha-blended vertex-coloured quads (`svGradient.ts`), its
 *    cursor (`draw_cursor`, `:269-274`), the hue slider's gradient strip
 *    (the `color_hue` `GradientTexture2D`'s own 7 stops, continuous GPU
 *    interpolation instead of an 800px sample) and its indicator line
 *    (`ColorPickerShapeRectangle::_hue_slider_draw`, `:425-434`).
 *
 * NOT DRAWN (`comparison.md`'s own "Known limitations" — this list is not
 * repeated there, only referenced):
 *  - Every OTHER `picker_shape` (wheel, VHS/OKHSL circle, both OK rectangles)
 *    is shader-backed in Godot (`ColorPickerShape::wheel_shader`/
 *    `circle_shader`/`circle_ok_color_shader`/`rectangle_ok_color_hs_shader`/
 *    `rectangle_ok_color_hl_shader`, `color_picker_shape.h:41-45`) — out of
 *    scope. `SHAPE_NONE` (4) draws nothing in Godot too, so it is not a gap.
 *  - The pick/shape buttons flanking the sample, the mode row, the slider
 *    grid, the hex field and the swatches row: none of their content nor
 *    their row height is modelled (`nativeSolver.ts`'s own doc).
 *  - Focus rings (`draw_focus_rect`/`draw_focus_circle`) — a static previewer
 *    has no focus.
 *
 * Tint: every draw call on a CanvasItem is subject to its own accumulated
 * modulate at the rendering-server level, so `tint.own` is folded into every
 * vertex/quad colour below, sRGB-space, before this painter's single decode
 * (the shader injection for the gradient meshes, `useGodotLinearColor` for
 * the flat `ControlQuad`s) — the same ordering `StyleBoxQuad.tsx` and
 * `ColorRect`'s own `Component.tsx` already establish.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { materialProgramInputs, type ProgramInjection } from '../../../../r3f/materialProgramInputs';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { parseColor } from '../../../../utils/colorParser';
import { AlphaCheckerboardQuad } from '../shared/AlphaCheckerboardQuad';
import {
  COLOR_PICKER_CURSOR_BG_ICON,
  COLOR_PICKER_CURSOR_ICON,
  COLOR_PICKER_CURSOR_SIZE,
  COLOR_PICKER_OVERBRIGHT_ICON,
  isColorOverbright,
} from '../shared/colorPickerIcons';
import {
  COLOR_PICKER_SAMPLE_HEIGHT_FRACTION,
  colorPickerRows,
  colorPickerScale,
  extractHsv,
  hsvToRgb,
  hueIndicatorY,
  invertRgb,
  svAndHueRects,
  svSquareCursorPosition,
} from './nativeSolver';
import { hueStripGeometry, svSquareBaseLayer, svSquareHueLayer, type QuadGeometry } from './svGradient';
import type { ColorPickerProperties } from './types';

function buildGeometry(g: QuadGeometry): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3));
  geometry.setIndex(g.indices);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.colors), 4));
  return geometry;
}

/**
 * `Color::srgb_to_linear` (`core/math/color.h:192-198`) as GLSL, applied to
 * the INTERPOLATED vertex colour rather than the attribute that feeds it —
 * `StyleBoxQuad.tsx`'s own `decodeVertexColorsFromSRGB` establishes why
 * (interpolating between two different sRGB colours in linear space moves
 * the ramp's midpoint), duplicated here rather than imported since that
 * function is private to a slice this packet does not own.
 */
function decodeVertexColorsFromSRGB(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    /* glsl */ `
    vec3 godotSrgbToLinear = mix(
      pow((vColor.rgb + 0.055) / 1.055, vec3(2.4)),
      vColor.rgb / 12.92,
      step(vColor.rgb, vec3(0.04045))
    );
    diffuseColor *= vec4(godotSrgbToLinear, vColor.a);
    `
  );
}

const SV_GRADIENT_INJECTION: ProgramInjection = {
  cacheKey: 'godot-colorpicker-srgb-vertex-colors',
  onBeforeCompile: decodeVertexColorsFromSRGB,
};

interface GradientMeshProps {
  geometry: THREE.BufferGeometry;
  renderOrder: number;
  clippingPlanes: THREE.Plane[];
}

/** One vertex-coloured, sRGB-decoded, single-pass quad — the SV square's two layers and the hue strip all share this recipe. */
function GradientMesh({ geometry, renderOrder, clippingPlanes }: GradientMeshProps) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  const program = materialProgramInputs({
    props: {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      clippingPlanes,
      injection: SV_GRADIENT_INJECTION,
    },
    merge: [canvasItemFacing()],
  });
  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

export function ColorPicker({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<ColorPickerProperties>(solveNode);
  const fill = useMemo(() => parseColor(props.color), [props.color]);
  const hsv = useMemo(() => extractHsv(fill), [fill]);
  const rows = useMemo(() => colorPickerRows(rect.w, theme, props.pickerShape), [rect.w, theme, props.pickerShape]);
  const clippingPlanes = useControlClipPlanes() as THREE.Plane[];
  const scale = colorPickerScale(theme);

  // --- Sample row -----------------------------------------------------------
  const sampleFill = useMemo(() => multiplyModulate(tint.own, fill), [tint.own, fill]);
  const sampleColor = useGodotLinearColor(sampleFill);
  const sampleRect = { w: rows.sample.w, h: rows.sample.h * COLOR_PICKER_SAMPLE_HEIGHT_FRACTION };
  const overbrightTexture = useIconTexture(COLOR_PICKER_OVERBRIGHT_ICON);
  const overbright = isColorOverbright(fill);

  // --- Shape row (SHAPE_HSV_RECTANGLE only) ----------------------------------
  const shapeRects = rows.shape ? svAndHueRects(rows.shape, theme) : null;

  const baseTint = tint.own;
  const svBaseGeometry = useMemo(() => {
    if (!shapeRects) return null;
    const g = svSquareBaseLayer(shapeRects.svSquare.w, shapeRects.svSquare.h);
    return buildGeometry({
      ...g,
      colors: tintVertexColors(g.colors, baseTint),
    });
  }, [shapeRects, baseTint]);

  const svHueGeometry = useMemo(() => {
    if (!shapeRects) return null;
    const g = svSquareHueLayer(shapeRects.svSquare.w, shapeRects.svSquare.h, hsv.h);
    return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
  }, [shapeRects, hsv.h, baseTint]);

  const hueStrip = useMemo(() => {
    if (!shapeRects) return null;
    const g = hueStripGeometry(shapeRects.hueSlider.w, shapeRects.hueSlider.h);
    return buildGeometry({ ...g, colors: tintVertexColors(g.colors, baseTint) });
  }, [shapeRects, baseTint]);

  const cursorBgTexture = useIconTexture(COLOR_PICKER_CURSOR_BG_ICON);
  const cursorTexture = useIconTexture(COLOR_PICKER_CURSOR_ICON);
  const cursorSize = Math.round(COLOR_PICKER_CURSOR_SIZE * scale);
  const cursorLocal = shapeRects
    ? svSquareCursorPosition({ x: 0, y: 0, w: shapeRects.svSquare.w, h: shapeRects.svSquare.h }, hsv.s, hsv.v)
    : null;
  // `draw_cursor`'s bg tint is the pick colour forced to alpha 1
  // (`color_picker_shape.cpp:272`), then the ambient CanvasItem modulate
  // every draw call carries.
  const cursorBgFill = useMemo(() => multiplyModulate(tint.own, { ...fill, a: 1 }), [tint.own, fill]);
  const cursorBgColor = useGodotLinearColor(cursorBgFill);

  const hueLineColor = useMemo(() => {
    const inverted = invertRgb(hsvToRgb(hsv.h, 1, 1));
    return multiplyModulate(tint.own, inverted);
  }, [hsv.h, tint.own]);
  const hueLineLinear = useGodotLinearColor(hueLineColor);
  const hueY = shapeRects ? hueIndicatorY(shapeRects.hueSlider.h, hsv.h) : 0;

  return (
    <>
      {/* Sample row */}
      <CanvasItemGroup position={[0, -rows.sample.y, 0]}>
        {sampleFill.a < 1 && (
          <AlphaCheckerboardQuad width={sampleRect.w} height={sampleRect.h} color={tint.color} opacity={tint.opacity} renderOrder={renderOrder} />
        )}
        <ControlQuad width={sampleRect.w} height={sampleRect.h} color={sampleColor} opacity={sampleFill.a} renderOrder={renderOrder} />
        {overbright && (
          <CanvasItemGroup position={[rows.sample.w * 0.5, 0, 0]}>
            <ControlQuad width={16} height={16} color={tint.color} opacity={tint.opacity} map={overbrightTexture} renderOrder={renderOrder} />
          </CanvasItemGroup>
        )}
      </CanvasItemGroup>

      {/* Shape row */}
      {shapeRects && svBaseGeometry && svHueGeometry && hueStrip && cursorLocal && (
        <>
          <CanvasItemGroup position={[shapeRects.svSquare.x, -shapeRects.svSquare.y, 0]}>
            <GradientMesh geometry={svBaseGeometry} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <GradientMesh geometry={svHueGeometry} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <CanvasItemGroup position={[cursorLocal.x - cursorSize / 2, -(cursorLocal.y - cursorSize / 2), 0]}>
              <ControlQuad width={cursorSize} height={cursorSize} color={cursorBgColor} opacity={cursorBgFill.a} map={cursorBgTexture} renderOrder={renderOrder} />
              <ControlQuad width={cursorSize} height={cursorSize} color={tint.color} opacity={tint.opacity} map={cursorTexture} renderOrder={renderOrder} />
            </CanvasItemGroup>
          </CanvasItemGroup>
          <CanvasItemGroup position={[shapeRects.hueSlider.x, -shapeRects.hueSlider.y, 0]}>
            <GradientMesh geometry={hueStrip} renderOrder={renderOrder} clippingPlanes={clippingPlanes} />
            <CanvasItemGroup position={[0, -hueY, 0]}>
              <ControlQuad width={shapeRects.hueSlider.w} height={1} color={hueLineLinear} opacity={hueLineColor.a} renderOrder={renderOrder} />
            </CanvasItemGroup>
          </CanvasItemGroup>
        </>
      )}
    </>
  );
}

function tintVertexColors(colors: number[], tint: { r: number; g: number; b: number; a: number }): number[] {
  const out = new Array<number>(colors.length);
  for (let i = 0; i < colors.length; i += 4) {
    out[i] = colors[i]! * tint.r;
    out[i + 1] = colors[i + 1]! * tint.g;
    out[i + 2] = colors[i + 2]! * tint.b;
    out[i + 3] = colors[i + 3]! * tint.a;
  }
  return out;
}

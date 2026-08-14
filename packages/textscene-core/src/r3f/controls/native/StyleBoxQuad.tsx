/**
 * `<StyleBoxQuad>` — draws a resolved `StyleBoxFlat` (`styleBoxFlatGeometry`'s
 * output) as canvas geometry: a hand-built `BufferGeometry` attached via
 * `<primitive>` (following `Polygon2D`'s `FilledPolygon`,
 * `nodes/2d/polygon2d/Component.tsx`), painted with the house recipe every
 * flat-shaded 2D item in this codebase uses — `meshBasicMaterial`,
 * `vertexColors`, `transparent`, `depthWrite={false}` and the shared
 * `canvasItemFacing()`.
 *
 * SINGLE PASS — this mesh is the reason `canvasItemFacing()` exists, and the
 * worst case that module describes. `StyleBoxFlat::draw` emits a PAINTER'S
 * ORDER triangle array — shadow, then border ring, then each antialiasing
 * feather — whose whole meaning is the order the rings blend in, and the ring
 * pattern it is ported from (`style_box_flat.cpp:403-408`, `(i, i+2, i+1)` over
 * alternating inner/outer vertices) gives the two triangles of every ring quad
 * OPPOSITE screen-space winding. Drawn back-faces-then-front-faces, each pass
 * keeps one triangle per quad and drops the other, so the border loses a wedge
 * per corner-detail step and the shadow ring's second-pass half lands ON TOP of
 * the border's first-pass half — a fan of shadow-coloured slivers along every
 * rounded corner, visible only once something dark sits behind the border. One
 * pass draws the array once, in index order, which is what the port means.
 *
 * Positions pass straight through from `styleBoxFlatGeometry` (Godot pixels,
 * +Y down, no axis flip — that is the caller's job, same as every other
 * `native/` module).
 *
 * COLOUR SPACE — the vertex attribute stays in sRGB and the shader decodes it
 * per fragment (`decodeVertexColorsFromSRGB`), rather than the attribute being
 * linearised on the way in. three applies no conversion of its own to a
 * `vertexColors` attribute (unlike a texture's `SRGBColorSpace` tag), so
 * either place works for a CONSTANT colour — the two are the same number.
 * They stop being the same the moment the rasterizer interpolates BETWEEN two
 * different colours, which is exactly what a `border_blend` ring is: Godot
 * ramps `border_color` to `border_color_blend` in sRGB, and linearising the
 * endpoints first makes the GPU ramp through linear instead. Measured against
 * Godot 4.6.3 on a 16 px blended border, that put the ramp's midpoint 38
 * counts high on the red channel while both endpoints stayed exact — the
 * signature of a curve applied on the wrong side of an interpolation.
 *
 * Subdividing the ring so the linear interpolation tracks the sRGB one was the
 * alternative, and it is not close: the error only falls as the square of the
 * step count, so even 16 radial bands leave 1.3 counts, against 32x the
 * vertices. Decoding per fragment is exact at any ring width.
 *
 * The optional `color` prop is a CanvasItem tint (`useCanvasItemTint`'s
 * `own`, RAW sRGB, alpha included) composed into `styleBox`'s two base
 * colours INTERNALLY, via `tintStyleBox`, while both are still sRGB.
 * Unlike `ControlQuad`'s `color`/`opacity` pair (already-linear `THREE.Color`
 * + a separate alpha scalar, because a plain quad has ONE colour to hand the
 * material directly), a StyleBox has TWO base colours and the shader's own
 * decode downstream — multiplying a linear tint in here
 * would double-convert, and splitting alpha into its own prop would just be
 * `color.a` twice over. One RGBA prop, multiplied pre-conversion, is the
 * correct shape for this component; passing `tint.own` from
 * `useCanvasItemTint` is the caller's whole job. Every StyleBox painter that
 * used to call `tintStyleBox` itself and hand the RESULT here can now hand
 * `color={tint.own}` and its ORIGINAL untinted `StyleBoxFlatData` instead.
 *
 * R3F does not auto-dispose a geometry passed via `attach="geometry"`
 * (`Polygon2D`'s own comment) — released on rebuild/unmount here too.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { styleBoxFlatGeometry } from './styleBoxFlatGeometry';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { Rect2 } from './rect';
import { useControlClipPlanes } from './controlClipping';
import { multiplyModulate, WHITE_MODULATE, type RGBA } from '../../canvasItemModulate';
import { canvasItemFacing } from '../../canvasItemFacing';

export interface StyleBoxQuadProps {
  styleBox: StyleBoxFlatData;
  rect: Rect2;
  /**
   * A CanvasItem tint (raw sRGB, alpha included — pass `useCanvasItemTint`'s
   * `own`, never its already-linear `color`) multiplied into `styleBox`'s
   * `bgColor`/`borderColor` BEFORE this component's single sRGB→linear
   * conversion. Defaults to opaque white (no tint), the `WHITE_MODULATE`
   * no-op `tintStyleBox` already fast-paths.
   */
  color?: RGBA;
  /**
   * Paint order within the 2D transparent bucket. Load-bearing rather than
   * cosmetic: nothing here writes depth, so three's transparent sort — which
   * reads `renderOrder` before camera distance — is the *only* thing deciding
   * which Control covers which. A quad that drops it paints in traversal order
   * and silently ignores both `z_index` and `CanvasLayer.layer`.
   */
  renderOrder: number;
}

export function StyleBoxQuad({ styleBox, rect, color, renderOrder }: StyleBoxQuadProps) {
  // Godot space → three space, once, here.
  //
  // `styleBoxFlatGeometry` is a faithful transcription of `StyleBoxFlat::draw`,
  // so it emits ABSOLUTE Godot coordinates: `rect.x`/`rect.y` are added onto
  // every vertex and +Y points down. But the walker has already translated this
  // painter's group to `[rect.x, -rect.y, 0]`, so passing the rect through
  // unchanged offsets the box a second time and mirrors it vertically.
  //
  // Only the size reaches the geometry, and the y flip is applied by a wrapping
  // group. Every Panel until now happened to be drawn at rect (0,0), where both
  // errors vanish — which is also why no test caught it.
  const size = useMemo(() => ({ x: 0, y: 0, w: rect.w, h: rect.h }), [rect.w, rect.h]);
  const tintedStyleBox = useMemo(() => tintStyleBox(styleBox, color ?? WHITE_MODULATE), [styleBox, color]);
  const geometry = useMemo(() => buildGeometry(tintedStyleBox, size), [tintedStyleBox, size]);
  // R3F won't auto-dispose a geometry passed via `attach`; release on rebuild.
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const clippingPlanes = useControlClipPlanes();

  if (!geometry) return null;

  return (
    // The flip group carries `renderOrder` as well as the mesh: three reads a
    // drawn object's place in the canvas from its NEAREST enclosing group
    // (`canvasPaintOrder.ts`), so a bare group here would reset every StyleBox
    // in the previewer to the front of the canvas.
    <group scale={[1, -1, 1]} renderOrder={renderOrder}>
      <mesh renderOrder={renderOrder}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          {...canvasItemFacing()}
          clippingPlanes={clippingPlanes as THREE.Plane[]}
          onBeforeCompile={decodeVertexColorsFromSRGB}
          customProgramCacheKey={STYLEBOX_PROGRAM_CACHE_KEY}
        />
      </mesh>
    </group>
  );
}

function buildGeometry(styleBox: StyleBoxFlatData, rect: Rect2): THREE.BufferGeometry | null {
  const { positions, indices, colors } = styleBoxFlatGeometry(styleBox, rect);
  if (positions.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
  return geometry;
}

/**
 * Distinguishes this patched program from a stock `MeshBasicMaterial`'s.
 * `WebGLPrograms` keys its cache on the material's own parameters, which an
 * `onBeforeCompile` injection is not part of — without a key of its own, a
 * StyleBox mesh and any other vertex-coloured basic material in the same
 * scene can be handed each other's compiled program.
 */
const STYLEBOX_PROGRAM_CACHE_KEY = () => 'godot-stylebox-srgb-vertex-colors';

/**
 * `Color::srgb_to_linear` (`utils/colorSpace.ts`'s `sRGBChannelToLinear`) as
 * GLSL, applied to the interpolated vertex colour instead of to the attribute
 * that feeds it.
 *
 * Injected into `<color_fragment>`, which is where the stock chunk does
 * `diffuseColor *= vColor` — so the decode lands after interpolation and
 * before every downstream stage (the tone curve and the output encode both
 * still run from the material's own template, unchanged).
 *
 * Only `.rgb` is decoded. Alpha carries no transfer function, and the AA
 * feather rings are ramps in exactly that channel — running them through the
 * curve would bend every anti-aliased edge in the previewer.
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

/**
 * Multiplies a composed tint into a StyleBox's TWO base colours, in raw sRGB.
 *
 * `<StyleBoxQuad>`'s own `color` prop is this function applied internally —
 * still exported (and independently tested) because `styleBoxFlat.ts` sits
 * inside the solver's framework-free closure and cannot import the modulate
 * helpers, so a painter that needs a tinted StyleBox for something OTHER than
 * feeding `<StyleBoxQuad>` (there is none today, but the seam is cheap to
 * keep) still has it available directly. `styleBoxFlatGeometry` performs the
 * single sRGB→linear conversion downstream of both call sites, so multiplying
 * after that point would double-convert — invisible at tint 1, wrong
 * everywhere else.
 */
export function tintStyleBox(styleBox: StyleBoxFlatData, tint: RGBA): StyleBoxFlatData {
  if (tint.r === 1 && tint.g === 1 && tint.b === 1 && tint.a === 1) return styleBox;
  return {
    ...styleBox,
    bgColor: multiplyModulate(styleBox.bgColor, tint),
    borderColor: multiplyModulate(styleBox.borderColor, tint),
  };
}

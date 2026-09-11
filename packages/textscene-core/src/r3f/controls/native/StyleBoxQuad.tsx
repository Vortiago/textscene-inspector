/**
 * `<StyleBoxQuad>` — draws a resolved StyleBox (`native/parseStyleBox.ts`'s
 * `ResolvedStyleBox`, any of the four concrete kinds) as canvas geometry.
 *
 * `StyleBoxFlat`/`StyleBoxEmpty` (the bare, untagged `ResolvedStyleBox`
 * member) and `StyleBoxLine` both draw through `styleBoxFlatGeometry`'s
 * vertex-coloured pipeline: a line override is a degenerate flat fill —
 * single colour, no border/corner/shadow — at its OWN draw rect
 * (`StyleBoxLine::draw`'s grow/thicken, `styleBoxLineDrawRect`, applied here
 * regardless of caller). `StyleBoxTexture` is a genuinely different draw (a
 * textured nine-patch mesh, `StyleBoxTextureMesh` below) and never touches
 * this module's vertex-colour machinery.
 *
 * A hand-built `BufferGeometry` attached via `<primitive>` (following
 * `Polygon2D`'s `FilledPolygon`, `nodes/2d/polygon2d/Component.tsx`), painted
 * with the house recipe every flat-shaded 2D item in this codebase uses —
 * `meshBasicMaterial`, `vertexColors`, `transparent`, `depthWrite={false}`
 * and the shared `canvasItemFacing()`.
 *
 * SINGLE PASS (flat/line branch) — this mesh is the reason
 * `canvasItemFacing()` exists, and the worst case that module describes.
 * `StyleBoxFlat::draw` emits a PAINTER'S ORDER triangle array — shadow, then
 * border ring, then each antialiasing feather — whose whole meaning is the
 * order the rings blend in, and the ring pattern it is ported from
 * (`style_box_flat.cpp:403-408`, `(i, i+2, i+1)` over alternating
 * inner/outer vertices) gives the two triangles of every ring quad OPPOSITE
 * screen-space winding. Drawn back-faces-then-front-faces, each pass keeps
 * one triangle per quad and drops the other, so the border loses a wedge per
 * corner-detail step and the shadow ring's second-pass half lands ON TOP of
 * the border's first-pass half — a fan of shadow-coloured slivers along
 * every rounded corner, visible only once something dark sits behind the
 * border. One pass draws the array once, in index order, which is what the
 * port means.
 *
 * Positions pass straight through from `styleBoxFlatGeometry` (Godot pixels,
 * +Y down, no axis flip — that is the caller's job, same as every other
 * `native/` module).
 *
 * COLOUR SPACE (flat/line branch) — the vertex attribute stays in sRGB and
 * the shader decodes it per fragment (`decodeVertexColorsFromSRGB`), rather
 * than the attribute being linearised on the way in. three applies no
 * conversion of its own to a `vertexColors` attribute (unlike a texture's
 * `SRGBColorSpace` tag), so either place works for a CONSTANT colour — the
 * two are the same number. They stop being the same the moment the
 * rasterizer interpolates BETWEEN two different colours, which is exactly
 * what a `border_blend` ring is: Godot ramps `border_color` to
 * `border_color_blend` in sRGB, and linearising the endpoints first makes
 * the GPU ramp through linear instead. Measured against Godot 4.6.3 on a
 * 16 px blended border, that put the ramp's midpoint 38 counts high on the
 * red channel while both endpoints stayed exact — the signature of a curve
 * applied on the wrong side of an interpolation.
 *
 * Subdividing the ring so the linear interpolation tracks the sRGB one was
 * the alternative, and it is not close: the error only falls as the square
 * of the step count, so even 16 radial bands leave 1.3 counts, against 32x
 * the vertices. Decoding per fragment is exact at any ring width.
 *
 * The optional `color` prop is a CanvasItem tint (`useCanvasItemTint`'s
 * `own`, RAW sRGB, alpha included). For a flat/line box it is composed into
 * `styleBox`'s base colour(s) INTERNALLY, via `tintStyleBox`, while both are
 * still sRGB — unlike `ControlQuad`'s `color`/`opacity` pair (already-linear
 * `THREE.Color` + a separate alpha scalar, because a plain quad has ONE
 * colour to hand the material directly), a flat StyleBox has TWO base
 * colours and the shader's own decode downstream, so multiplying a linear
 * tint in here would double-convert. For a texture box it is instead
 * multiplied with `modulate_color` and handed to the material's `color`/
 * `opacity` directly (`StyleBoxTextureMesh`'s own doc) — a texture has no
 * vertex-colour pipeline to fold it into.
 *
 * R3F does not auto-dispose a geometry passed via `attach="geometry"`
 * (`Polygon2D`'s own comment) — released on rebuild/unmount here too.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { styleBoxFlatGeometry } from './styleBoxFlatGeometry';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { ResolvedStyleBox, StyleBoxLineBox, StyleBoxTextureBox } from './parseStyleBox';
import type { StyleBoxLineData } from './styleBoxLine';
import type { StyleBoxTextureData } from './styleBoxTexture';
import { styleBoxLineDrawRect } from './styleBoxLineGeometry';
import { ninePatchGeometry } from './ninePatchGeometry';
import type { Rect2 } from './rect';
import { useControlClipPlanes } from './controlClipping';
import { multiplyModulate, WHITE_MODULATE, type RGBA } from '../../canvasItemModulate';
import { canvasItemFacing } from '../../canvasItemFacing';
import { materialProgramInputs, type ProgramInjection } from '../../materialProgramInputs';
import { pinNoColorSpace, useCanvasDecodeDefines } from '../../canvas2DTextureDecode';
import { useGodotLinearColor } from '../../godotColor';
import { useTexture2D } from '../../../resources/useTexture2D';

export interface StyleBoxQuadProps {
  styleBox: ResolvedStyleBox;
  rect: Rect2;
  /**
   * A CanvasItem tint (raw sRGB, alpha included — pass `useCanvasItemTint`'s
   * `own`, never its already-linear `color`), composed into the box's own
   * colour(s) BEFORE this component's single sRGB→linear conversion.
   * Defaults to opaque white (no tint), the `WHITE_MODULATE` no-op
   * `tintStyleBox` already fast-paths.
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

function styleBoxKindOf(box: ResolvedStyleBox): 'flat' | 'line' | 'texture' {
  return 'styleBoxKind' in box ? box.styleBoxKind : 'flat';
}

/**
 * A `StyleBoxLine` as a degenerate `StyleBoxFlatData`: single solid fill
 * (`drawCenter: true`, zero border/corner/shadow), coloured by the line's
 * own `color`. `styleBoxFlatGeometry` against this emits exactly a
 * two-triangle coloured rect — the whole of what `StyleBoxLine::draw`'s
 * `canvas_item_add_rect` call paints.
 */
function lineAsFlatStyleBox(line: StyleBoxLineData): StyleBoxFlatData {
  return {
    bgColor: line.color,
    borderColor: line.color,
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    drawCenter: true,
    borderBlend: false,
    antiAliased: false,
    aaSize: 1,
    cornerDetail: 1,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
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
  const kind = styleBoxKindOf(styleBox);
  const clippingPlanes = useControlClipPlanes();

  const { flatBox, flatRect } = useMemo(() => {
    if (kind === 'line') {
      const line = (styleBox as StyleBoxLineBox).line;
      return { flatBox: lineAsFlatStyleBox(line), flatRect: styleBoxLineDrawRect(size, line) };
    }
    return { flatBox: styleBox, flatRect: size };
  }, [styleBox, size, kind]);
  const tintedStyleBox = useMemo(() => tintStyleBox(flatBox, color ?? WHITE_MODULATE), [flatBox, color]);
  // Skipped (not built) for a texture box — it draws through
  // `StyleBoxTextureMesh` below instead — but the hook itself always runs, so
  // this component's own hook order never depends on `kind`.
  const flatGeometry = useMemo(
    () => (kind === 'texture' ? null : buildGeometry(tintedStyleBox, flatRect)),
    [tintedStyleBox, flatRect, kind]
  );
  useEffect(() => () => flatGeometry?.dispose(), [flatGeometry]);

  if (kind === 'texture') {
    const texture = (styleBox as StyleBoxTextureBox).texture;
    return (
      <StyleBoxTextureMesh
        texture={texture}
        rect={size}
        tint={color ?? WHITE_MODULATE}
        renderOrder={renderOrder}
        clippingPlanes={clippingPlanes as THREE.Plane[]}
      />
    );
  }

  if (!flatGeometry) return null;

  const program = materialProgramInputs({
    props: {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      clippingPlanes: clippingPlanes as THREE.Plane[],
      injection: STYLEBOX_SRGB_VERTEX_COLORS,
    },
    merge: [canvasItemFacing()],
  });

  return (
    // The flip group carries `renderOrder` as well as the mesh: three reads a
    // drawn object's place in the canvas from its NEAREST enclosing group
    // (`canvasPaintOrder.ts`), so a bare group here would reset every StyleBox
    // in the previewer to the front of the canvas.
    <group scale={[1, -1, 1]} renderOrder={renderOrder}>
      <mesh renderOrder={renderOrder}>
        <primitive object={flatGeometry} attach="geometry" />
        <meshBasicMaterial key={program.key} {...program.props} />
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
 * The sRGB decode below and the cache-key contribution that distinguishes the
 * program it produces from a stock `MeshBasicMaterial`'s — paired, so the patch
 * cannot be applied without it (`materialProgramInputs.ts`). Without a
 * contribution of its own, a StyleBox mesh and any other vertex-coloured basic
 * material in the same scene are handed each other's compiled program.
 */
const STYLEBOX_SRGB_VERTEX_COLORS: ProgramInjection = {
  cacheKey: 'godot-stylebox-srgb-vertex-colors',
  onBeforeCompile: decodeVertexColorsFromSRGB,
};

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
 * Multiplies a composed tint into a flat/line StyleBox's base colour(s), in
 * raw sRGB. A `StyleBoxLineBox`/`StyleBoxTextureBox`'s wrapped
 * `StyleBoxFlatData` core is what a caller who bypasses this component
 * entirely (drawing a `solveNode.styleBoxes` entry directly) sees — see
 * `native/parseStyleBox.ts`'s module doc — so this only ever runs on the
 * wrapper's neutral core or a genuine flat box, never `bgColor`/`borderColor`
 * fields a texture box's own draw would read (it has none).
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

interface StyleBoxTextureMeshProps {
  texture: StyleBoxTextureData;
  /** Zero-origin, size-only — the same contract `StyleBoxQuad`'s own `rect` prop keeps. */
  rect: Rect2;
  /** Raw sRGB CanvasItem tint; multiplied with `texture.modulateColor` below. */
  tint: RGBA;
  renderOrder: number;
  clippingPlanes: THREE.Plane[];
}

interface ImageLike {
  width?: number;
  height?: number;
}

/**
 * `StyleBoxTexture::draw` (`style_box_texture.cpp:165-184`) as a textured
 * nine-patch mesh — the identical `canvas_item_add_nine_patch` shape
 * `NinePatchRect` draws (`native/ninePatchGeometry.ts`'s own doc), so this
 * mirrors `nodes/2d/ui/ninepatchrect/Component.tsx`'s resolution rather than
 * re-deriving it.
 *
 * `texture.resources` (embedded on `StyleBoxTextureData` at parse time,
 * `native/styleBoxTexture.ts`) is the node's OWN scope — never
 * `useSceneResources()` — so this needs no scope prop threaded in from
 * whichever painter reached this box.
 *
 * The final `canvas_item_add_nine_patch` argument is `modulate`
 * (`style_box_texture.cpp:183`): the STYLEBOX's own `modulate_color`, which
 * the render server multiplies against the OWNING CanvasItem's already-
 * accumulated modulate/self_modulate (`tint`) — the same total tint pattern
 * `<StyleBoxQuad>`'s flat/line branch applies to `bgColor`/`borderColor`.
 */
function StyleBoxTextureMesh({ texture, rect, tint, renderOrder, clippingPlanes }: StyleBoxTextureMeshProps) {
  const { texture: rawTexture } = useTexture2D(
    texture.texture,
    texture.resources.externalResources,
    texture.resources.internalResources
  );

  const geometry = useMemo(() => {
    const image = rawTexture?.image as ImageLike | undefined;
    const textureSize = { x: image?.width ?? 0, y: image?.height ?? 0 };
    if (!rawTexture || textureSize.x <= 0 || textureSize.y <= 0) return null;

    // style_box_texture.cpp:170-174: the draw rect grows by expand_margin
    // AFTER the region lookup, position shifted negative on the near side.
    const drawRect = {
      x: rect.x - texture.expandMargin.left,
      y: rect.y - texture.expandMargin.top,
      w: rect.w + texture.expandMargin.left + texture.expandMargin.right,
      h: rect.h + texture.expandMargin.top + texture.expandMargin.bottom,
    };

    const region = texture.regionRect;
    // `region_rect != Rect2()` — an ALL-zero region (including the parsed
    // default) means "the whole texture", the same renderer-level convention
    // `ninepatchrect/Component.tsx` already applies for the identical call.
    const regionSet =
      region !== undefined && (region.x !== 0 || region.y !== 0 || region.width !== 0 || region.height !== 0);
    const regionOffset = regionSet ? { x: region!.x, y: region!.y } : { x: 0, y: 0 };
    const regionSize = regionSet ? { x: region!.width, y: region!.height } : textureSize;

    const buffers = ninePatchGeometry({
      rectSize: { x: drawRect.w, y: drawRect.h },
      textureSize,
      regionOffset,
      regionSize,
      margin: texture.margin,
      axisH: texture.axisStretchHorizontal,
      axisV: texture.axisStretchVertical,
      drawCenter: texture.drawCenter,
    });
    if (buffers.positions.length === 0) return null;

    // `ninePatchGeometry` emits dest-rect-local positions; offset by the
    // grown rect's own top-left so an `expand_margin` actually shows up.
    const positions = buffers.positions;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i]! += drawRect.x;
      positions[i + 1]! += drawRect.y;
    }

    const built = new THREE.BufferGeometry();
    built.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    built.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buffers.uvs), 2));
    built.setIndex(buffers.indices);
    return built;
  }, [rawTexture, rect, texture]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // Clone: the resolved texture is a SHARED cache entry, mutated per-consumer
  // below (colour space, filter) — the same reason `ninepatchrect/Component.tsx`
  // clones. Filter is pinned LINEAR/clamp-to-edge rather than threaded through
  // an inherited `texture_filter`: unlike `NinePatchRect`, a StyleBoxTexture
  // override can land on ANY Control type, none of which hand this quad their
  // own sampler — `Viewport::default_canvas_item_texture_filter`'s own class
  // default, so the common case (no authored filter anywhere) is unaffected.
  const preparedTexture = useMemo(() => {
    if (!rawTexture || !geometry) return null;
    const cloned = rawTexture.clone();
    pinNoColorSpace(cloned);
    cloned.magFilter = THREE.LinearFilter;
    cloned.minFilter = THREE.LinearFilter;
    cloned.wrapS = cloned.wrapT = THREE.ClampToEdgeWrapping;
    cloned.needsUpdate = true;
    return cloned;
  }, [rawTexture, geometry]);
  useEffect(() => () => preparedTexture?.dispose(), [preparedTexture]);

  const combinedTint = useMemo(() => multiplyModulate(tint, texture.modulateColor), [tint, texture.modulateColor]);
  const linearColor = useGodotLinearColor(combinedTint);
  const decodeDefines = useCanvasDecodeDefines(preparedTexture);

  if (!geometry || !preparedTexture) return null;

  const program = materialProgramInputs({
    props: {
      map: preparedTexture,
      color: linearColor,
      opacity: combinedTint.a,
      transparent: true,
      depthWrite: false,
      defines: decodeDefines,
      clippingPlanes,
    },
    merge: [canvasItemFacing()],
  });

  return (
    <group scale={[1, -1, 1]} renderOrder={renderOrder}>
      <mesh renderOrder={renderOrder}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    </group>
  );
}

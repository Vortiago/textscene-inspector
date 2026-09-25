/**
 * Draws a resolved StyleBox (`ResolvedStyleBox`, `native/parseStyleBox.ts`) as
 * canvas geometry. Flat, empty and line boxes share the vertex-coloured
 * `styleBoxFlatGeometry` path: a line is a one-colour flat fill at its own draw
 * rect (`styleBoxLineDrawRect`). A texture box is a nine-patch mesh.
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
   * A CanvasItem tint in raw sRGB with alpha: `useCanvasItemTint`'s `own`, never its
   * linear `color`. A flat box has two base colours and a decode downstream, so the
   * tint multiplies in before it. Defaults to `WHITE_MODULATE`, no tint.
   */
  color?: RGBA;
  /**
   * Paint order in the 2D transparent bucket. Nothing writes depth, so three's sort,
   * which reads `renderOrder` before distance, alone decides which Control covers
   * which. Without it, `z_index` and `CanvasLayer.layer` are ignored.
   */
  renderOrder: number;
}

function styleBoxKindOf(box: ResolvedStyleBox): 'flat' | 'line' | 'texture' {
  return 'styleBoxKind' in box ? box.styleBoxKind : 'flat';
}

/**
 * A `StyleBoxLine` as a one-colour flat fill with no border, corner or shadow:
 * the two-triangle rect `StyleBoxLine::draw`'s `canvas_item_add_rect` paints.
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
  // `styleBoxFlatGeometry` emits absolute Godot coordinates, +Y down, and the
  // walker has already placed this group at `[rect.x, -rect.y, 0]`. So only the
  // size reaches the geometry, and a wrapping group flips Y.
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
  // Not built for a texture box, but the hook always runs, so the hook order
  // never depends on `kind`.
  const flatGeometry = useMemo(
    () => (kind === 'texture' ? null : buildGeometry(tintedStyleBox, flatRect)),
    [tintedStyleBox, flatRect, kind]
  );
  // R3F does not dispose a geometry passed through `attach="geometry"`.
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
    // Single pass: `StyleBoxFlat::draw` emits rings in painter's order, and its
    // `(i, i+2, i+1)` pattern (`style_box_flat.cpp:403-408`) gives each ring quad's
    // two triangles opposite winding. Two passes would drop a wedge per corner
    // step and draw shadow slivers over the border.
    merge: [canvasItemFacing()],
  });

  return (
    // The flip group carries `renderOrder` too: three takes an object's place from
    // its nearest enclosing group (`canvasPaintOrder.ts`), so a bare group would
    // reset every StyleBox to the front of the canvas.
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
 * The sRGB decode paired with its own cache key (`materialProgramInputs.ts`).
 * Without the key, a StyleBox mesh and any other vertex-coloured basic material
 * share one compiled program.
 */
const STYLEBOX_SRGB_VERTEX_COLORS: ProgramInjection = {
  cacheKey: 'godot-stylebox-srgb-vertex-colors',
  onBeforeCompile: decodeVertexColorsFromSRGB,
};

/**
 * `Color::srgb_to_linear` in GLSL on the interpolated colour, in `<color_fragment>`.
 * Godot ramps a `border_blend` in sRGB, and linear endpoints put the midpoint 38
 * counts high in Godot 4.6.3. Alpha stays: the AA feathers are alpha ramps, and
 * the curve would bend every edge.
 */
function decodeVertexColorsFromSRGB(shader: { fragmentShader: string }): void {
  // Exact at any ring width. Subdividing rings instead leaves 1.3 counts at 16
  // bands, for 32x the vertices.
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
 * Multiplies a tint into a flat or line StyleBox's base colours in raw sRGB, ahead
 * of the one sRGB→linear conversion in `styleBoxFlatGeometry`. Exported for a
 * painter that tints a StyleBox outside `<StyleBoxQuad>`: `styleBoxFlat.ts` cannot
 * import the modulate helpers to offer one.
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
  /** Zero-origin, size only. */
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
 * `StyleBoxTexture::draw` (`style_box_texture.cpp:165-184`): the
 * `canvas_item_add_nine_patch` that `NinePatchRect` draws, resolved as
 * `ninepatchrect/Component.tsx` does. `texture.resources` is the node's own
 * scope, embedded at parse time, so no scope prop is needed.
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
    // `region_rect != Rect2()`: an all-zero region, the parsed default included,
    // means the whole texture.
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

  // A clone: the cached texture is shared, and this mutates colour space and
  // filter. Linear and clamp-to-edge, the `Viewport::default_canvas_item_texture_filter`
  // class default: a StyleBoxTexture can land on any Control, and none hands
  // this quad its own sampler.
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

  // The last `canvas_item_add_nine_patch` argument, `modulate_color`
  // (`style_box_texture.cpp:183`), times the owner's accumulated modulate.
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

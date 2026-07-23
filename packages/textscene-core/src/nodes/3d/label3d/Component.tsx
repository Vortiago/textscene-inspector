/**
 * <Label3D> — 2D text rendered onto a textured plane in 3D space.
 *
 * Matches the imperative renderer: rasterise text to a canvas, build a
 * CanvasTexture, apply to a transparent PlaneGeometry sized by pixel_size.
 *
 * The canvas/texture is built once via useMemo and disposed on unmount.
 * If document is unavailable (no DOM), the component renders an invisible
 * marker group so the scene continues to function.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from './types';
import { HorizontalAlignment } from './types';
import type { Color } from '../../../utils/colorParser';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { useBillboard } from '../../../r3f/hooks/useBillboard';

/**
 * Canvas rasterisation resolution, independent of Godot's `font_size`: the
 * quad's WORLD size follows `font_size`, while the texture is always drawn at
 * this size so a small label stays crisp when the camera moves in.
 */
const RENDER_FONT_SIZE = 128;

/** Padding baked into the canvas around the text, in render pixels. */
const CANVAS_PADDING = 10;

/**
 * Godot renders a Label3D outline far thinner than a centred canvas `strokeText`
 * of the same `outline_size`: three-outward vs Godot's font-outline rasteriser.
 * Measured against a real Godot render of `unit-label3d.tscn`, a raw stroke came
 * out ~3x too heavy (Godot's black outline runs ~2 px where ours ran ~6–7 px),
 * so the stroke width is scaled to match Godot's outline weight.
 */
const OUTLINE_WIDTH_SCALE = 0.33;

export function Label3D({ node, children }: NodeComponentProps) {
  const { showLabels } = useViewportMode();
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const noDepthTest = properties.no_depth_test;

  const built = useMemo(
    () => buildLabelTexture(properties, RENDER_FONT_SIZE, properties.font_size),
    [properties]
  );

  // Dispose of the GPU texture and source canvas when the label unmounts
  // or its inputs change.
  useEffect(() => {
    return () => {
      built?.texture.dispose();
    };
  }, [built]);

  const meshRef = useRef<THREE.Mesh | null>(null);

  // The pre-migration imperative renderer turned each Label3D per frame via
  // `TscnRenderer.updateLabels()`; `useBillboard` is that behaviour, shared
  // with Sprite3D so both slices implement Godot's modes identically.
  useBillboard(meshRef, properties.billboard);

  // Godot modulate is sRGB → convert to linear before the unlit material tint
  // (the white canvas text is colorized by this), matching Sprite2D/Sprite3D.
  const tint = useGodotLinearColor(properties.modulate);

  // The texture is uploaded premultiplied (below), so the fragment RGB is ALREADY
  // premultiplied by coverage — the material must therefore NOT premultiply again
  // (`premultipliedAlpha` would `rgb *= a` in the shader, giving color·a² and
  // eroding every anti-aliased glyph/outline edge). Use an explicit premultiplied
  // OVER blend (src = 1, dst = 1−srcα) instead, and fold modulate's alpha into the
  // tint so a translucent label scales its premultiplied RGB by opacity too (with
  // premultiplied blending, `opacity` alone would scale only the alpha channel).
  const tintWithOpacity = useMemo(
    () => tint.clone().multiplyScalar(properties.modulate.a),
    [tint, properties.modulate.a]
  );

  // On by default to match Godot (ADR-0008 point 4 superseded — see its
  // amendment note); the Labels toggle can hide it. When off (or the canvas
  // couldn't be built), render an invisible marker group so the node still
  // positions any children and stays selectable.
  if (!showLabels || !built) {
    return (
      <group name={node.name} position={position} rotation={rotation} scale={scale}>
        {children}
      </group>
    );
  }

  return (
    <>
      <mesh
        ref={meshRef}
        name={node.name}
        position={position}
        rotation={rotation}
        scale={scale}
        userData={{ billboardMode: properties.billboard, isLabel3D: true }}
      >
        <planeGeometry args={[built.width, built.height]} />
        <meshBasicMaterial
          map={built.texture}
          color={tintWithOpacity}
          transparent
          blending={THREE.CustomBlending}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
          blendSrcAlpha={THREE.OneFactor}
          blendDstAlpha={THREE.OneMinusSrcAlphaFactor}
          opacity={properties.modulate.a}
          side={properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide}
          depthWrite={false}
          depthTest={!noDepthTest}
        />
      </mesh>
      {/* Descendants sit in a SIBLING group carrying the same transform, not
          inside the label mesh: `billboard` rewrites the mesh's quaternion
          every frame, and in Godot that is a shader-side effect on the label
          itself — it never spins the node's children. */}
      {children === undefined ? null : (
        <group position={position} rotation={rotation} scale={scale}>
          {children}
        </group>
      )}
    </>
  );
}

interface BuiltLabel {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
}

function buildLabelTexture(
  properties: Label3DProperties,
  fontSize: number,
  godotFontSize: number
): BuiltLabel | null {
  if (typeof document === 'undefined') return null;
  try {
    // Godot breaks the paragraph on `\n` and stacks the lines; a trailing
    // newline therefore yields an empty final line that still takes height.
    // Canvas2D `fillText` ignores `\n` entirely, so the split has to happen
    // here or every multi-line label collapses onto one baseline.
    const lines = (properties.text || '').split('\n');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Godot-pixel quantities (font_size, line_spacing, outline_size) scale to
    // the canvas resolution by this factor.
    const renderScale = fontSize / godotFontSize;
    const lineHeight = fontSize + properties.line_spacing * renderScale;

    context.font = `${fontSize}px Arial`;
    const lineWidths = lines.map((line) => context.measureText(line).width);
    const textWidth = Math.max(0, ...lineWidths);
    canvas.width = Math.max(1, Math.ceil(textWidth) + CANVAS_PADDING * 2);
    canvas.height = Math.max(1, Math.ceil(lineHeight * lines.length) + CANVAS_PADDING * 2);

    // Setting width/height resets every context attribute, so re-apply the
    // font after sizing the canvas.
    context.font = `${fontSize}px Arial`;

    // outline_size is in Godot font-pixels; scale to the canvas resolution, then
    // by OUTLINE_WIDTH_SCALE to match Godot's thinner font-outline rasteriser.
    const strokeWidth =
      properties.outline_size > 0
        ? properties.outline_size * renderScale * OUTLINE_WIDTH_SCALE
        : 0;
    if (strokeWidth > 0) {
      context.strokeStyle = colorToCss(properties.outline_modulate);
      context.lineWidth = strokeWidth;
      // Round the outline joins so the stroke hugs the glyph instead of spiking
      // into boxy miter corners — Godot's outline is a smooth dilation.
      context.lineJoin = 'round';
      context.miterLimit = 2;
    }

    // Rasterise the text in white. The material's `color` carries the
    // modulate tint, so the texture stays font-size-agnostic and can be
    // re-tinted without rebuilding the canvas.
    context.fillStyle = '#ffffff';

    lines.forEach((line, i) => {
      const x = lineOriginX(properties.horizontal_alignment, textWidth, lineWidths[i] ?? 0);
      const baseline = CANVAS_PADDING + lineHeight * i + fontSize;
      if (strokeWidth > 0) context.strokeText(line, x, baseline);
      context.fillText(line, x, baseline);
    });

    const texture = new THREE.CanvasTexture(canvas);
    // Premultiply alpha on upload so the transparent canvas edges (a white glyph
    // fading to 0-alpha black) don't bilinear-interpolate their RGB toward black
    // and leave a dark fringe hugging every glyph. Paired with the material's
    // `premultipliedAlpha` blend below.
    texture.premultiplyAlpha = true;
    texture.needsUpdate = true;

    // Godot world size = glyph-pixels (at the Godot font_size) × pixel_size.
    // The canvas is rasterised at `fontSize` (render resolution), so convert its
    // pixel dimensions back to Godot-pixel space via worldScale before scaling
    // by pixel_size.
    const worldScale = godotFontSize / fontSize;
    const height = canvas.height * properties.pixel_size * worldScale;
    const width = canvas.width * properties.pixel_size * worldScale;
    return { texture, width, height };
  } catch {
    return null;
  }
}

/**
 * Left edge of one line inside the text block, per Godot's
 * `horizontal_alignment`. FILL justifies to the block width, which without a
 * shaper is indistinguishable from LEFT for a single run of glyphs.
 */
function lineOriginX(
  alignment: HorizontalAlignment,
  blockWidth: number,
  lineWidth: number
): number {
  const slack = blockWidth - lineWidth;
  if (alignment === HorizontalAlignment.CENTER) return CANVAS_PADDING + slack / 2;
  if (alignment === HorizontalAlignment.RIGHT) return CANVAS_PADDING + slack;
  return CANVAS_PADDING;
}

function colorToCss(color: Color): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

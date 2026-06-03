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
import { useFrame } from '@react-three/fiber';
import type { Label3DProperties } from './types';
import { BillboardMode } from './types';
import type { Color } from '../../../utils/colorParser';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';

const DEFAULT_FONT_SIZE = 128; // canvas render resolution (crispness)
const GODOT_DEFAULT_FONT_SIZE = 16; // Godot Label3D font_size default (world sizing)

/**
 * Some Godot Label3D properties (font_size, no_depth_test) aren't yet
 * captured by the parser/typed API; they appear opportunistically on the
 * properties record when callers add them. This accessor reads them
 * defensively without forcing the type to grow.
 */
function readExtra<T>(properties: Label3DProperties, key: string): T | undefined {
  return (properties as unknown as Record<string, unknown>)[key] as T | undefined;
}

export function Label3D({ node }: NodeComponentProps) {
  const { showLabels } = useViewportMode();
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // The canvas is rasterised at DEFAULT_FONT_SIZE for crispness when no
  // font_size is given, but the WORLD size must follow Godot's actual font_size
  // (default 16). `godotFontSize` drives the quad dimensions; `fontSize` the
  // canvas resolution.
  const godotFontSize = readExtra<number>(properties, 'font_size') ?? GODOT_DEFAULT_FONT_SIZE;
  const fontSize = readExtra<number>(properties, 'font_size') ?? DEFAULT_FONT_SIZE;
  const noDepthTest = readExtra<boolean>(properties, 'no_depth_test') === true;

  const built = useMemo(
    () => buildLabelTexture(properties, fontSize, godotFontSize),
    [properties, fontSize, godotFontSize]
  );

  // Dispose of the GPU texture and source canvas when the label unmounts
  // or its inputs change.
  useEffect(() => {
    return () => {
      built?.texture.dispose();
    };
  }, [built]);

  const meshRef = useRef<THREE.Mesh | null>(null);

  // WI-R3F-19 parity-audit fix: the pre-migration imperative renderer
  // updated each Label3D's rotation per-frame via `TscnRenderer.updateLabels()`.
  // We restore that behaviour with `useFrame`:
  //   BILLBOARD_DISABLED — no-op.
  //   BILLBOARD_ENABLED  — copy camera.quaternion (full look-at).
  //   BILLBOARD_FIXED_Y  — yaw-only look-at (keep world-up aligned).
  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mode = properties.billboard;
    if (mode === BillboardMode.BILLBOARD_DISABLED) return;
    if (mode === BillboardMode.BILLBOARD_FIXED_Y) {
      const cp = camera.position;
      const mp = mesh.position;
      mesh.rotation.set(0, Math.atan2(cp.x - mp.x, cp.z - mp.z), 0);
      return;
    }
    mesh.quaternion.copy(camera.quaternion);
  });

  // Off by default (ADR-0008): in-viewport text is opt-in via the Labels toggle.
  // When off (or the canvas couldn't be built), render an invisible marker group
  // so the node still positions any children and stays selectable.
  if (!showLabels || !built) {
    return <group name={node.name} position={position} rotation={rotation} scale={scale} />;
  }

  const tint = new THREE.Color(
    properties.modulate.r,
    properties.modulate.g,
    properties.modulate.b
  );

  return (
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
        color={tint}
        transparent
        opacity={properties.modulate.a}
        side={properties.double_sided === false ? THREE.FrontSide : THREE.DoubleSide}
        depthWrite={false}
        depthTest={!noDepthTest}
      />
    </mesh>
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
    const text = properties.text || '';
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `${fontSize}px Arial`;
    const metrics = context.measureText(text);
    canvas.width = Math.max(1, Math.ceil(metrics.width) + 20);
    canvas.height = fontSize + 20;

    if (properties.outline_size > 0) {
      context.font = `${fontSize}px Arial`;
      context.strokeStyle = colorToCss(properties.outline_modulate);
      // outline_size is in Godot font-pixels; scale to the canvas render
      // resolution (fontSize / godotFontSize).
      context.lineWidth = properties.outline_size * (fontSize / godotFontSize);
      context.strokeText(text, 10, fontSize);
    }

    // Rasterise the text in white. The material's `color` carries the
    // modulate tint, so the texture stays font-size-agnostic and can be
    // re-tinted without rebuilding the canvas.
    context.fillStyle = '#ffffff';
    context.font = `${fontSize}px Arial`;
    context.fillText(text, 10, fontSize);

    const texture = new THREE.CanvasTexture(canvas);
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

function colorToCss(color: Color): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

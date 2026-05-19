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

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Label3DProperties } from '../../../nodes/3d/label3d/types';
import type { Color } from '../../../utils/colorParser';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../nodeTransform';

const DEFAULT_FONT_SIZE = 128;

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
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const fontSize = readExtra<number>(properties, 'font_size') ?? DEFAULT_FONT_SIZE;
  const noDepthTest = readExtra<boolean>(properties, 'no_depth_test') === true;

  const built = useMemo(() => buildLabelTexture(properties, fontSize), [properties, fontSize]);

  // Dispose of the GPU texture and source canvas when the label unmounts
  // or its inputs change.
  useEffect(() => {
    return () => {
      built?.texture.dispose();
    };
  }, [built]);

  if (!built) {
    return <group name={node.name} position={position} rotation={rotation} scale={scale} />;
  }

  const tint = new THREE.Color(
    properties.modulate.r,
    properties.modulate.g,
    properties.modulate.b
  );

  return (
    <mesh
      name={node.name}
      position={position}
      rotation={rotation}
      scale={scale}
      userData={{ billboardMode: properties.billboard }}
    >
      <planeGeometry args={[built.width, built.height]} />
      <meshBasicMaterial
        map={built.texture}
        color={tint}
        transparent
        opacity={properties.modulate.a}
        side={THREE.DoubleSide}
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
  fontSize: number
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
      context.lineWidth = properties.outline_size * 10;
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

    // `pixel_size` is world-units-per-pixel. Plane dimensions scale with
    // `fontSize` so font_size=64 produces a label half the height of
    // the FONT_SIZE=128 default.
    const aspect = canvas.width / canvas.height;
    const fontScale = fontSize / DEFAULT_FONT_SIZE;
    const height = properties.pixel_size * 100 * fontScale;
    const width = height * aspect;
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

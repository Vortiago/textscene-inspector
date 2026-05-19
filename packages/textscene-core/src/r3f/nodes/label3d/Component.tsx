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

const FONT_SIZE = 128;

export function Label3D({ node }: NodeComponentProps) {
  const properties = node.properties as Label3DProperties;
  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const built = useMemo(() => buildLabelTexture(properties), [properties]);

  // Dispose of the GPU texture and source canvas when the label unmounts
  // or its inputs change.
  useEffect(() => {
    return () => {
      built?.texture.dispose();
    };
  }, [built]);

  if (!built) {
    // DOM unavailable; render an invisible marker group so the tree stays intact.
    return <group name={node.name} position={position} rotation={rotation} scale={scale} />;
  }

  return (
    <mesh name={node.name} position={position} rotation={rotation} scale={scale}>
      <planeGeometry args={[built.width, built.height]} />
      <meshBasicMaterial
        map={built.texture}
        transparent
        opacity={properties.modulate.a}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

interface BuiltLabel {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
}

function buildLabelTexture(properties: Label3DProperties): BuiltLabel | null {
  if (typeof document === 'undefined') return null;
  try {
    const text = properties.text || '';
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `${FONT_SIZE}px Arial`;
    const metrics = context.measureText(text);
    canvas.width = Math.max(1, Math.ceil(metrics.width) + 20);
    canvas.height = FONT_SIZE + 20;

    if (properties.outline_size > 0) {
      context.font = `${FONT_SIZE}px Arial`;
      context.strokeStyle = colorToCss(properties.outline_modulate);
      context.lineWidth = properties.outline_size * 10;
      context.strokeText(text, 10, FONT_SIZE);
    }

    context.fillStyle = colorToCss(properties.modulate);
    context.font = `${FONT_SIZE}px Arial`;
    context.fillText(text, 10, FONT_SIZE);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const aspect = canvas.width / canvas.height;
    const width = properties.pixel_size * aspect * 100;
    const height = properties.pixel_size * 100;
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

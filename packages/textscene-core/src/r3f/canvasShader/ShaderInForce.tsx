import type { ReactNode } from 'react';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { useIsReachedByLight } from '../components/LitCanvasItemPixels';
import { useClipMask } from '../canvasGroup/ClipMaskContext';

interface ShaderInForceProps {
  /** The item's own canvas_item shader. */
  shader: ShaderText | null;
  /** The shader Godot gives an item with no shader of its own (`materialShaderOf`). */
  materialShader: ShaderText | null;
  /** What the item draws through the classic materials. */
  fallback: ReactNode;
  children: (shader: ShaderText) => ReactNode;
}

/** The template draws no 2D light or clip mask yet: there an item without a shader stays classic. */
export function ShaderInForce({ shader, materialShader, fallback, children }: ShaderInForceProps) {
  const isReachedByLight = useIsReachedByLight();
  const isClipMask = useClipMask() !== null;
  const inForce = shader ?? (isReachedByLight || isClipMask ? null : materialShader);
  return <>{inForce ? children(inForce) : fallback}</>;
}

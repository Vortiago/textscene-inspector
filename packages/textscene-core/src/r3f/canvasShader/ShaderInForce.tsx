import type { ReactNode } from 'react';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { useTemplateLighting } from '../components/LitCanvasItemPixels';
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

/** The template draws no 2D shadow or clip mask yet: there an item without a shader stays classic. */
export function ShaderInForce({ shader, materialShader, fallback, children }: ShaderInForceProps) {
  const isShadowed = useTemplateLighting()?.isShadowed ?? false;
  const isClipMask = useClipMask() !== null;
  const inForce = shader ?? (isShadowed || isClipMask ? null : materialShader);
  return <>{inForce ? children(inForce) : fallback}</>;
}

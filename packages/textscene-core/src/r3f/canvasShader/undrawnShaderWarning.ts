import { useEffect } from 'react';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { warnOnce } from '../../utils/warnOnce';

/** Warns once for `shader` when its item draws but the shader draw cannot, so it keeps Godot's shader. */
export function useUndrawnShaderWarning(
  shader: ShaderText | null,
  node: { readonly type: string; readonly name: string },
  isUndrawn: boolean
): void {
  const { type, name } = node;
  useEffect(() => {
    if (!shader || !isUndrawn) return;
    warnOnce(
      shader,
      `undrawn ${type} ${name}`,
      `[material] The previewer draws ${type} '${name}' with Godot's default canvas shader: it cannot draw this item with a canvas_item shader yet.`
    );
  }, [shader, type, name, isUndrawn]);
}

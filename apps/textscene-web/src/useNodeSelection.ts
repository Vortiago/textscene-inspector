import { useCallback, useState } from 'react';
import type { NodeHandle, Scene } from '@textscene/renderer';

/** The node the previewer selects in `scene`, and the setter. A new scene starts with none. */
export function useNodeSelection(
  scene: Scene | null
): readonly [NodeHandle | null, (node: NodeHandle | null) => void] {
  const [selection, setSelection] = useState<{ scene: Scene | null; node: NodeHandle | null }>({
    scene: null,
    node: null,
  });
  const select = useCallback((node: NodeHandle | null) => setSelection({ scene, node }), [scene]);
  return [selection.scene === scene ? selection.node : null, select];
}

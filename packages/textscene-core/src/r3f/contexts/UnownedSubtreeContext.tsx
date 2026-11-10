/**
 * Whether the nodes being rendered have no owner in the edited scene: the instances a TileMapLayer
 * adds at runtime. The Scene dock hides an unowned node (`scene_tree_editor.cpp:278-290`) and a
 * click selects the deepest editable ancestor (`canvas_item_editor_plugin.cpp:694-696`), so
 * `PlainNode` registers no selection target below one.
 */

import { createContext, useContext, type ReactNode } from 'react';

const UnownedSubtreeContext = createContext(false);
UnownedSubtreeContext.displayName = 'UnownedSubtreeContext';

export function UnownedSubtree({ children }: { children: ReactNode }) {
  return <UnownedSubtreeContext.Provider value={true}>{children}</UnownedSubtreeContext.Provider>;
}

export function useIsUnownedSubtree(): boolean {
  return useContext(UnownedSubtreeContext);
}

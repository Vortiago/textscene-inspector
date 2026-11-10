/**
 * Whether the nodes being rendered have no owner in the edited scene, as the instances a tile layer
 * adds. A click selects the deepest editable ancestor (`canvas_item_editor_plugin.cpp:694-696`),
 * so `PlainNode` registers no selection target below one.
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

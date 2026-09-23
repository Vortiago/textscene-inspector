/**
 * The full path of the TSCN node being rendered, such as "World/Hallway/Lamp".
 * Only the NodeDispatcher knows it, so it provides this for each child, and a
 * component tags its three.js objects with it.
 */

import { createContext, useContext, type ReactNode } from 'react';

const NodePathContext = createContext<string | null>(null);
NodePathContext.displayName = 'NodePathContext';

export interface NodePathProviderProps {
  path: string;
  children: ReactNode;
}

export function NodePathProvider({ path, children }: NodePathProviderProps) {
  return <NodePathContext.Provider value={path}>{children}</NodePathContext.Provider>;
}

/** The path of the nearest enclosing TSCN node, or `null` outside the dispatcher. */
export function useNodePath(): string | null {
  return useContext(NodePathContext);
}

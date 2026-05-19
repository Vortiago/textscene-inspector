/**
 * Per-rendered-node "what's my path?" context.
 *
 * The NodeDispatcher is the only thing that knows a node's full path
 * (e.g. "World/Hallway/Lamp") because the SceneGraph is the source of
 * truth. Individual node-component implementations like Camera3D need
 * to read that path to tag their three.js objects (so the canvas can
 * later look up "the camera at path X" and switch to it).
 *
 * The dispatcher provides this context for each rendered child. Any
 * mesh / camera / light inside the subtree can call `useNodePath()` to
 * find out which TSCN node owns it.
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

/**
 * Returns the path of the nearest enclosing TSCN node, or `null` when
 * rendered outside the dispatcher (test scaffolding usage).
 */
export function useNodePath(): string | null {
  return useContext(NodePathContext);
}

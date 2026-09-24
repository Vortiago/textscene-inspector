/**
 * The Godot editor workspace a canvas hosts (ADR-0006): '3d' draws only Node3D
 * content, '2d' only CanvasItem content, as in Godot's editor. The dispatcher
 * drops the other kind's subtrees. The default is '3d'.
 */
import { createContext, useContext, type ReactNode } from 'react';

export type CanvasWorkspace = '2d' | '3d';

const CanvasWorkspaceContext = createContext<CanvasWorkspace>('3d');
CanvasWorkspaceContext.displayName = 'CanvasWorkspaceContext';

export function CanvasWorkspaceProvider({
  workspace,
  children,
}: {
  workspace: CanvasWorkspace;
  children: ReactNode;
}) {
  return (
    <CanvasWorkspaceContext.Provider value={workspace}>{children}</CanvasWorkspaceContext.Provider>
  );
}

export function useCanvasWorkspace(): CanvasWorkspace {
  return useContext(CanvasWorkspaceContext);
}

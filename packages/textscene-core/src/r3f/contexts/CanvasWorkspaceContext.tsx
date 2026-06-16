/**
 * Which Godot editor workspace a render canvas hosts (ADR-0006, Godot-parity
 * amendment): '3d' — the spatial viewport, renders Node3D content only;
 * '2d' — the 2D world canvas inside the Canvas2DStage, renders CanvasItem
 * content only. The dispatcher reads this to drop the other kind's subtrees,
 * mirroring how Godot's 3D editor never draws CanvasItems and its 2D editor
 * never draws Node3Ds. Default is '3d' (the primary TscnCanvas).
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

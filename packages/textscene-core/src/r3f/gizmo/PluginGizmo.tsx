/**
 * The gate of a Godot gizmo-plugin gizmo. It mounts its children when the Gizmos toggle and the
 * selection allow, and hands them the look of their node: faint when the node is not selected, grey
 * inside an instance the edited scene does not own. `GizmoLine` and `GizmoMesh` read that look.
 * A part outside every gate is no plugin material, and keeps its own colour.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useGizmoState, type GizmoDrawnFor } from '../hooks/useGizmoState';
import { useIsInstantiated } from '../hooks/useIsInstantiated';
import type { GizmoVariant } from './gizmoVariant';

interface GizmoLookValue {
  variant: GizmoVariant;
  isInstantiated: boolean;
}

const GizmoLookContext = createContext<GizmoLookValue | null>(null);
GizmoLookContext.displayName = 'GizmoLookContext';

interface PluginGizmoProps {
  drawnFor: GizmoDrawnFor;
  children: ReactNode;
}

export function PluginGizmo({ drawnFor, children }: PluginGizmoProps) {
  const state = useGizmoState(drawnFor);
  if (state === 'hidden') return null;
  return <LookProvider variant={state}>{children}</LookProvider>;
}

/** Split from the gate so a hidden gizmo never reads the instance owners. */
function LookProvider({ variant, children }: { variant: GizmoVariant; children: ReactNode }) {
  const isInstantiated = useIsInstantiated();
  const look = useMemo(() => ({ variant, isInstantiated }), [variant, isInstantiated]);
  return <GizmoLookContext.Provider value={look}>{children}</GizmoLookContext.Provider>;
}

/**
 * Mounts its children only for a selected node, inside a gate that is drawn for every node. Godot
 * adds such a part, a fill or an emission shape, to a selected gizmo alone. Outside a gate it mounts nothing.
 */
export function SelectedOnly({ children }: { children: ReactNode }) {
  return useGizmoLookValue()?.variant === 'selected' ? children : null;
}

/** The look the enclosing {@link PluginGizmo} gives, or null for a gizmo that is no plugin material. */
export function useGizmoLookValue(): GizmoLookValue | null {
  return useContext(GizmoLookContext);
}

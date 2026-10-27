/**
 * The scene files on the way down to the node being rendered: the edited root, then each instance
 * whose sub-scene authored nodes below it. `useIsInstantiated` reads it to give a gizmo the look
 * Godot gives a node the edited root does not own (`instanceOwners.ts`).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ROOT_OWNER, instanceOwner, type InstanceOwner } from '../instanceOwners';
import { useInstancedScenePaths } from './InstancedScenePathsContext';

const NO_PATHS: readonly string[] = [];

const InstanceOwnersContext = createContext<readonly InstanceOwner[]>([ROOT_OWNER]);
InstanceOwnersContext.displayName = 'InstanceOwnersContext';

interface EditedRootProviderProps {
  /** The `[editable]` paths of the scene being edited. */
  editableInstances: readonly string[] | undefined;
  children: ReactNode;
}

/** Starts the list with the edited root, which lists `editableInstances`. */
export function EditedRootProvider({ editableInstances = NO_PATHS, children }: EditedRootProviderProps) {
  const owners = useMemo(() => [{ ...ROOT_OWNER, editablePaths: editableInstances }], [editableInstances]);
  return <InstanceOwnersContext.Provider value={owners}>{children}</InstanceOwnersContext.Provider>;
}

interface InstanceOwnerProviderProps {
  /** The root-relative path of the instance node. */
  path: string;
  /** The `[editable]` paths of the instanced scene's own file. */
  editablePaths: readonly string[] | undefined;
  children: ReactNode;
}

/**
 * Adds the instance at `path` to the list. Mounted where the dispatcher renders an instance, so the
 * scenes that enclose it are the ones the ambient chain holds.
 */
export function InstanceOwnerProvider({
  path,
  editablePaths = NO_PATHS,
  children,
}: InstanceOwnerProviderProps) {
  const enclosing = useContext(InstanceOwnersContext);
  const level = useInstancedScenePaths().length + 1;
  const owners = useMemo(
    () => [...enclosing, instanceOwner(enclosing, level, path, editablePaths)],
    [enclosing, level, path, editablePaths]
  );
  return <InstanceOwnersContext.Provider value={owners}>{children}</InstanceOwnersContext.Provider>;
}

/** The edited root and each instance above the node, outermost first. */
export function useInstanceOwners(): readonly InstanceOwner[] {
  return useContext(InstanceOwnersContext);
}

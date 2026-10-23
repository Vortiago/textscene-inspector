/**
 * A node's place in a viewport for gizmo tests: the Gizmos toggle, the selection and the node's
 * path. Test-only: the `testing/` directories under `src` are excluded from the build.
 */
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedScenePathsProvider } from '../contexts/InstancedScenePathsContext';
import { InstanceOwnerProvider } from '../contexts/InstanceOwnersContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { PluginGizmo } from '../gizmo/PluginGizmo';
import { SelectSeeder } from './SelectSeeder';

interface GizmoSceneProps {
  /** The path of the node under test, or null for a gizmo outside a node dispatcher. */
  nodePath: string | null;
  /** The selected path, or null for no selection. */
  selectedPath: string | null;
  showGizmos?: boolean;
  /** Places the node inside an instance the edited scene does not list as editable. */
  instantiated?: boolean;
  children: ReactNode;
}

/**
 * The instance a node sits in when {@link GizmoSceneProps.instantiated} is set. The node keeps its own
 * path, so the instance path does not prefix it: the owner list alone decides the look.
 */
export function InsideLockedInstance({ children }: { children: ReactNode }) {
  return (
    <InstanceOwnerProvider path="Instance" editablePaths={undefined}>
      <InstancedScenePathsProvider paths={['res://instance.tscn']}>{children}</InstancedScenePathsProvider>
    </InstanceOwnerProvider>
  );
}

export function GizmoScene({
  nodePath,
  selectedPath,
  showGizmos = true,
  instantiated = false,
  children,
}: GizmoSceneProps) {
  const node = nodePath === null ? children : <NodePathProvider path={nodePath}>{children}</NodePathProvider>;
  return (
    <ViewportModeProvider initialShowGizmos={showGizmos}>
      <SelectionProvider>
        <SelectSeeder path={selectedPath} />
        {instantiated ? <InsideLockedInstance>{node}</InsideLockedInstance> : node}
      </SelectionProvider>
    </ViewportModeProvider>
  );
}

/** A gizmo part drawn for every node in `variant`, inside its node's `PluginGizmo`. */
export function GizmoPartScene({ variant, children }: { variant: GizmoVariant; children: ReactNode }) {
  return (
    <GizmoScene nodePath="Node" selectedPath={variant === 'selected' ? 'Node' : null}>
      <PluginGizmo drawnFor="every-node">{children}</PluginGizmo>
    </GizmoScene>
  );
}

export type TestRenderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** The material of each gizmo line object, in draw order. */
export function lineMaterials(renderer: TestRenderer): THREE.LineBasicMaterial[] {
  return renderer.scene
    .findAllByType('LineSegments')
    .map((line) => (line.instance as THREE.LineSegments).material as THREE.LineBasicMaterial);
}

/** The opacity of each gizmo line object, in draw order. */
export function lineOpacities(renderer: TestRenderer): number[] {
  return lineMaterials(renderer).map((material) => material.opacity);
}

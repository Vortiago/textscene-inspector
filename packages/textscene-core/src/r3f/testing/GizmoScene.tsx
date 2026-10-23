/**
 * A node's place in a viewport for gizmo tests: the Gizmos toggle, the selection and the node's
 * path. Test-only: the `testing/` directories under `src` are excluded from the build.
 */
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodePathProvider } from '../contexts/NodePathContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { SelectSeeder } from './SelectSeeder';

interface GizmoSceneProps {
  /** The path of the node under test, or null for a gizmo outside a node dispatcher. */
  nodePath: string | null;
  /** The selected path, or null for no selection. */
  selectedPath: string | null;
  showGizmos?: boolean;
  children: ReactNode;
}

export function GizmoScene({ nodePath, selectedPath, showGizmos = true, children }: GizmoSceneProps) {
  return (
    <ViewportModeProvider initialShowGizmos={showGizmos}>
      <SelectionProvider>
        <SelectSeeder path={selectedPath} />
        {nodePath === null ? children : <NodePathProvider path={nodePath}>{children}</NodePathProvider>}
      </SelectionProvider>
    </ViewportModeProvider>
  );
}

type TestRenderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** The opacity of each gizmo line object, in draw order. */
export function lineOpacities(renderer: TestRenderer): number[] {
  return renderer.scene
    .findAllByType('LineSegments')
    .map((line) => ((line.instance as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity);
}

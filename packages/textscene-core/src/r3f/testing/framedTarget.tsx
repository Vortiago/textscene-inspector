/**
 * Renders a scene's root through its registered components and frames the camera on it, as the
 * fit on open does. Test-only: the build excludes the `testing/` directories under `src`.
 */
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../../parser/TscnParser';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { frameSceneBounds } from '../frameSceneBounds';
import { NodeTree } from './NodeTree';

/** The `.tscn` text's first node, mounted through the registered components. */
export async function renderScene(source: string) {
  const scene = new TscnParser().parse(source);
  const root = scene.nodes[0]!;
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={root.name} />
    </SceneResourcesProvider>
  );
}

/** The point `frameSceneBounds` aims the controls at for the scene. */
export async function framedTarget(source: string): Promise<THREE.Vector3> {
  const renderer = await renderScene(source);
  const controls = { target: new THREE.Vector3(), update: () => {} };
  frameSceneBounds(renderer.scene.instance, new THREE.PerspectiveCamera(70, 1, 0.1, 4000), controls);
  return controls.target;
}

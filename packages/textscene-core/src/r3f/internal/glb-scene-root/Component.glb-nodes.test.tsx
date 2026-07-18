/**
 * GLBSceneRoot registers each internal GLB object under its tree path so
 * the SceneTreeViewer can select (gizmo) + hide individual nodes, and drives
 * per-object visibility from the hidden-paths set. Registrations clear on unmount.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { initGlbModules } from '../../../resources/processing/glbProcessing';
import { GLBSceneRoot, GLB_SCENE_ROOT_TYPE } from './Component';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  SelectionProvider,
  useSelection,
  type SelectionContextValue,
} from '../../contexts/SelectionContext';
import { NodePathProvider } from '../../contexts/NodePathContext';
import type { TscnNode } from '../../../parser/types';

/** body (Mesh), Armature (Group → hand Mesh). */
function makeFakeGlb(): THREE.Object3D {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  body.name = 'body';
  const armature = new THREE.Group();
  armature.name = 'Armature';
  const hand = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  hand.name = 'hand';
  armature.add(hand);
  root.add(body, armature);
  return root;
}

const NODE: TscnNode = {
  name: 'Glb',
  type: GLB_SCENE_ROOT_TYPE,
  children: [],
  properties: { glbPath: 'res://x.glb' } as Record<string, unknown>,
};

let captured: SelectionContextValue;
function Probe() {
  captured = useSelection();
  return null;
}

async function mount(loader: ResourceLoader) {
  const renderer = await ReactThreeTestRenderer.create(
    <SelectionProvider>
      <ResourceLoaderProvider loader={loader}>
        <Probe />
        <NodePathProvider path="Glb">
          <GLBSceneRoot node={NODE} />
        </NodePathProvider>
      </ResourceLoaderProvider>
    </SelectionProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

// GLBSceneRoot clones Object3D via cloneWithMaterials which requires the lazy
// GLB module cache to be initialised first.
beforeAll(async () => {
  await initGlbModules();
});

describe('GLBSceneRoot — WI-D select + hide', () => {
  it('registers each internal object under its tree path', async () => {
    const fake = createFakeResourceLoader();
    fake.glbMeshes.seed('res://x.glb', makeFakeGlb());
    await mount(fake.loader);

    expect(captured.nodeObjectMap.get('Glb/body')).toBeDefined();
    expect(captured.nodeObjectMap.get('Glb/Armature')).toBeDefined();
    expect(captured.nodeObjectMap.get('Glb/Armature/hand')).toBeDefined();
  });

  it('hides only the toggled internal node', async () => {
    const fake = createFakeResourceLoader();
    fake.glbMeshes.seed('res://x.glb', makeFakeGlb());
    await mount(fake.loader);

    await ReactThreeTestRenderer.act(async () => {
      captured.toggleHidden('Glb/Armature/hand');
    });

    expect(captured.nodeObjectMap.get('Glb/Armature/hand')!.visible).toBe(false);
    expect(captured.nodeObjectMap.get('Glb/body')!.visible).toBe(true);
  });

  it('unregisters internal objects on unmount', async () => {
    const fake = createFakeResourceLoader();
    fake.glbMeshes.seed('res://x.glb', makeFakeGlb());
    const renderer = await mount(fake.loader);

    await ReactThreeTestRenderer.act(async () => {
      await renderer.unmount();
    });

    expect(captured.nodeObjectMap.get('Glb/body')).toBeUndefined();
    expect(captured.nodeObjectMap.get('Glb/Armature/hand')).toBeUndefined();
  });
});

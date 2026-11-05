/**
 * `<EmbeddedWindows>` draws each window an embedder registers: its target over its rect, under the
 * frame, title and close icon of a decorated window (`viewport.cpp:342-401`), in stack order.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { quadsSampling } from '../../../r3f/controls/native/testing/quadsSampling';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { ViewportTexturePublisher, viewportEntry } from '../../../r3f/testing/ViewportTexturePublisher';
import { heading } from '../../../parser/testing/parserKit';
import { parseWindow } from './parser';
import { EmbeddedWindows } from './EmbeddedWindows';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };

function windowNode(path: string, type: string, properties: Record<string, string>): SolveNode {
  const name = path.split('/').pop()!;
  const node = { name, type, children: [], properties: parseWindow(heading(type, { name }), properties) };
  return { ...solveNode(), path, node: node as unknown as TscnNode };
}

async function draw(windows: SolveNode[], published: string[], forestPath = '') {
  const textures = new Map(published.map((path) => [path, new THREE.Texture()]));
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportTextureProvider>
      {[...textures].map(([path, texture]) => (
        <ViewportTexturePublisher key={path} path={path} entry={viewportEntry(texture, { x: 1, y: 1 })} />
      ))}
      <EmbeddedWindows windows={windows} embedderSize={EMBEDDER} forestPath={forestPath} theme={THEME} />
    </ViewportTextureProvider>
  );
  return { renderer, textures };
}

/** The world position of a quad's top-left corner, in Godot pixels (+Y down). */
function topLeft(mesh: THREE.Mesh): { x: number; y: number } {
  mesh.updateWorldMatrix(true, false);
  const bounds = new THREE.Box3().setFromObject(mesh);
  return { x: bounds.min.x, y: -bounds.max.y };
}

function meshes(renderer: Awaited<ReturnType<typeof draw>>['renderer']): THREE.Mesh[] {
  return renderer.scene.findAll((n) => n.instance instanceof THREE.Mesh).map((n) => n.instance as THREE.Mesh);
}

describe('<EmbeddedWindows>', () => {
  it('draws the window’s target at its position and size', async () => {
    const window = windowNode('Dialog', 'Window', {
      position: 'Vector2i(100, 120)',
      size: 'Vector2i(300, 200)',
    });
    const { renderer, textures } = await draw([window], ['Dialog']);
    const [content] = quadsSampling(renderer.scene, textures.get('Dialog')!);

    expect(content).toBeDefined();
    expect(topLeft(content!)).toEqual({ x: 100, y: 120 });
  });

  it('samples the target at the window’s live path below the forest’s viewport', async () => {
    const window = windowNode('Dialog', 'Window', { borderless: 'true' });
    const { renderer, textures } = await draw([window], ['Root/View/Dialog'], 'Root/View');
    expect(quadsSampling(renderer.scene, textures.get('Root/View/Dialog')!)).toHaveLength(1);
  });

  it('centres a window that is not placed absolutely in the embedder (`window.cpp:1555-1560`)', async () => {
    const window = windowNode('Dialog', 'Window', { size: 'Vector2i(300, 200)', initial_position: '1' });
    const { renderer, textures } = await draw([window], ['Dialog']);
    const [content] = quadsSampling(renderer.scene, textures.get('Dialog')!);

    expect(topLeft(content!)).toEqual({ x: 426, y: 224 });
  });

  it('draws only the target of a borderless window', async () => {
    const window = windowNode('Menu', 'Popup', { visible: 'true' });
    const { renderer } = await draw([window], ['Menu']);
    expect(meshes(renderer)).toHaveLength(1);
  });

  it('frames a decorated window before its target', async () => {
    const window = windowNode('Dialog', 'Window', { title: '"Hello"' });
    const { renderer, textures } = await draw([window], ['Dialog']);
    const [content] = quadsSampling(renderer.scene, textures.get('Dialog')!);
    const others = meshes(renderer).filter((mesh) => mesh !== content);

    expect(others.length).toBeGreaterThan(0);
    for (const mesh of others) expect(mesh.renderOrder).toBeLessThan(content!.renderOrder);
  });

  it('draws nothing for a hidden window, which never registers', async () => {
    const window = windowNode('Menu', 'Popup', {});
    const { renderer } = await draw([window], ['Menu']);
    expect(meshes(renderer)).toHaveLength(0);
  });

  it('draws an always-on-top window over a window registered after it', async () => {
    const onTop = windowNode('OnTop', 'Window', { always_on_top: 'true', borderless: 'true' });
    const later = windowNode('Later', 'Window', { borderless: 'true' });
    const { renderer, textures } = await draw([onTop, later], ['OnTop', 'Later']);
    const [onTopContent] = quadsSampling(renderer.scene, textures.get('OnTop')!);
    const [laterContent] = quadsSampling(renderer.scene, textures.get('Later')!);

    expect(onTopContent!.renderOrder).toBeGreaterThan(laterContent!.renderOrder);
  });
});

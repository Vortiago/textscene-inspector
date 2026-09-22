/**
 * <ColorRect> — the native (WebGL canvas) painter for ColorRect: one
 * quad, sized to the solved rect, filled with the parsed `color` multiplied
 * by the inherited tint. Colour composition is asserted at exact LINEAR
 * values via the same `THREE.Color().setRGB(..., THREE.SRGBColorSpace)`
 * conversion `useGodotLinearColor` uses (`r3f/godotColor.ts`) — an
 * independent ground truth computed from known literal inputs, not a
 * re-derivation of the component's own arithmetic.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ColorRect } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(
  path: string,
  type: string,
  properties: Record<string, unknown>,
  children: SolveNode[] = []
): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  return { ...emptySolveNode(), path, node: tscnNode, children };
}

/** Ground-truth linear conversion — the exact call `useGodotLinearColor` makes. */
function expectedLinear(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

describe('<ColorRect> (isolated painter contract)', () => {
  it('draws exactly one quad sized to the solved rect', async () => {
    const node = solveNode('Root', 'ColorRect', { color: 'Color(1, 0, 0, 1)' });
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRect {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 64, h: 32 }} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);
  });

  it('defaults to opaque white when color is absent (Godot default Color(1,1,1,1))', async () => {
    const node = solveNode('Root', 'ColorRect', {});
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRect {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 10, h: 10 }} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const expected = expectedLinear(1, 1, 1);
    expect(material.color.r).toBeCloseTo(expected.r);
    expect(material.color.g).toBeCloseTo(expected.g);
    expect(material.color.b).toBeCloseTo(expected.b);
    expect(material.opacity).toBe(1);
  });

  it('multiplies the parsed color by the walker-composed tint, converted to linear exactly once', async () => {
    const node = solveNode('Root', 'ColorRect', { color: 'Color(0.8, 0.4, 0.2, 0.5)' });
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRect
        {...painterEnv()}
        // The product the walker hands down: inherited(.5,.5,.5,.5) × self_modulate(1,.5,1,1).
        tint={painterTint({ r: 0.5, g: 0.25, b: 0.5, a: 0.5 })}
        solveNode={node}
        rect={{ x: 0, y: 0, w: 10, h: 10 }}
        renderOrder={0}
      />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;

    // own(sRGB) = tint(0.5,0.25,0.5,0.5) * color(0.8,0.4,0.2,0.5) = (0.4, 0.1, 0.1, 0.25)
    const expected = expectedLinear(0.4, 0.1, 0.1);
    expect(material.color.r).toBeCloseTo(expected.r);
    expect(material.color.g).toBeCloseTo(expected.g);
    expect(material.color.b).toBeCloseTo(expected.b);
    expect(material.opacity).toBeCloseTo(0.25);
  });

  it('is transparent and non-depth-writing, spreading the shared clip planes hook (edge: empty list)', async () => {
    const node = solveNode('Root', 'ColorRect', { color: 'Color(1, 1, 1, 1)' });
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRect {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 10, h: 10 }} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.clippingPlanes).toEqual([]);
  });
});

describe('<ColorRect> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('draws its quad through the real registry entry, at the walker-solved rect', async () => {
    controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect });
    controlSolverRegistry.clear();
    const root = solveNode('Root', 'ColorRect', {
      color: 'Color(1, 0, 0, 1)',
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 64,
      offsetBottom: 32,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);

    controlComponentRegistry.clear();
  });

  it('folds the node’s OWN modulate in exactly once — ambient × self_modulate = 0.25, never 0.125', async () => {
    controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect });
    controlSolverRegistry.clear();
    // BOTH authored on the SAME node, which is what the isolated painter
    // tests above cannot express: the walker folds them in sequence and the
    // painter multiplies only its own `color` onto the result. A painter that
    // read `modulate` off the node again would square it to 0.125.
    const root = solveNode('Root', 'ColorRect', {
      color: 'Color(1, 1, 1, 1)',
      modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
      anchorsPreset: 15,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const mesh = renderer.scene.findByType('Mesh');
    const material = (mesh.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.color.r).toBeCloseTo(expectedLinear(0.25, 0.25, 0.25).r, 5);
    expect(material.opacity).toBeCloseTo(0.25, 5);

    controlComponentRegistry.clear();
  });

  it('honours visible === false on the ColorRect node itself', async () => {
    controlComponentRegistry.register({ typeName: 'ColorRect', Component: ColorRect });
    controlSolverRegistry.clear();
    const root = solveNode('Root', 'ColorRect', { anchorsPreset: 15, visible: false });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { visible: boolean; name: string });
    const rootGroup = groups.find((g) => g.name === 'ColorRect:Root');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.visible).toBe(false);

    controlComponentRegistry.clear();
  });
});

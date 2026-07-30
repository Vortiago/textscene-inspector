/**
 * <ColorRectNative> — the native (WebGL canvas) painter for ColorRect: one
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
import {
  controlComponentRegistry,
  type ControlComponent,
} from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { ColorRectNative } from './NativeComponent';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const DomStub: ControlComponent = () => null;

function solveNode(
  path: string,
  type: string,
  properties: Record<string, unknown>,
  children: SolveNode[] = []
): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type, children: [], properties: { name, ...properties } };
  return { path, node: tscnNode, children, styleBoxes: {}, textureSize: null };
}

/** Ground-truth linear conversion — the exact call `useGodotLinearColor` makes. */
function expectedLinear(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

describe('<ColorRectNative> (isolated painter contract)', () => {
  it('draws exactly one quad sized to the solved rect', async () => {
    const node = solveNode('Root', 'ColorRect', { color: 'Color(1, 0, 0, 1)' });
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRectNative solveNode={node} rect={{ x: 0, y: 0, w: 64, h: 32 }} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = meshes[0]!.instance.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);
  });

  it('defaults to opaque white when color is absent (Godot default Color(1,1,1,1))', async () => {
    const node = solveNode('Root', 'ColorRect', {});
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRectNative solveNode={node} rect={{ x: 0, y: 0, w: 10, h: 10 }} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = mesh.instance.material as THREE.MeshBasicMaterial;
    const expected = expectedLinear(1, 1, 1);
    expect(material.color.r).toBeCloseTo(expected.r);
    expect(material.color.g).toBeCloseTo(expected.g);
    expect(material.color.b).toBeCloseTo(expected.b);
    expect(material.opacity).toBe(1);
  });

  it('multiplies the parsed color by self_modulate and the inherited ancestor tint, converted to linear exactly once', async () => {
    const node = solveNode('Root', 'ColorRect', {
      color: 'Color(0.8, 0.4, 0.2, 0.5)',
      selfModulate: { r: 1, g: 0.5, b: 1, a: 1 },
    });
    const renderer = await ReactThreeTestRenderer.create(
      <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 0.5 }}>
        <ColorRectNative solveNode={node} rect={{ x: 0, y: 0, w: 10, h: 10 }} />
      </Modulate2DContext.Provider>
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = mesh.instance.material as THREE.MeshBasicMaterial;

    // own(sRGB) = inherited(0.5,0.5,0.5,0.5) * self_modulate(1,0.5,1,1) * color(0.8,0.4,0.2,0.5)
    //           = (0.4, 0.1, 0.1, 0.25)
    const expected = expectedLinear(0.4, 0.1, 0.1);
    expect(material.color.r).toBeCloseTo(expected.r);
    expect(material.color.g).toBeCloseTo(expected.g);
    expect(material.color.b).toBeCloseTo(expected.b);
    expect(material.opacity).toBeCloseTo(0.25);
  });

  it('is transparent and non-depth-writing, spreading the shared clip planes hook (edge: empty list)', async () => {
    const node = solveNode('Root', 'ColorRect', { color: 'Color(1, 1, 1, 1)' });
    const renderer = await ReactThreeTestRenderer.create(
      <ColorRectNative solveNode={node} rect={{ x: 0, y: 0, w: 10, h: 10 }} />
    );
    const mesh = renderer.scene.findByType('Mesh');
    const material = mesh.instance.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.clippingPlanes).toEqual([]);
  });
});

describe('<ColorRectNative> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('draws its quad through the real registry entry, at the walker-solved rect', async () => {
    controlComponentRegistry.register({ typeName: 'ColorRect', Component: DomStub, Native: ColorRectNative });
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
    const geometry = meshes[0]!.instance.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(32);

    controlComponentRegistry.clear();
  });

  it('honours visible === false on the ColorRect node itself', async () => {
    controlComponentRegistry.register({ typeName: 'ColorRect', Component: DomStub, Native: ColorRectNative });
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

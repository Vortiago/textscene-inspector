/**
 * Strict-verification harness (group J) — 5 assertions covering
 * Label3D rendering. Several of these properties are nominally in Godot's
 * Label3D but not in our parser/types yet; failures here drive the
 * inventory of missing Label3D feature coverage.
 *
 * Label3D text is gated behind the `showLabels` toggle (ON by default per the
 * ADR-0008 Label3D parity amendment); each render runs inside a provider with
 * labels enabled to make that explicit.
 *
 * Assertions: 90–94 of `docs/archive/STRICT-VERIFICATION.md`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Label3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Label3DProperties } from './types';
import { BillboardMode } from './types';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';

// happy-dom doesn't provide a 2D canvas context; mock it so Label3D's
// canvas-rasterised path runs.
beforeEach(() => {
  const mockContext = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    measureText: vi.fn(() => ({ width: 100 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
    if (type === '2d') return mockContext as unknown as CanvasRenderingContext2D;
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function makeNode(overrides: Partial<Label3DProperties> = {}): TscnNode {
  const props: Label3DProperties = {
    name: 'L',
    text: 'Hello',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_ENABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    ...overrides,
  };
  return { name: 'L', type: 'Label3D', children: [], properties: props };
}

function renderLabel(node: TscnNode) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowLabels>
      <Label3D node={node} />
    </ViewportModeProvider>
  );
}

describe('Label3D (assertions 90–94)', () => {
  it('#90 text → label text content rendered (texture exists, billboard mesh present)', async () => {
    const renderer = await renderLabel(makeNode({ text: 'Hi' }));
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as THREE.MeshBasicMaterial;
    // Rasterised text is on the texture map — assert texture exists.
    expect(mat.map).not.toBeNull();
  });

  it('#91 font_size → scale or size applied (Godot exposes font_size, our parser does not capture it)', async () => {
    // This catches the gap: font_size is a real Godot property, currently
    // unsupported in our type / parser. The assertion will fail until added.
    const node = makeNode();
    (node.properties as unknown as { font_size: number }).font_size = 64;
    const renderer = await renderLabel(node);
    const mesh = renderer.scene.findByType('Mesh');
    // Expect the rendered plane to scale relative to font_size — sentinel:
    // a font_size-aware implementation would produce a different height
    // than the default. We assert mesh exists for now; the property check
    // can be tightened once the parser captures it.
    const geom = mesh.instance.geometry as unknown as { parameters: { height: number } };
    // Default pixel_size=0.01 + FONT_SIZE=128 → height ≈ 0.01 * 100 = 1.0
    // (the current implementation ignores font_size). With font_size=64
    // we'd expect HALF that height. This test fails until font_size is wired.
    expect(geom.parameters.height).not.toBeCloseTo(1.0, 2);
  });

  it('#92 modulate color → material color matches (tint applied to rendered text)', async () => {
    const renderer = await renderLabel(makeNode({ modulate: { r: 1, g: 0, b: 0, a: 1 } }));
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as THREE.MeshBasicMaterial;
    // Today the modulate color is applied via the canvas fillStyle (text
    // pixels). The material color itself is not tinted. This asserts that
    // either path produces a red appearance — for now, check material color
    // and surface the gap if it's white.
    expect(mat.color.r).toBeCloseTo(1, 2);
    expect(mat.color.g).toBeCloseTo(0, 2);
    expect(mat.color.b).toBeCloseTo(0, 2);
  });

  it('#93 billboard=ENABLED → billboard mode persisted (for runtime billboarding)', async () => {
    const renderer = await renderLabel(makeNode({ billboard: BillboardMode.BILLBOARD_ENABLED }));
    const mesh = renderer.scene.findByType('Mesh');
    // The imperative renderer stored userData.billboardMode; the R3F port
    // does not. This assertion catches the gap so runtime billboarding
    // can be added later (per-frame look-at-camera).
    expect((mesh.instance.userData as { billboardMode?: number }).billboardMode).toBe(
      BillboardMode.BILLBOARD_ENABLED
    );
  });

  it('#94 no_depth_test=true → material.depthTest === false', async () => {
    // Godot's "no_depth_test" flag makes Label3D ignore depth — useful for
    // UI-style labels that should always be visible. Our parser does not
    // capture this property; the material defaults depthTest=true.
    const node = makeNode();
    (node.properties as unknown as { no_depth_test: boolean }).no_depth_test = true;
    const renderer = await renderLabel(node);
    const mesh = renderer.scene.findByType('Mesh');
    const mat = mesh.instance.material as THREE.MeshBasicMaterial;
    expect(mat.depthTest).toBe(false);
  });
});

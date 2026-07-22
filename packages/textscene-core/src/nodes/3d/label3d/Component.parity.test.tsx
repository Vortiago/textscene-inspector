/**
 * Parity: Label3D defaults + sizing vs Godot.
 * - billboard default is DISABLED (was ENABLED → labels wrongly tracked camera).
 * - pixel_size default 0.005; outline_size default 12 (Godot defaults).
 * - quad world size = Godot-font-pixels × pixel_size (worldScale corrects for
 *   the high-res canvas rendered at RENDER_FONT_SIZE vs Godot's font_size,
 *   whose class-reference default is 32 — class_label3d.html properties table).
 * - double_sided=false → FrontSide.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseLabel3D } from './parser';
import { BillboardMode } from './types';
import { Label3D } from './Component';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Label3D', name: 'L' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'L', type: 'Label3D', children: [], properties: parseLabel3D(heading, { text: '"Hi"', ...raw }) };
}

// happy-dom has no 2D canvas context; stub it so Label3D builds its texture.
let mockContext: { font: string; fillStyle: string; strokeStyle: string; lineWidth: number };
beforeEach(() => {
  mockContext = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    measureText: vi.fn(() => ({ width: 100 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  } as typeof mockContext;
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) =>
    type === '2d' ? (mockContext as unknown as CanvasRenderingContext2D) : null
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// Label3D text is gated behind showLabels (ON by default per the ADR-0008
// Label3D parity amendment); render inside a provider with labels enabled.
function renderLabel(n: TscnNode) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowLabels>
      <Label3D node={n} />
    </ViewportModeProvider>
  );
}

describe('Label3D parser parity', () => {
  it('billboard defaults to DISABLED', () => {
    expect(parseLabel3D(heading, {}).billboard).toBe(BillboardMode.BILLBOARD_DISABLED);
  });
  it('pixel_size defaults to 0.005', () => {
    expect(parseLabel3D(heading, {}).pixel_size).toBeCloseTo(0.005, 5);
  });
  it('outline_size defaults to 12', () => {
    expect(parseLabel3D(heading, {}).outline_size).toBe(12);
  });
  it('double_sided defaults to true; parses false', () => {
    expect(parseLabel3D(heading, {}).double_sided).toBe(true);
    expect(parseLabel3D(heading, { double_sided: 'false' }).double_sided).toBe(false);
  });
});

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

describe('Label3D render parity', () => {
  it('double_sided=false → FrontSide material', async () => {
    const r = await renderLabel(node({ double_sided: 'false' }));
    const mat = r.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('modulate tint is converted sRGB→linear before the material (#6 parity)', async () => {
    const r = await renderLabel(node({ modulate: 'Color(0.5, 0.5, 0.5, 1)' }));
    const color = (r.scene.findByType('Mesh').instance.material as THREE.MeshBasicMaterial).color;
    expect(color.r).toBeCloseTo(srgbToLinear(0.5), 4); // ≈ 0.214, not 0.5
  });

  it('outline_size scales canvas lineWidth by render/Godot font ratio (#14)', async () => {
    // outline_size 12 default; canvas renders at RENDER_FONT_SIZE 128, Godot
    // font_size default 32 → lineWidth = 12 × (128 / 32) = 48.
    await renderLabel(node({ outline_size: '12' }));
    expect(mockContext.lineWidth).toBeCloseTo(48, 5);
  });

  it('quad height = canvas pixels × pixel_size × worldScale (Godot 32 / render 128)', async () => {
    // One line: canvas.height = RENDER_FONT_SIZE(128) + 2×10 padding = 148;
    // worldScale = 32/128 maps the high-res canvas back to Godot-pixel space so
    // the world size matches Godot's default font_size, not the render one.
    const r = await renderLabel(node({ pixel_size: '0.01' }));
    const geom = r.scene.findByType('Mesh').instance.geometry as unknown as {
      parameters: { height: number };
    };
    expect(geom.parameters.height).toBeCloseTo(148 * 0.01 * (32 / 128), 4); // ≈ 0.37
  });
});

/**
 * Parity: Label3D defaults + sizing vs Godot.
 * - billboard default is DISABLED (was ENABLED → labels wrongly tracked camera).
 * - pixel_size default 0.005; outline_size default 12 (Godot defaults).
 * - quad world size = Godot-font-pixels × pixel_size (worldScale corrects for
 *   the high-res canvas rendered at DEFAULT_FONT_SIZE vs Godot's font_size 16).
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
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) =>
    type === '2d' ? (mockContext as unknown as CanvasRenderingContext2D) : null
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// Label3D text is gated behind showLabels (off by default, ADR-0008).
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

describe('Label3D render parity', () => {
  it('double_sided=false → FrontSide material', async () => {
    const r = await renderLabel(node({ double_sided: 'false' }));
    const mat = r.scene.findByType('Mesh').instance.material as THREE.Material;
    expect(mat.side).toBe(THREE.FrontSide);
  });

  it('quad height = canvas pixels × pixel_size × worldScale (Godot 16 / render 128)', async () => {
    // canvas.height = DEFAULT_FONT_SIZE(128) + 20 = 148; worldScale = 16/128 maps
    // the high-res canvas back to Godot-pixel space so the world size matches
    // Godot's default font_size, not the 128px render resolution.
    const r = await renderLabel(node({ pixel_size: '0.01' }));
    const geom = r.scene.findByType('Mesh').instance.geometry as unknown as {
      parameters: { height: number };
    };
    expect(geom.parameters.height).toBeCloseTo(148 * 0.01 * (16 / 128), 4); // ≈ 0.185
  });
});

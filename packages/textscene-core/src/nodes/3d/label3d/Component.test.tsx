import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Label3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Label3DProperties } from './types';
import { BillboardMode, HorizontalAlignment } from './types';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';

// happy-dom provides HTMLCanvasElement but not a 2D rendering context.
// Stub getContext so Label3D can build its texture in this environment.
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
  const properties: Label3DProperties = {
    name: 'Label',
    text: 'Hello',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_ENABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    ...overrides,
  };
  return { name: properties.name ?? 'Label', type: 'Label3D', children: [], properties };
}

// Label3D text is gated behind the `showLabels` toggle (off by default, ADR-0008),
// so render it inside a provider with labels enabled to assert the text mesh.
function renderLabel(node: TscnNode) {
  return ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowLabels>
      <Label3D node={node} />
    </ViewportModeProvider>
  );
}

describe('<Label3D>', () => {
  it('renders an invisible group (no mesh) when labels are off — the default (ADR-0008)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Label3D node={makeNode()} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('renders a Mesh with a PlaneGeometry when labels are toggled on', async () => {
    const renderer = await renderLabel(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    expect(mesh.instance.geometry.type).toBe('PlaneGeometry');
  });

  it('uses a transparent MeshBasicMaterial', async () => {
    const renderer = await renderLabel(makeNode());
    const mesh = renderer.scene.findByType('Mesh');
    const material = mesh.instance.material as { transparent: boolean; type: string };
    expect(material.transparent).toBe(true);
    expect(material.type).toBe('MeshBasicMaterial');
  });

  it('applies modulate alpha to material opacity', async () => {
    const renderer = await renderLabel(makeNode({ modulate: { r: 1, g: 1, b: 1, a: 0.5 } }));
    const mesh = renderer.scene.findByType('Mesh');
    expect((mesh.instance.material as { opacity: number }).opacity).toBe(0.5);
  });

  it('positions the mesh at transform origin', async () => {
    const renderer = await renderLabel(
      makeNode({
        name: 'Sign',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 2, z: 0 },
        },
      })
    );
    const mesh = renderer.scene.findByProps({ name: 'Sign' });
    expect(mesh.instance.position.y).toBe(2);
  });

  it('scales the plane proportionally to pixel_size', async () => {
    const a = await renderLabel(makeNode({ pixel_size: 0.01 }));
    const b = await renderLabel(makeNode({ pixel_size: 0.02 }));
    const ah = (
      a.scene.findByType('Mesh').instance.geometry as unknown as { parameters: { height: number } }
    ).parameters.height;
    const bh = (
      b.scene.findByType('Mesh').instance.geometry as unknown as { parameters: { height: number } }
    ).parameters.height;
    expect(bh).toBeCloseTo(2 * ah, 5);
  });
});

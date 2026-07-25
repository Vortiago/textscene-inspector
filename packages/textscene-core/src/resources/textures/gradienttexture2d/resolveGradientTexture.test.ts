import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { resolveGradientTexture2D } from './resolveGradientTexture';
import type { TscnInternalResource } from '../../../parser/types';

const coinResources: TscnInternalResource[] = [
  {
    id: 'Gradient_cd1ha',
    type: 'Gradient',
    data: {
      interpolation_mode: '2',
      offsets: 'PackedFloat32Array(0, 0.642276, 1)',
      colors: 'PackedColorArray(1, 1, 1, 1, 1, 1, 1, 0.180392, 1, 1, 1, 0)',
    },
  },
  {
    id: 'GradientTexture2D_qhu5r',
    type: 'GradientTexture2D',
    data: {
      gradient: 'SubResource("Gradient_cd1ha")',
      fill: '1',
      fill_from: 'Vector2(0.5, 0.5)',
      fill_to: 'Vector2(0.5, 0.01)',
    },
  },
];

describe('resolveGradientTexture2D', () => {
  it('rasterises a SubResource(GradientTexture2D) into a DataTexture', () => {
    const texture = resolveGradientTexture2D(
      'SubResource("GradientTexture2D_qhu5r")',
      coinResources
    );
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    expect(texture!.image.width).toBe(64);
  });

  it('returns null for an ExtResource reference (async image path)', () => {
    expect(resolveGradientTexture2D('ExtResource("3")', coinResources)).toBeNull();
  });

  it('returns null for a SubResource of a different type', () => {
    const resources: TscnInternalResource[] = [
      { id: 'CanvasTexture_x', type: 'CanvasTexture', data: {} },
    ];
    expect(resolveGradientTexture2D('SubResource("CanvasTexture_x")', resources)).toBeNull();
  });

  it('returns null when the gradient reference cannot be resolved', () => {
    const resources: TscnInternalResource[] = [
      {
        id: 'GradientTexture2D_orphan',
        type: 'GradientTexture2D',
        data: { gradient: 'SubResource("Missing")', fill: '1' },
      },
    ];
    expect(
      resolveGradientTexture2D('SubResource("GradientTexture2D_orphan")', resources)
    ).toBeNull();
  });

  it('returns null for undefined / malformed references', () => {
    expect(resolveGradientTexture2D(undefined, coinResources)).toBeNull();
    expect(resolveGradientTexture2D('res://foo.png', coinResources)).toBeNull();
  });
});

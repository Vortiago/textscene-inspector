import * as THREE from 'three';
import { float, texture, vec2 } from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { layerScaledRead, scaleLayerReads } from './layerScaledReads';

const layersNode = () =>
  texture(new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1)) as unknown as TextureNode;

describe('layerScaledRead', () => {
  it('scales the read of a texture whose layers scale', () => {
    const node = layersNode();
    const layers: Node[] = [];
    scaleLayerReads(node, (layer) => {
      layers.push(layer);
      return float(2) as unknown as Node;
    });
    const read = node.sample(vec2(0.5) as never) as unknown as Node;
    const layer = float(3) as unknown as Node;

    expect(layerScaledRead(node, read, layer)).not.toBe(read);
    expect(layers).toEqual([layer]);
  });

  it('keeps the read of a texture with no scale (edge case)', () => {
    const node = layersNode();
    const read = node.sample(vec2(0.5) as never) as unknown as Node;

    expect(layerScaledRead(node, read, float(0) as unknown as Node)).toBe(read);
  });
});

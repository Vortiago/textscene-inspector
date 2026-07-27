import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  litQuadRenderOrder,
  litQuadStencilProps,
  ShadowVolumeMask,
  SHADOW_STENCIL_REFS,
  shadowStencilRef,
  shadowVolumeRenderOrder,
} from './ShadowVolumeMask';
import { OCCLUDER_CULL_DISABLED, type ShadowCasterEdges, type ShadowLight } from './shadowVolumes';

const LIGHT: ShadowLight = {
  x: 0,
  y: 0,
  rect: { minX: -512, minY: -512, maxX: 512, maxY: 512 },
};

const CASTER: ShadowCasterEdges = {
  segments: new Float32Array([100, -50, 100, 50]),
  cullMode: OCCLUDER_CULL_DISABLED,
};

async function renderMask(props: Partial<Parameters<typeof ShadowVolumeMask>[0]> = {}) {
  return ReactThreeTestRenderer.create(
    <ShadowVolumeMask light={LIGHT} casters={[CASTER]} ordinal={0} layer={1} {...props} />
  );
}

function maskMesh(renderer: Awaited<ReturnType<typeof renderMask>>) {
  const found = renderer.scene.findAllByType('Mesh');
  return found.length ? (found[0]!.instance as THREE.Mesh) : null;
}

/**
 * The two sides of the seam. `ShadowVolumeMask` stamps and the light's cookie
 * quad tests, so they have to agree on the ref for one light and disagree
 * across lights — that disagreement is the whole reason a shared ref of 1 leaks
 * every earlier light's shadow into every later light.
 */
describe('stencil ref allocation', () => {
  it('never hands out 0, which is the cleared state', () => {
    for (let i = 0; i < SHADOW_STENCIL_REFS * 2; i++) {
      expect(shadowStencilRef(i)).toBeGreaterThan(0);
    }
  });

  it('stays inside the 8-bit stencil range', () => {
    for (let i = 0; i < SHADOW_STENCIL_REFS * 2; i++) {
      expect(shadowStencilRef(i)).toBeLessThanOrEqual(SHADOW_STENCIL_REFS);
    }
  });

  it('gives distinct refs to every light a single pass can hold', () => {
    const refs = new Set<number>();
    for (let i = 0; i < SHADOW_STENCIL_REFS; i++) refs.add(shadowStencilRef(i));
    expect(refs.size).toBe(SHADOW_STENCIL_REFS);
  });

  it('wraps only after the range is exhausted', () => {
    expect(shadowStencilRef(SHADOW_STENCIL_REFS)).toBe(shadowStencilRef(0));
    expect(shadowStencilRef(SHADOW_STENCIL_REFS - 1)).not.toBe(shadowStencilRef(0));
  });

  it('agrees with the lit quad for the same light', () => {
    expect(litQuadStencilProps(7).stencilRef).toBe(shadowStencilRef(7));
  });

  it('disagrees with a neighbouring light, which is what stops the leak', () => {
    expect(litQuadStencilProps(8).stencilRef).not.toBe(shadowStencilRef(7));
  });
});

describe('render order pairing', () => {
  it('draws a light\'s volumes before its own quad', () => {
    expect(shadowVolumeRenderOrder(3)).toBeLessThan(litQuadRenderOrder(3));
  });

  it('finishes a light before the next one starts', () => {
    expect(litQuadRenderOrder(3)).toBeLessThan(shadowVolumeRenderOrder(4));
  });
});

describe('litQuadStencilProps', () => {
  it('rejects the stamped pixels and leaves the buffer alone', () => {
    const props = litQuadStencilProps(2);
    expect(props.stencilWrite).toBe(true);
    expect(props.stencilFunc).toBe(THREE.NotEqualStencilFunc);
    expect(props.stencilFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZFail).toBe(THREE.KeepStencilOp);
    expect(props.stencilZPass).toBe(THREE.KeepStencilOp);
  });
});

describe('<ShadowVolumeMask>', () => {
  it('renders the volumes built for the light', async () => {
    const mesh = maskMesh(await renderMask())!;
    // One casting edge → a 5-gon fanned into 3 triangles → 9 vertices.
    expect(mesh.geometry.getAttribute('position').count).toBe(9);
  });

  it('renders nothing when no occluder casts', async () => {
    expect(maskMesh(await renderMask({ casters: [] }))).toBeNull();
  });

  it('renders nothing when the occluder is outside the light rect', async () => {
    const far: ShadowCasterEdges = {
      segments: new Float32Array([900, -50, 900, 50]),
      cullMode: OCCLUDER_CULL_DISABLED,
    };
    expect(maskMesh(await renderMask({ casters: [far] }))).toBeNull();
  });

  it('stamps its own ref over everything it covers', async () => {
    const material = maskMesh(await renderMask({ ordinal: 4 }))!.material as THREE.Material;
    expect(material.stencilWrite).toBe(true);
    expect(material.stencilRef).toBe(shadowStencilRef(4));
    expect(material.stencilFunc).toBe(THREE.AlwaysStencilFunc);
    expect(material.stencilFail).toBe(THREE.ReplaceStencilOp);
    expect(material.stencilZFail).toBe(THREE.ReplaceStencilOp);
    expect(material.stencilZPass).toBe(THREE.ReplaceStencilOp);
  });

  it('writes no colour and no depth', async () => {
    const material = maskMesh(await renderMask())!.material as THREE.Material;
    expect(material.colorWrite).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.depthTest).toBe(false);
  });

  it('sorts with the additive cookie quads rather than ahead of them', async () => {
    // Opaque would put EVERY light's volumes before ANY light's quad, which no
    // ref assignment can rescue.
    expect((maskMesh(await renderMask())!.material as THREE.Material).transparent).toBe(true);
  });

  it('takes both faces, so polygon winding never decides whether a shadow exists', async () => {
    expect((maskMesh(await renderMask())!.material as THREE.Material).side).toBe(THREE.DoubleSide);
  });

  it('draws immediately before its own light quad', async () => {
    expect(maskMesh(await renderMask({ ordinal: 6 }))!.renderOrder).toBe(shadowVolumeRenderOrder(6));
  });

  it('shares the layer of the light it shadows', async () => {
    expect(maskMesh(await renderMask({ layer: 3 }))!.layers.mask).toBe(1 << 3);
  });

  it('skips frustum culling, since the volumes extend past the light', async () => {
    expect(maskMesh(await renderMask())!.frustumCulled).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { litQuadRenderOrder, litQuadStencilProps, ShadowVolumeMask } from './ShadowVolumeMask';
import { type ShadowCasterEdges, type ShadowLight } from './shadowVolumes';
import { worldEdges } from './testing/worldEdges';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import { OccluderPolygon2DCullMode } from '../../godot/scene/lightOccluder2d';

const LIGHT: ShadowLight = {
  x: 0,
  y: 0,
  rect: { minX: -512, minY: -512, maxX: 512, maxY: 512 },
};

/** The distinct stencil values of one pass: the 8-bit buffer's 1..255, as 0 is the cleared state. */
const SHADOW_STENCIL_REFS = 255;

/** The stencil value light `ordinal`'s cookie quad tests. */
const shadowStencilRef = (ordinal: number) => litQuadStencilProps(ordinal).stencilRef;

const CASTER: ShadowCasterEdges = worldEdges(
  new Float32Array([100, -50, 100, 50]),
  OccluderPolygon2DCullMode.DISABLED
);

async function renderMask(props: Partial<Parameters<typeof ShadowVolumeMask>[0]> = {}) {
  return ReactThreeTestRenderer.create(
    <ShadowVolumeMask light={LIGHT} casters={[CASTER]} ordinal={0} sequence={0} {...props} />
  );
}

function maskMesh(renderer: Awaited<ReturnType<typeof renderMask>>) {
  const found = renderer.scene.findAllByType('Mesh');
  return found.length ? (found[0]!.instance as THREE.Mesh) : null;
}

/**
 * `ShadowVolumeMask` stamps and the cookie quad tests, so they agree on the ref for one light and
 * disagree across lights. A shared ref of 1 leaks every earlier light's shadow into every later one.
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

  it('disagrees with a neighbouring light, which is what stops the leak', () => {
    expect(shadowStencilRef(8)).not.toBe(shadowStencilRef(7));
  });
});

describe('render order pairing', () => {
  it("draws a light's volumes before its own quad", async () => {
    expect(maskMesh(await renderMask({ sequence: 3 }))!.renderOrder).toBeLessThan(litQuadRenderOrder(3));
  });

  it('finishes a light before the next one starts', async () => {
    expect(litQuadRenderOrder(3)).toBeLessThan(maskMesh(await renderMask({ sequence: 4 }))!.renderOrder);
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
    const far: ShadowCasterEdges = worldEdges(
      new Float32Array([900, -50, 900, 50]),
      OccluderPolygon2DCullMode.DISABLED
    );
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
    // Opaque puts every light's volumes before any light's quad, which no ref assignment rescues.
    expect((maskMesh(await renderMask())!.material as THREE.Material).transparent).toBe(true);
  });

  it('takes both faces, so polygon winding never decides whether a shadow exists', async () => {
    expect((maskMesh(await renderMask())!.material as THREE.Material).side).toBe(THREE.DoubleSide);
  });

  it('draws immediately before its own light quad', async () => {
    expect(maskMesh(await renderMask({ sequence: 6 }))!.renderOrder).toBe(litQuadRenderOrder(6) - 1);
  });

  it('takes its ORDER from the sequence and its REF from the ordinal', async () => {
    // The ordinal is dense within a pass for the 8-bit stencil and reused on unmount. The sequence
    // is the light's place in the canvas light list, the order Godot applies lights in. Ordering
    // by the ordinal makes an overlap's colour depend on which cookie loaded first.
    const mesh = maskMesh(await renderMask({ ordinal: 2, sequence: 5 }))!;
    expect(mesh.renderOrder).toBe(litQuadRenderOrder(5) - 1);
    expect((mesh.material as THREE.Material).stencilRef).toBe(shadowStencilRef(2));
  });

  it('draws on the light pass layer alone, which the main render skips', async () => {
    expect(maskMesh(await renderMask())!.layers.mask).toBe(1 << LIGHT_PASS_LAYER);
  });

  it('skips frustum culling, since the volumes extend past the light', async () => {
    expect(maskMesh(await renderMask())!.frustumCulled).toBe(false);
  });
});

/**
 * Only the light's own quads read the stencil its volumes stamp, and they lie inside its rect, so
 * a volume draws under a scissor to that rect. A software rasteriser pays for every pixel it fills.
 */
describe("the scissor around a light's volumes", () => {
  /** A light whose rect is world 10..30 x 10..15, and an occluder inside it. */
  const SMALL_LIGHT: ShadowLight = { x: 15, y: 12, rect: { minX: 10, minY: 10, maxX: 30, maxY: 15 } };
  const INSIDE = worldEdges(new Float32Array([25, 11, 25, 14]), OccluderPolygon2DCullMode.DISABLED);

  /** A 2D view of world x in [0, 100] and y in [0, 50]. */
  function viewCamera(): THREE.OrthographicCamera {
    const view = new THREE.OrthographicCamera(0, 100, 50, 0, -10, 10);
    view.updateMatrixWorld();
    return view;
  }

  /** A 200x100 target whose own scissor is `x, y, width, height`, tested when `isTested`. */
  function scissoredTarget(scissor = [0, 0, 200, 100] as const, isTested = true): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(200, 100);
    target.scissor.fromArray(scissor);
    target.scissorTest = isTested;
    return target;
  }

  /** The scissors the mask sets while it draws into `target`, and after it draws. */
  async function scissorsAround(target = scissoredTarget(undefined, false)) {
    const mesh = maskMesh(await renderMask({ light: SMALL_LIGHT, casters: [INSIDE] }))!;
    const renderer = new THREE.WebGLRenderer();
    vi.spyOn(renderer, 'getRenderTarget').mockReturnValue(target);
    const scissor = vi.spyOn(renderer.state, 'scissor');
    const scissorTest = vi.spyOn(renderer.state, 'setScissorTest');
    const draw = [renderer, new THREE.Scene(), viewCamera(), mesh.geometry, mesh.material, null] as const;
    mesh.onBeforeRender(...draw);
    const during = { scissor: scissor.mock.lastCall![0].clone(), test: scissorTest.mock.lastCall![0] };
    mesh.onAfterRender(...draw);
    const after = { scissor: scissor.mock.lastCall![0].clone(), test: scissorTest.mock.lastCall![0] };
    return { during, after };
  }

  it("confines the volumes to the light's rect, with a pixel or two to spare", async () => {
    // World 10..30 x 10..15 lands on pixels 20..60 x 20..30.
    const { during } = await scissorsAround();
    const [x, y, width, height] = during.scissor.toArray();
    expect(during.test).toBe(true);
    for (const [edge, from, to] of [
      [x, 18, 19],
      [y, 18, 19],
      [x + width, 61, 62],
      [y + height, 31, 32],
    ] as const) {
      expect(edge).toBeGreaterThanOrEqual(from);
      expect(edge).toBeLessThanOrEqual(to);
    }
  });

  it("stays inside the target's own scissor", async () => {
    const { during } = await scissorsAround(scissoredTarget([0, 0, 40, 100]));
    expect(during.scissor.x + during.scissor.z).toBe(40);
  });

  it("is empty when the light's rect misses the target's scissor (edge case)", async () => {
    const { during } = await scissorsAround(scissoredTarget([100, 0, 50, 100]));
    expect(during.scissor.z * during.scissor.w).toBe(0);
  });

  it('gives the target its own scissor back once the volumes have drawn', async () => {
    const { after } = await scissorsAround(scissoredTarget([5, 6, 70, 80], false));
    expect(after.scissor.toArray()).toEqual([5, 6, 70, 80]);
    expect(after.test).toBe(false);
  });
});

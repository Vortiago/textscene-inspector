import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { nextPassRenderOrder, orderByPass } from './passOrder';

function drawOf(material: THREE.Material | THREE.Material[], order: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.renderOrder = order;
  orderByPass(mesh);
  return mesh;
}

const opaque = () => new THREE.MeshBasicMaterial();
const alpha = () => new THREE.MeshBasicMaterial({ transparent: true });

describe('nextPassRenderOrder', () => {
  it('draws the surface at its own order and each later draw after the one before', () => {
    expect(nextPassRenderOrder(0)).toBe(0);
    expect(nextPassRenderOrder(2)).toBeGreaterThan(nextPassRenderOrder(1));
    expect(nextPassRenderOrder(500)).toBeLessThan(0.5);
  });
});

describe('orderByPass', () => {
  it('leaves an opaque draw at the order its owner set', () => {
    expect(drawOf(opaque(), nextPassRenderOrder(2)).renderOrder).toBe(nextPassRenderOrder(2));
  });

  it('draws a later alpha-pass draw before an earlier one', () => {
    const base = drawOf(alpha(), nextPassRenderOrder(0));
    const link = drawOf(alpha(), nextPassRenderOrder(1));
    const overlay = drawOf(alpha(), nextPassRenderOrder(2));
    expect(overlay.renderOrder).toBeLessThan(link.renderOrder);
    expect(link.renderOrder).toBeLessThan(base.renderOrder);
  });

  it('follows the material into the alpha pass between two renders', () => {
    const material = opaque();
    const draw = drawOf(material, nextPassRenderOrder(1));
    material.transparent = true;
    expect(draw.renderOrder).toBe(-nextPassRenderOrder(1));
  });

  it('takes the order its owner sets later', () => {
    const draw = drawOf(alpha(), nextPassRenderOrder(1));
    draw.renderOrder = nextPassRenderOrder(4);
    expect(draw.renderOrder).toBe(-nextPassRenderOrder(4));
  });

  it('reads the pass of the one draw group a draw owns', () => {
    const hidden = new THREE.MeshBasicMaterial({ visible: false, transparent: true });
    expect(drawOf([hidden, opaque()], nextPassRenderOrder(1)).renderOrder).toBe(nextPassRenderOrder(1));
    expect(drawOf([hidden, alpha()], nextPassRenderOrder(1)).renderOrder).toBe(-nextPassRenderOrder(1));
  });

  it('sorts a draw once, however often it is asked', () => {
    const draw = drawOf(alpha(), nextPassRenderOrder(1));
    orderByPass(draw);
    expect(draw.renderOrder).toBe(-nextPassRenderOrder(1));
  });

  it("draws an alpha-pass extra draw after a later surface and that surface's extra draws", () => {
    const laterSurface = drawOf(alpha(), nextPassRenderOrder(0));
    const laterOverlay = drawOf(alpha(), nextPassRenderOrder(1));
    const earlierOverlay = new THREE.Mesh(new THREE.BufferGeometry(), alpha());
    earlierOverlay.renderOrder = nextPassRenderOrder(1);
    orderByPass(earlierOverlay, 1);

    expect(laterOverlay.renderOrder).toBeLessThan(laterSurface.renderOrder);
    expect(earlierOverlay.renderOrder).toBeGreaterThan(laterSurface.renderOrder);
    expect(earlierOverlay.renderOrder).toBeLessThan(0.5);
  });

  it('leaves an opaque extra draw of an earlier surface at its own order', () => {
    const draw = new THREE.Mesh(new THREE.BufferGeometry(), opaque());
    draw.renderOrder = nextPassRenderOrder(1);
    orderByPass(draw, 1);

    expect(draw.renderOrder).toBe(nextPassRenderOrder(1));
  });

  it('draws an alpha-pass surface after a later surface of its priority, and inside that priority', () => {
    const earlier = new THREE.Mesh(new THREE.BufferGeometry(), alpha());
    earlier.renderOrder = 2;
    orderByPass(earlier, 1);

    expect(earlier.renderOrder).toBeGreaterThan(2);
    expect(earlier.renderOrder).toBeLessThan(2.5);
  });

  it('ignores the null a ref gets on release', () => {
    expect(() => orderByPass(null)).not.toThrow();
  });
});

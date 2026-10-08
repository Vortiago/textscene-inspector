import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';
import { FadedMaterials } from './FadedMaterials';
import { FadedSurfacesContext, type FadedSurface } from './swappedMaterials';

/** A mesh whose surface mounts a basic material per pass, coloured by the pass. */
function surfaceMesh(attach?: string) {
  return (
    <mesh>
      <FadedMaterials attach={attach}>
        {(pass, mount) => <meshBasicMaterial attach={mount} color={pass === 'unfaded' ? 'red' : 'blue'} />}
      </FadedMaterials>
    </mesh>
  );
}

async function mount(children: ReactNode) {
  const renderer = await ReactThreeTestRenderer.create(children);
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

function insideDrawer(children: ReactNode, added: FadedSurface[] = []) {
  const surfaces = { add: (surface: FadedSurface) => (added.push(surface), () => {}) };
  return <FadedSurfacesContext.Provider value={surfaces}>{children}</FadedSurfacesContext.Provider>;
}

const colourOf = (material: THREE.Material | THREE.Material[]) =>
  (material as THREE.MeshBasicMaterial).color.getHex();

describe('<FadedMaterials>', () => {
  it('mounts the unfaded material alone outside a GeometryInstance3D drawer', async () => {
    const mesh = await mount(surfaceMesh());
    expect(colourOf(mesh.material)).toBe(0xff0000);
  });

  it('mounts both passes inside a drawer, and the fade swaps them', async () => {
    const added: FadedSurface[] = [];
    const mesh = await mount(insideDrawer(surfaceMesh(), added));
    added[0]!.applyFade(0.5);
    expect(colourOf(mesh.material)).toBe(0x0000ff);
  });

  it('swaps the draw group its attach key names (edge case)', async () => {
    const added: FadedSurface[] = [];
    const mesh = await mount(insideDrawer(surfaceMesh('material-1'), added));
    added[0]!.applyFade(0.5);
    expect(colourOf((mesh.material as THREE.Material[])[1]!)).toBe(0x0000ff);
  });

  it('refuses an attach key that names no material slot (error case)', async () => {
    await expect(mount(insideDrawer(surfaceMesh('geometry')))).rejects.toThrow(
      'expected a material attach key such as material-1, got geometry'
    );
  });
});

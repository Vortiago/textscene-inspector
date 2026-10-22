/** A render of the main view samples at the root viewport's bias, the project setting (`viewport.cpp:5383`). */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { SceneMipmapBias } from './SceneMipmapBias';
import { renderWithMipmapBias } from './godotMipmapBias';
import { withProject } from '../testing/ProjectFixture';
import { fireSceneRender } from '../testing/fireSceneRender';
import { mipmapBiasUniform } from '../testing/mipmapBiasUniform';

async function mainViewIn(project: string | null) {
  const ProjectFixture = withProject(project);
  const renderer = await ReactThreeTestRenderer.create(
    <ProjectFixture>
      <SceneMipmapBias />
    </ProjectFixture>
  );
  const scene = renderer.scene.instance as unknown as THREE.Scene;
  return { renderer, render: () => fireSceneRender(scene, new THREE.PerspectiveCamera()) };
}

describe('<SceneMipmapBias>', () => {
  it('renders the main view at the project bias', async () => {
    const { render } = await mainViewIn('[rendering]\n\ntextures/default_filters/texture_mipmap_bias=-0.5\n');

    await waitFor(() => {
      render();
      expect(mipmapBiasUniform().value).toBe(-0.5);
    });
  });

  it('renders the main view at 0 with no project', async () => {
    const { render } = await mainViewIn(null);

    render();

    expect(mipmapBiasUniform().value).toBe(0);
  });

  it('leaves a pass its own bias when the pass renders the main scene (an inline SubViewport)', async () => {
    const { render } = await mainViewIn(null);

    renderWithMipmapBias(1.25, () => {
      render();
      expect(mipmapBiasUniform().value).toBe(1.25);
    });
  });

  it('stops writing on unmount', async () => {
    const { renderer, render } = await mainViewIn(null);
    await renderer.unmount();
    renderWithMipmapBias(0.75, () => undefined);

    render();

    expect(mipmapBiasUniform().value).toBe(0);
  });
});

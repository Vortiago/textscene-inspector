/** The 2D canvas clears to the project clear colour (`renderer_viewport.cpp:371,751`). */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { waitFor } from '@testing-library/react';
import { FileEventBus } from '../../../resources/FileEventBus';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { PROJECT_FILE_PATH } from '../../../godot/project.js';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import { ProjectClearColor } from './ProjectClearColor';

/** Hands out the canvas's renderer, which the test renderer does not expose. */
function CaptureRenderer({ captured }: { captured: { current: THREE.WebGLRenderer | null } }) {
  captured.current = useThree((state) => state.gl);
  return null;
}

/** The renderer under a project whose `project.godot` is `project`, or no project for null. */
async function rendererIn(project: string | null) {
  const provider: ResourceProvider = {
    async loadResource(path: string) {
      if (path !== PROJECT_FILE_PATH || project === null) throw new Error(`Resource not found: ${path}`);
      return project;
    },
  };
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={loader}>
      <ProjectSettingsProvider>
        <ProjectClearColor />
        <CaptureRenderer captured={captured} />
      </ProjectSettingsProvider>
    </ResourceLoaderProvider>
  );
  return { renderer, gl: captured.current! };
}

const clearStyle = (gl: THREE.WebGLRenderer) =>
  gl.getClearColor(new THREE.Color()).getStyle(THREE.SRGBColorSpace);

describe('<ProjectClearColor>', () => {
  it("clears to Godot's default sRGB 0.3 grey, opaque, with no project", async () => {
    const { gl } = await rendererIn(null);
    expect(clearStyle(gl)).toBe('rgb(77,77,77)');
    expect(gl.getClearAlpha()).toBe(1);
  });

  it("clears to the project's own clear colour", async () => {
    const { gl } = await rendererIn(
      '[rendering]\n\nenvironment/defaults/default_clear_color=Color(1, 0, 0, 1)\n'
    );
    await waitFor(() => expect(clearStyle(gl)).toBe('rgb(255,0,0)'));
  });

  it('clears to transparent under a transparent root', async () => {
    const { gl } = await rendererIn('[rendering]\n\nviewport/transparent_background=true\n');
    await waitFor(() => expect(gl.getClearAlpha()).toBe(0));
  });

  it("restores the renderer's clear on unmount", async () => {
    const { renderer, gl } = await rendererIn(null);
    await renderer.unmount();
    expect(gl.getClearAlpha()).toBe(0);
  });
});

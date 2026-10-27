/**
 * The decal holder tells its scene's decals how to sample the atlas: the project's decal filter,
 * and for an anisotropic one the taps of the viewport's level.
 */

import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { ProjectSettings } from '../../parser/projectSettingsParser';
import { useSceneDecals } from './useSceneDecals';

const filters = vi.hoisted(() => [] as { minFilter: number; anisotropy: number }[]);
const projectSettings = vi.hoisted(() => ({ current: null as ProjectSettings | null }));

vi.mock('./sceneDecals', () => ({
  SceneDecals: class {
    setFilter(filter: { minFilter: number; anisotropy: number }): void {
      filters.push(filter);
    }
    dispose(): void {}
  },
}));

vi.mock('../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: projectSettings.current }),
}));

function Holder() {
  useSceneDecals();
  return null;
}

/** The filter the scene's decals were last given, with the project `settings`. */
async function filterGiven(settings: ProjectSettings | null) {
  projectSettings.current = settings;
  filters.length = 0;
  const renderer = await ReactThreeTestRenderer.create(<Holder />);
  await renderer.unmount();
  return filters.at(-1);
}

describe('useSceneDecals', () => {
  it("gives the decals Godot's default filter with no project", async () => {
    expect(await filterGiven(null)).toMatchObject({ minFilter: THREE.LinearMipmapLinearFilter });
  });

  it("gives the decals the project's decal filter", async () => {
    expect(await filterGiven({ 'rendering/textures/decals/filter': '0' })).toMatchObject({
      minFilter: THREE.NearestFilter,
    });
  });

  it("gives an anisotropic filter the taps of the project's level", async () => {
    const settings = {
      'rendering/textures/decals/filter': '5',
      'rendering/textures/default_filters/anisotropic_filtering_level': '3',
    };

    expect(await filterGiven(settings)).toMatchObject({ anisotropy: 8 });
  });
});

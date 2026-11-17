/**
 * A Light3D with `editor_only` lights the editor's views and gives no light where the game runs
 * (`scene/3d/light_3d.cpp:287-288`). three.js gathers no light it does not see.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalLight3D } from '../directionallight3d/Component';
import { OmniLight3D } from '../omnilight3d/Component';
import { SpotLight3D } from '../spotlight3d/Component';
import { AreaLight3D } from '../arealight3d/Component';
import { RunningGameScope } from '../../../../r3f/contexts/EditorHintContext';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { heading } from '../../../../parser/testing/parserKit';
import type { NodeComponent } from '../../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../../parser/types';
import '../../../../parser/TscnParser';

const LIGHTS: [string, NodeComponent, string][] = [
  ['DirectionalLight3D', DirectionalLight3D, 'DirectionalLight'],
  ['OmniLight3D', OmniLight3D, 'PointLight'],
  ['SpotLight3D', SpotLight3D, 'SpotLight'],
  ['AreaLight3D', AreaLight3D, 'RectAreaLight'],
];

function editorOnlyLight(type: string): TscnNode {
  const properties = nodeRegistry.getRegistration(type)!.parser(heading(type, { name: 'Light' }), {
    editor_only: 'true',
  });
  return { rawProperties: {}, name: 'Light', type, children: [], properties };
}

async function threeLight(
  Light: NodeComponent,
  type: string,
  threeType: string,
  around: (light: ReactNode) => ReactNode
) {
  const renderer = await ReactThreeTestRenderer.create(around(<Light node={editorOnlyLight(type)} />));
  return renderer.scene.findByType(threeType).instance as THREE.Light;
}

describe('a Light3D with editor_only', () => {
  it.each(LIGHTS)('%s gives no light where the game runs', async (type, Light, threeType) => {
    const inGame = (light: ReactNode) => <RunningGameScope>{light}</RunningGameScope>;
    expect((await threeLight(Light, type, threeType, inGame)).visible).toBe(false);
  });

  it.each(LIGHTS)('%s lights the editor', async (type, Light, threeType) => {
    expect((await threeLight(Light, type, threeType, (light) => light)).visible).toBe(true);
  });
});

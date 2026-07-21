/**
 * <WorldEnvironment> — applies the scene's background color and fog
 * declaratively. Resolves an Environment SubResource synchronously from
 * SceneResourcesContext; post-processing (adjustments, SSR) is deferred
 * per PRD MVS scope.
 *
 * WorldEnvironment does not render visible geometry — it mutates
 * scene.background and scene.fog via R3F's `attach`. Children, if any,
 * are still rendered so the node remains part of the scene tree.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { findSubResource, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { godotColorToLinear } from '../../../r3f/godotColor';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { parseEnvironment } from '../../../resources/environment/parser';
import { BackgroundMode } from '../../../resources/environment/types';
import { createEnvironmentSettings } from '../../../resources/environment/renderer';
import { applyToneMapping } from '../../../resources/environment/toneMapping';
import type { EnvironmentSettings } from '../../../resources/environment/renderer';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const { internalResources } = useSceneResources();

  const settings = useMemo(
    () => resolveEnvironment(properties.environment, internalResources),
    [properties.environment, internalResources]
  );

  return (
    <group name={node.name}>
      {settings && <EnvironmentApplier settings={settings} />}
      {settings?.ambient && (
        <ambientLight
          color={godotColorToLinear(settings.ambient.color)}
          intensity={settings.ambient.energy}
        />
      )}
      {children}
    </group>
  );
}

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
}

function EnvironmentApplier({ settings }: EnvironmentApplierProps) {
  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);

  const mode = settings.background.mode;
  const showBackgroundColor =
    mode === BackgroundMode.BG_COLOR || mode === BackgroundMode.BG_CLEAR_COLOR;

  useEffect(() => {
    const previousBackground = scene.background;
    if (showBackgroundColor) {
      // Godot Color literals are sRGB; convert to three.js's linear working space.
      scene.background = godotColorToLinear(settings.background.color);
    } else if (mode === BackgroundMode.BG_SKY) {
      // Full sky/IBL rendering is out of MVS scope; we fall back to a
      // mid-blue solid so the scene still has a visible background and
      // downstream code (and tests) can rely on scene.background being
      // non-null whenever SKY mode is requested.
      scene.background = godotColorToLinear({ r: 0.5, g: 0.6, b: 0.75 });
    }
    return () => {
      scene.background = previousBackground;
    };
  }, [scene, showBackgroundColor, mode, settings.background.color]);

  const { mode: toneMapMode, exposure: toneMapExposure } = settings.toneMapping;
  useEffect(
    () => applyToneMapping(gl, { mode: toneMapMode, exposure: toneMapExposure }, scene),
    [gl, scene, toneMapMode, toneMapExposure]
  );

  const fog = settings.fog;
  useEffect(() => {
    const previousFog = scene.fog;
    if (fog) {
      // Godot screen-space fog → exponential-squared fog (closest THREE match);
      // DEPTH mode (1) is approximated with the same density-based fog.
      scene.fog = new THREE.FogExp2(godotColorToLinear(fog.color).getHex(), fog.density);
    }
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, fog]);

  return null;
}

function resolveEnvironment(
  environmentRef: string | undefined,
  internalResources: ReturnType<typeof useSceneResources>['internalResources']
): EnvironmentSettings | null {
  if (!environmentRef) return null;
  const parsed = parseResourceReference(environmentRef);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'Environment') return null;
  const envProps = parseEnvironment(resource.data as Record<string, string>);
  return createEnvironmentSettings(envProps);
}

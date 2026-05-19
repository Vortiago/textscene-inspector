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
import type { WorldEnvironmentProperties } from '../../../nodes/3d/worldenvironment/types';
import type { NodeComponentProps } from '../../NodeComponentRegistry';
import { findSubResource, useSceneResources } from '../../SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { parseEnvironment } from '../../../resources/environment/parser';
import { BackgroundMode } from '../../../resources/environment/types';
import { createEnvironmentSettings } from '../../../resources/environment/renderer';
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
      {children}
    </group>
  );
}

interface EnvironmentApplierProps {
  settings: EnvironmentSettings;
}

function EnvironmentApplier({ settings }: EnvironmentApplierProps) {
  const scene = useThree((state) => state.scene);

  const showBackgroundColor =
    settings.background.mode === BackgroundMode.BG_COLOR ||
    settings.background.mode === BackgroundMode.BG_CLEAR_COLOR;

  useEffect(() => {
    const previousBackground = scene.background;
    if (showBackgroundColor) {
      const c = settings.background.color;
      scene.background = new THREE.Color(c.r, c.g, c.b);
    }
    return () => {
      scene.background = previousBackground;
    };
  }, [scene, showBackgroundColor, settings.background.color]);

  const fog = settings.fog;
  useEffect(() => {
    const previousFog = scene.fog;
    if (fog) {
      const c = fog.albedo;
      scene.fog = new THREE.FogExp2(new THREE.Color(c.r, c.g, c.b).getHex(), fog.density);
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

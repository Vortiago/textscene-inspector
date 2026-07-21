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
import { resolveSky } from '../../../resources/sky/parser';
import type { SkyProperties } from '../../../resources/sky/types';
import { SkyLayer } from '../../../r3f/sky/SkyLayer';
import type { EnvironmentSettings } from '../../../resources/environment/renderer';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  const { internalResources } = useSceneResources();

  const resolved = useMemo(
    () => resolveEnvironment(properties.environment, internalResources),
    [properties.environment, internalResources]
  );
  const settings = resolved?.settings ?? null;
  const sky = resolved?.sky ?? null;

  // Godot draws the sky as the background under BG_SKY, and takes ambient from
  // it whenever the source resolves to a cubemap — the two are independent,
  // so a sky can light the scene without being shown, and vice versa.
  const showsSky = settings?.background.mode === BackgroundMode.BG_SKY;
  const skyAmbient = settings?.skyAmbient ?? null;

  return (
    <group name={node.name}>
      {settings && <EnvironmentApplier settings={settings} hasSky={!!sky} />}
      {sky && (showsSky || skyAmbient) && (
        <SkyLayer
          sky={sky}
          asBackground={showsSky}
          intensity={skyAmbient ? skyAmbient.energy * skyAmbient.contribution : 0}
        />
      )}
      {settings?.ambient && settings.ambient.energy > 0 && (
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
  /** When a real sky renders, it owns the background and this must not fight it. */
  hasSky: boolean;
}

function EnvironmentApplier({ settings, hasSky }: EnvironmentApplierProps) {
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
    } else if (mode === BackgroundMode.BG_SKY && !hasSky) {
      // A sky we cannot resolve — an unsupported material, or one held in an
      // ExtResource `.tres`. A mid-blue solid keeps the background non-null so
      // the scene still reads as "sky here" rather than as a black void.
      scene.background = godotColorToLinear({ r: 0.5, g: 0.6, b: 0.75 });
    }
    return () => {
      scene.background = previousBackground;
    };
  }, [scene, showBackgroundColor, mode, settings.background.color, hasSky]);

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
): { settings: EnvironmentSettings; sky: SkyProperties | null } | null {
  if (!environmentRef) return null;
  const parsed = parseResourceReference(environmentRef);
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'Environment') return null;
  const envProps = parseEnvironment(resource.data as Record<string, string>);
  return {
    settings: createEnvironmentSettings(envProps),
    sky: resolveSky(envProps.sky, internalResources),
  };
}

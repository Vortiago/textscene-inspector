import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import {
  projectDepthPrepassDisabledVendors,
  projectDrawsDepthPrepass,
  projectRenderingMethod,
} from '../../parser/projectSettingsParser';
import { createSceneDepthPrepass } from './depthPrepass';

/** Draws `scene`'s depth prepass before each of its opaque passes, until unmount. Null draws none. */
export function useSceneDepthPrepass(scene: THREE.Scene | null): void {
  const { settings } = useProjectSettings();
  const isDrawn = useMemo(() => projectDrawsDepthPrepass(settings), [settings]);
  const renderingMethod = projectRenderingMethod(settings);
  const disabledVendors = projectDepthPrepassDisabledVendors(settings);
  useEffect(() => {
    if (!scene || !isDrawn) return undefined;
    const prepass = createSceneDepthPrepass({ renderingMethod, disabledVendors });
    scene.add(prepass.first, prepass.last);
    return () => {
      scene.remove(prepass.first, prepass.last);
      prepass.dispose();
    };
  }, [scene, isDrawn, renderingMethod, disabledVendors]);
}

/** Mounted once per canvas, for the canvas's own scene. */
export function SceneDepthPrepass() {
  useSceneDepthPrepass(useThree((state) => state.scene));
  return null;
}

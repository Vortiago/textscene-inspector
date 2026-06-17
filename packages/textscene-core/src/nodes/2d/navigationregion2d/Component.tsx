/**
 * <NavigationRegion2D> — draws its NavigationPolygon as a translucent debug
 * overlay (filled green region + edge lines) in the 2D workspace, mirroring
 * Godot's editor navigation visualization. Positions are raw Godot 2D pixel
 * coords; the Node2D wrapper applies the +Y-down → three conjugation. Gated on
 * the `showNavigation` viewport toggle (on by default).
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import type { ParsedTresFile } from '../../../parser/tresParser';
import { parsePackedVector2Array, parsePackedInt32Arrays } from '../../../resources/shapes/packedArray';
import {
  buildNavFaceGeometry,
  buildNavEdgeGeometry,
  vector2ToPositions,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import type { NavigationRegion2DProperties } from './types';

export function NavigationRegion2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion2DProperties;
  const { externalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  const resolvedPath = properties.navigationPolygon
    ? resolveExtResourcePath(properties.navigationPolygon, externalResources)
    : null;
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const result = useResource<ParsedTresFile>(tresPath ?? '', 'Resource');

  const overlay = useMemo(() => {
    const props = result.value?.properties;
    if (!props || !props['vertices'] || !props['polygons']) return null;
    const positions = vector2ToPositions(parsePackedVector2Array(props['vertices']));
    const polygons = parsePackedInt32Arrays(props['polygons']);
    if (positions.length === 0 || polygons.length === 0) return null;
    return {
      faces: buildNavFaceGeometry(positions, polygons),
      edges: buildNavEdgeGeometry(positions, polygons),
    };
  }, [result.value]);

  // Per-component geometries (not cached); R3F won't auto-dispose geometry
  // passed via attach. Dispose on rebuild / unmount to avoid GPU leaks.
  useEffect(() => {
    if (!overlay) return;
    return () => {
      overlay.faces.dispose();
      overlay.edges.dispose();
    };
  }, [overlay]);

  return (
    <Node2D node={node}>
      {showNavigation && overlay && (
        <>
          <mesh renderOrder={1}>
            <primitive object={overlay.faces} attach="geometry" />
            <meshBasicMaterial
              color={NAV_OVERLAY_COLOR}
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments renderOrder={2}>
            <primitive object={overlay.edges} attach="geometry" />
            <lineBasicMaterial color={NAV_OVERLAY_COLOR} transparent opacity={0.9} depthWrite={false} />
          </lineSegments>
        </>
      )}
      {children}
    </Node2D>
  );
}

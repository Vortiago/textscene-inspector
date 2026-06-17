/**
 * <NavigationRegion3D> — draws its NavigationMesh as a translucent debug
 * overlay (filled green faces + edge lines), mirroring Godot's editor
 * "Visible Navigation". This is NOT solid scene geometry: it's unlit,
 * transparent, double-sided, and doesn't write depth. Gated on the
 * `showNavigation` viewport toggle (on by default). Children (e.g. the level
 * MeshInstance3D) render normally inside the Node3D transform.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import type { ParsedTresFile } from '../../../parser/tresParser';
import { parsePackedVector3Array, parsePackedInt32Arrays } from '../../../resources/shapes/packedArray';
import {
  buildNavFaceGeometry,
  buildNavEdgeGeometry,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import type { NavigationRegion3DProperties } from './types';

export function NavigationRegion3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion3DProperties;
  const { externalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  const resolvedPath = properties.navigationMesh
    ? resolveExtResourcePath(properties.navigationMesh, externalResources)
    : null;
  const tresPath = resolvedPath?.endsWith('.tres') ? resolvedPath : null;
  const result = useResource<ParsedTresFile>(tresPath ?? '', 'Resource');

  const overlay = useMemo(() => {
    const props = result.value?.properties;
    if (!props || !props['vertices'] || !props['polygons']) return null;
    const positions = parsePackedVector3Array(props['vertices']);
    const polygons = parsePackedInt32Arrays(props['polygons']);
    if (positions.length === 0 || polygons.length === 0) return null;
    return {
      faces: buildNavFaceGeometry(positions, polygons),
      edges: buildNavEdgeGeometry(positions, polygons),
    };
  }, [result.value]);

  // These geometries are built per-component (not cached), and R3F does not
  // auto-dispose geometry passed via the `geometry`/`primitive` attach. Dispose
  // them when the overlay is rebuilt (resource reload) or the node unmounts.
  useEffect(() => {
    if (!overlay) return;
    return () => {
      overlay.faces.dispose();
      overlay.edges.dispose();
    };
  }, [overlay]);

  return (
    <Node3D node={node}>
      {showNavigation && overlay && (
        <>
          <mesh renderOrder={1}>
            <primitive object={overlay.faces} attach="geometry" />
            <meshBasicMaterial
              color={NAV_OVERLAY_COLOR}
              transparent
              opacity={0.38}
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
    </Node3D>
  );
}

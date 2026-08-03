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
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { decodeNavigationMesh } from '../../../resources/navigation/navigationmesh';
import {
  buildNavFaceGeometry,
  buildNavEdgeGeometry,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import type { NavigationRegion3DProperties } from './types';

export function NavigationRegion3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion3DProperties;
  const { externalResources, internalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  // A NavigationMesh is as often an inline `[sub_resource]` as a `.tres`;
  // resolving only one form drew no navmesh for the other.
  const resource = useSubOrExtResource(
    properties.navigationMesh,
    internalResources,
    externalResources
  );

  const overlay = useMemo(() => {
    const navmesh = resource ? decodeNavigationMesh(resource.data) : null;
    if (!navmesh) return null;
    // Godot 3D space matches three.js, so the vertices are positions already.
    return {
      faces: buildNavFaceGeometry(navmesh.vertices, navmesh.polygons),
      edges: buildNavEdgeGeometry(navmesh.vertices, navmesh.polygons),
    };
  }, [resource]);

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

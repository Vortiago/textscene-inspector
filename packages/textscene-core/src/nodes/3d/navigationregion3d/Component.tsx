/**
 * Draws a NavigationRegion3D's NavigationMesh as Godot's editor "Visible
 * Navigation" overlay: green faces and edge lines, unlit, transparent,
 * double-sided and without depth writes. The `showNavigation` viewport toggle
 * gates it. Children render normally inside the Node3D transform.
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
  NAV_EDGES_MATERIAL,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import type { NavigationRegion3DProperties } from './types';

/** Literal-only, so the key is constant and the overlay never remounts. */
const NAV_FACES_MATERIAL = materialProgramInputs({
  props: {
    color: NAV_OVERLAY_COLOR,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  },
});

export function NavigationRegion3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion3DProperties;
  const { externalResources, internalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  // A NavigationMesh is as often an inline `[sub_resource]` as a `.tres`.
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

  // R3F never disposes geometry passed through the `geometry` or `primitive` attach, and
  // these are built per component, so dispose them on a rebuild or an unmount.
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
            <meshBasicMaterial key={NAV_FACES_MATERIAL.key} {...NAV_FACES_MATERIAL.props} />
          </mesh>
          <lineSegments renderOrder={2}>
            <primitive object={overlay.edges} attach="geometry" />
            <lineBasicMaterial key={NAV_EDGES_MATERIAL.key} {...NAV_EDGES_MATERIAL.props} />
          </lineSegments>
        </>
      )}
      {children}
    </Node3D>
  );
}

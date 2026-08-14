/**
 * <NavigationRegion2D> — draws its NavigationPolygon as a translucent debug
 * overlay (filled green region + edge lines) in the 2D workspace, mirroring
 * Godot's editor navigation visualization. Positions are raw Godot 2D pixel
 * coords; the Node2D wrapper applies the +Y-down → three conjugation. Gated on
 * the `showNavigation` viewport toggle (on by default).
 */

import { useEffect, useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { decodeNavigationPolygon } from '../../../resources/navigation/navigationpolygon';
import {
  buildNavFaceGeometry,
  buildNavEdgeGeometry,
  vector2ToPositions,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import type { NavigationRegion2DProperties } from './types';

export function NavigationRegion2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion2DProperties;
  const { externalResources, internalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  // A NavigationPolygon is as often an inline `[sub_resource]` as a `.tres`;
  // resolving only one form drew no navmesh for the other.
  const resource = useSubOrExtResource(
    properties.navigationPolygon,
    internalResources,
    externalResources
  );

  const overlay = useMemo(() => {
    const polygon = resource ? decodeNavigationPolygon(resource.data) : null;
    if (!polygon) return null;
    // Godot 2D vertices are +Y down; the lift to 3D positions negates Y.
    const positions = vector2ToPositions(polygon.vertices);
    return {
      faces: buildNavFaceGeometry(positions, polygon.polygons),
      edges: buildNavEdgeGeometry(positions, polygon.polygons),
    };
  }, [resource]);

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
              {...canvasItemFacing()}
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

/**
 * Draws a NavigationRegion2D's NavigationPolygon as a translucent debug overlay,
 * as Godot's editor does, behind the `showNavigation` toggle (on by default).
 * Positions are raw Godot 2D pixels: the Node2D wrapper converts from +Y-down.
 */

import { useEffect, useMemo } from 'react';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useSubOrExtResource } from '../../../resources/useSubOrExtResource';
import { useViewportMode } from '../../../r3f/contexts/ViewportModeContext';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { decodeNavigationPolygon } from '../../../resources/navigation/navigationpolygon';
import {
  buildNavFaceGeometry,
  buildNavEdgeGeometry,
  vector2ToPositions,
  NAV_EDGES_MATERIAL,
  NAV_OVERLAY_COLOR,
} from '../../../r3f/navigationOverlay';
import type { NavigationRegion2DProperties } from './types';

/** Literal-only, so the key is constant and the overlay never remounts. */
const NAV_FACES_MATERIAL = materialProgramInputs({
  props: { color: NAV_OVERLAY_COLOR, transparent: true, opacity: 0.35, depthWrite: false },
  merge: [canvasItemFacing()],
});

export function NavigationRegion2D({ node, children }: NodeComponentProps) {
  const properties = node.properties as NavigationRegion2DProperties;
  const { externalResources, internalResources } = useSceneResources();
  const { showNavigation } = useViewportMode();

  // A NavigationPolygon is as often an inline `[sub_resource]` as a `.tres`, so
  // both forms resolve.
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

  // R3F does not dispose a geometry passed through `attach`, and these are per
  // component, so dispose them on rebuild and unmount.
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
            <meshBasicMaterial key={NAV_FACES_MATERIAL.key} {...NAV_FACES_MATERIAL.props} />
          </mesh>
          <lineSegments renderOrder={2}>
            <primitive object={overlay.edges} attach="geometry" />
            <lineBasicMaterial key={NAV_EDGES_MATERIAL.key} {...NAV_EDGES_MATERIAL.props} />
          </lineSegments>
        </>
      )}
      {children}
    </Node2D>
  );
}

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGPolygon3D } from './Component';
import { csgPolygon3DGeometry, csgPolygon3DGeometryKey } from './csgGeometry';
import { resolveCsgPolygonPaths } from './csgPolygonPaths';

nodeComponentRegistry.register({
  typeName: 'CSGPolygon3D',
  Component: CSGPolygon3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgPolygon3DGeometry, geometryKey: csgPolygon3DGeometryKey },
  // `path_node` names a Path3D the component cannot reach; resolved over the
  // whole tree once the transform passes have placed it.
  scenePass: { stage: 'paths', run: resolveCsgPolygonPaths },
});

export { CSGPolygon3D };

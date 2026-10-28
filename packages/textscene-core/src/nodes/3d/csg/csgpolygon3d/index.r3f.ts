import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGPolygon3D } from './Component';
import { csgPolygon3DGeometry, csgPolygon3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGPolygon3D',
  Component: CSGPolygon3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgPolygon3DGeometry, geometryKey: csgPolygon3DGeometryKey },
  // `path_node` names a Path3D the component cannot reach; resolved over the Live scene
  // tree once the RemoteTransform pass has placed it.
  scenePass: true,
});

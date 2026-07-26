import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGPolygon3D } from './Component';
import { csgPolygon3DGeometry, csgPolygon3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGPolygon3D',
  Component: CSGPolygon3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgPolygon3DGeometry, geometryKey: csgPolygon3DGeometryKey },
});

export { CSGPolygon3D };

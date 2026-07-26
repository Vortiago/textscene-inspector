import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGSphere3D } from './Component';
import { csgSphere3DGeometry, csgSphere3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGSphere3D',
  Component: CSGSphere3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgSphere3DGeometry, geometryKey: csgSphere3DGeometryKey },
});

export { CSGSphere3D };

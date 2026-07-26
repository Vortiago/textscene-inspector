import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGMesh3D } from './Component';
import { csgMesh3DGeometry, csgMesh3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGMesh3D',
  Component: CSGMesh3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgMesh3DGeometry, geometryKey: csgMesh3DGeometryKey },
});

export { CSGMesh3D };

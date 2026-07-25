import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGBox3D } from './Component';
import { csgBox3DGeometry, csgBox3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGBox3D',
  Component: CSGBox3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgBox3DGeometry, geometryKey: csgBox3DGeometryKey },
});

export { CSGBox3D };

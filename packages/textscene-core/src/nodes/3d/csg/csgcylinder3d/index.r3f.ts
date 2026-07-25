import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGCylinder3D } from './Component';
import { csgCylinder3DGeometry, csgCylinder3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGCylinder3D',
  Component: CSGCylinder3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgCylinder3DGeometry, geometryKey: csgCylinder3DGeometryKey },
});

export { CSGCylinder3D };

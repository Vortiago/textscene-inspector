import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGTorus3D } from './Component';
import { csgTorus3DGeometry, csgTorus3DGeometryKey } from './csgGeometry';

nodeComponentRegistry.register({
  typeName: 'CSGTorus3D',
  Component: CSGTorus3D,
  // Exposes the solid as data so the boolean evaluator can consume triangles.
  csgShape: { geometry: csgTorus3DGeometry, geometryKey: csgTorus3DGeometryKey },
});

export { CSGTorus3D };

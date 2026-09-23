import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { CSGCombiner3D } from './Component';

nodeComponentRegistry.register({
  typeName: 'CSGCombiner3D',
  Component: CSGCombiner3D,
  // `geometry: null` on purpose: a combiner contributes no solid of its own, and its shape is
  // the boolean fold of its CSG children.
  csgShape: { geometry: null },
});

export { CSGCombiner3D };

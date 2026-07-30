/**
 * FlowContainer registration — parser.
 *
 * A Control renders through the 2D DOM overlay (ADR-0003), which this node
 * does not draw into yet (status: unimplemented) — it registers no render
 * component (ADR-0008), so the r3f tree falls back to the invisible
 * transform-only group while still parsing and validating every property.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../../../2d/ui/control/parser';

const flowContainerRegistration: NodeTypeRegistration = {
  typeName: 'FlowContainer',
  parser: parseControl,
};

nodeRegistry.register(flowContainerRegistration);

export { flowContainerRegistration };

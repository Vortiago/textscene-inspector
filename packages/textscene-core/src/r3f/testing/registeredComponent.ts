/**
 * The component the registry mounts for a type, as the dispatcher mounts it. A component test
 * renders its node through this, so a GeometryInstance3D drawer runs inside its place in the scene
 * cull. Test-only: the build excludes the `testing/` directories under `src`.
 */
import { nodeComponentRegistry, type NodeComponent } from '../NodeComponentRegistry';

export function registeredComponent(typeName: string): NodeComponent {
  const Component = nodeComponentRegistry.get(typeName);
  if (!Component) throw new Error(`expected a component registered for ${typeName}, got none`);
  return Component;
}

/**
 * <WorldEnvironment> applies the scene's Environment: background, sky, ambient, tonemapping, fog,
 * glow and the colour adjustments, but not SSR. `useResolvedEnvironment` follows the reference
 * chain, and the node publishes the result to its world's scope, which applies the first valid
 * Environment (ADR-0025). The node publishes its CameraAttributes too, whose exposure the first
 * valid one sets for the world, apart from the Environment. The node draws no geometry, and its
 * children still render.
 */

import type { WorldEnvironmentProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { usePublishEnvironment } from '../../../r3f/environment/WorldEnvironmentScope';
import { usePublishCameraAttributes } from '../../../r3f/environment/worldExposure';
import { useResolvedCameraAttributes } from '../../../r3f/environment/useResolvedCameraAttributes';
import { useResolvedEnvironment } from './useResolvedEnvironment';

export function WorldEnvironment({ node, children }: NodeComponentProps) {
  const properties = node.properties as WorldEnvironmentProperties;
  usePublishEnvironment(useResolvedEnvironment(properties.environment));
  usePublishCameraAttributes(useResolvedCameraAttributes(properties.camera_attributes));
  return <group name={node.name}>{children}</group>;
}

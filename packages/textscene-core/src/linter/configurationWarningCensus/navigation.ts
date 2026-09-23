/**
 * Navigation agents, links, obstacles and regions. The obstacle rows are transform-shaped (negative, zero or non-uniform
 * global scale, and rotation off the Y axis), so they carry rules of their own, not a shared "needs a resource" check.
 */
import type { WarningRow } from './types.js';

export const navigationWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  NavigationAgent2D: [
    {
      at: 'navigation_agent_2d.cpp:726',
      says: 'can be used only under a Node2D-inheriting parent',
      verdict: { rule: 'navigationagent2d-parent-not-node2d' },
    },
  ],

  NavigationAgent3D: [
    {
      at: 'navigation_agent_3d.cpp:793',
      says: 'can be used only under a Node3D-inheriting parent',
      verdict: { rule: 'navigationagent3d-parent-not-node3d' },
    },
  ],

  NavigationLink2D: [
    {
      at: 'navigation_link_2d.cpp:335',
      says: 'start position should differ from the end position to be useful',
      verdict: { rule: 'navigationlink2d-coincident-endpoints' },
    },
  ],

  NavigationLink3D: [
    {
      at: 'navigation_link_3d.cpp:498',
      says: 'start position should differ from the end position to be useful',
      verdict: { rule: 'navigationlink3d-start-position-equals-end-position' },
    },
  ],

  NavigationObstacle2D: [
    {
      at: 'navigation_obstacle_2d.cpp:333',
      says: 'does not support negative or zero global scaling',
      verdict: { rule: 'navigationobstacle2d-non-positive-global-scale' },
    },
    {
      at: 'navigation_obstacle_2d.cpp:337',
      says: 'agent radius can only be scaled uniformly',
      verdict: { rule: 'navigationobstacle2d-non-uniform-global-scale' },
    },
    {
      at: 'navigation_obstacle_2d.cpp:341',
      says: 'skew has no effect on the agent radius',
      verdict: { rule: 'navigationobstacle2d-global-skew-ignored' },
    },
  ],

  NavigationObstacle3D: [
    {
      at: 'navigation_obstacle_3d.cpp:412',
      says: 'does not support non-Y-axis global rotation',
      verdict: { declined: 'runtime-only', because: 'get_global_rotation(), navigation_obstacle_3d.cpp:411' },
    },
    {
      at: 'navigation_obstacle_3d.cpp:417',
      says: 'does not support zero or negative global scaling',
      verdict: { declined: 'runtime-only', because: 'get_global_basis().get_scale(), navigation_obstacle_3d.cpp:415-416' },
    },
    {
      at: 'navigation_obstacle_3d.cpp:421',
      says: 'agent radius can only be scaled uniformly',
      verdict: { declined: 'runtime-only', because: 'get_global_basis().is_conformal(), navigation_obstacle_3d.cpp:420' },
    },
  ],

  NavigationRegion2D: [
    {
      at: 'navigation_region_2d.cpp:304',
      says: 'a NavigationPolygon resource must be set or created',
      verdict: { rule: 'navigationregion2d-requires-navigation-polygon' },
      gate: 'visible-in-tree',
    },
  ],

  NavigationRegion3D: [
    {
      at: 'navigation_region_3d.cpp:257',
      says: 'a NavigationMesh resource must be set or created',
      verdict: { rule: 'navigationregion3d-requires-navigation-mesh' },
      gate: 'visible-in-tree',
    },
  ],
};

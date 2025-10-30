/**
 * Test fixture manifest for the web previewer.
 */

export interface Fixture {
  name: string;
  file: string;
  category: string;
}

export const fixtures: Fixture[] = [
  // Basic
  { name: 'Simple Node3D', file: 'simple_node3d.tscn', category: 'Basic' },
  { name: 'Empty Scene', file: 'empty_scene.tscn', category: 'Basic' },
  { name: 'Camera', file: 'camera.tscn', category: 'Basic' },
  { name: 'Mesh Instance', file: 'mesh_instance.tscn', category: 'Basic' },
  { name: 'Lights', file: 'lights.tscn', category: 'Basic' },
  { name: 'Mixed Nodes', file: 'mixed_nodes.tscn', category: 'Basic' },

  // Primitives
  { name: 'Plane Mesh', file: 'planemesh.tscn', category: 'Primitives' },
  { name: 'Capsule Mesh', file: 'capsulemesh.tscn', category: 'Primitives' },
  { name: 'Torus Mesh', file: 'torusmesh.tscn', category: 'Primitives' },
  { name: 'Prism Mesh', file: 'prismmesh.tscn', category: 'Primitives' },
  { name: 'All New Primitives', file: 'all_new_primitives.tscn', category: 'Primitives' },

  // Edge Cases
  { name: 'Malformed: Missing Bracket', file: 'malformed_missing_bracket.tscn', category: 'Edge Cases' },
  { name: 'Malformed: Invalid Transform', file: 'malformed_invalid_transform.tscn', category: 'Edge Cases' },
  { name: 'Missing Parent', file: 'missing_parent.tscn', category: 'Edge Cases' },

  // Performance
  { name: 'Large Hierarchy (Deep)', file: 'large_hierarchy_deep.tscn', category: 'Performance' },
  { name: 'Large Hierarchy (Wide)', file: 'large_hierarchy_wide.tscn', category: 'Performance' },

  // Complex
  { name: 'Hallway Scene', file: 'Hallway.tscn', category: 'Complex' },

  // External Resources (Scene Instancing Tests)
  { name: '🎯 External Only (No Parent Geometry)', file: 'external_only.tscn', category: 'External Resources' },
  { name: '🎯 Obvious Separation (Red Box + Sphere)', file: 'obvious_separation.tscn', category: 'External Resources' },
  { name: '🎯 Three Cubes (Same External x3)', file: 'three_cubes.tscn', category: 'External Resources' },
  { name: 'External Texture Reference', file: 'external_texture.tscn', category: 'External Resources' },
  { name: 'Parent with Child Scene', file: 'parent_with_external.tscn', category: 'External Resources' },
  { name: 'Multiple External Scenes', file: 'multiple_externals.tscn', category: 'External Resources' },
  { name: 'Child Cube (Standalone)', file: 'child_cube.tscn', category: 'External Resources' },
  { name: 'Child Sphere (Standalone)', file: 'child_sphere.tscn', category: 'External Resources' },
];

export function getFixturesByCategory(): Map<string, Fixture[]> {
  const categorized = new Map<string, Fixture[]>();

  for (const fixture of fixtures) {
    const category = fixture.category;
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(fixture);
  }

  return categorized;
}

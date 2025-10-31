/**
 * Scene manifest for the web previewer.
 */

export interface Fixture {
  name: string;
  file: string;
  category: string;
}

export const fixtures: Fixture[] = [
  // Unit - Basic Nodes
  { name: 'Node3D Basic', file: 'unit-node3d-basic.tscn', category: 'Unit - Basic Nodes' },
  { name: 'Empty Scene', file: 'unit-empty-scene.tscn', category: 'Unit - Basic Nodes' },
  { name: 'Camera Basic', file: 'unit-camera-basic.tscn', category: 'Unit - Basic Nodes' },
  { name: 'Mesh Instance Basic', file: 'unit-mesh-instance-basic.tscn', category: 'Unit - Basic Nodes' },

  // Unit - Primitive Meshes
  { name: 'Box Mesh', file: 'unit-box-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Sphere Mesh', file: 'unit-sphere-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Cylinder Mesh', file: 'unit-cylinder-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Capsule Mesh', file: 'unit-capsule-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Plane Mesh', file: 'unit-plane-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Torus Mesh', file: 'unit-torus-mesh.tscn', category: 'Unit - Primitive Meshes' },
  { name: 'Prism Mesh', file: 'unit-prism-mesh.tscn', category: 'Unit - Primitive Meshes' },

  // Unit - Materials
  { name: 'Metallic Material', file: 'unit-material-metallic.tscn', category: 'Unit - Materials' },
  { name: 'Emissive Material', file: 'unit-material-emissive.tscn', category: 'Unit - Materials' },

  // Unit - External Resources
  { name: 'External Cube (Standalone)', file: 'unit-external-cube.tscn', category: 'Unit - External Resources' },
  { name: 'External Sphere (Standalone)', file: 'unit-external-sphere.tscn', category: 'Unit - External Resources' },
  { name: 'External Texture', file: 'unit-external-texture.tscn', category: 'Unit - External Resources' },

  // Edge Cases
  { name: 'Malformed: Missing Bracket', file: 'edge-malformed-bracket.tscn', category: 'Edge Cases' },
  { name: 'Invalid Transform', file: 'edge-invalid-transform.tscn', category: 'Edge Cases' },
  { name: 'Missing Parent', file: 'edge-missing-parent.tscn', category: 'Edge Cases' },
  { name: 'Invalid Cast Shadow', file: 'edge-invalid-cast-shadow.tscn', category: 'Edge Cases' },
  { name: 'Unsupported 2D Audio', file: 'edge-unsupported-2d-audio.tscn', category: 'Edge Cases' },

  // Integration - Multi-Node
  { name: 'Mixed Nodes', file: 'integration-mixed-nodes.tscn', category: 'Integration - Multi-Node' },
  { name: 'All Light Types', file: 'integration-lights-all-types.tscn', category: 'Integration - Multi-Node' },
  { name: 'All Mesh Types', file: 'integration-all-meshes.tscn', category: 'Integration - Multi-Node' },
  { name: 'All Primitives', file: 'integration-all-primitives.tscn', category: 'Integration - Multi-Node' },

  // Integration - External Scenes
  { name: 'Three Cubes (Same External x3)', file: 'integration-three-cubes.tscn', category: 'Integration - External Scenes' },
  { name: 'External Only (No Parent Geometry)', file: 'integration-external-only.tscn', category: 'Integration - External Scenes' },
  { name: 'External Separation (Red Box + Sphere)', file: 'integration-external-separation.tscn', category: 'Integration - External Scenes' },
  { name: 'Parent with Child Scene', file: 'integration-parent-child-scene.tscn', category: 'Integration - External Scenes' },
  { name: 'Multiple External Scenes', file: 'integration-multiple-externals.tscn', category: 'Integration - External Scenes' },

  // Examples - Complex Scenes
  { name: 'Hallway', file: 'example-hallway.tscn', category: 'Examples - Complex Scenes' },
  { name: 'Hierarchy (Deep)', file: 'example-hierarchy-deep.tscn', category: 'Examples - Complex Scenes' },
  { name: 'Hierarchy (Wide)', file: 'example-hierarchy-wide.tscn', category: 'Examples - Complex Scenes' },
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

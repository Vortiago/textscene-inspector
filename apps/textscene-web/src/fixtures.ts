/**
 * Scene manifest for the web previewer.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm generate:fixtures
 */

export interface Fixture {
  name: string;
  file: string;
  category: string;
}

export const fixtures: Fixture[] = [
  {
    "name": "Invalid Cast Shadow",
    "file": "edge-invalid-cast-shadow.tscn",
    "category": "Edge Cases"
  },
  {
    "name": "Invalid Transform",
    "file": "edge-invalid-transform.tscn",
    "category": "Edge Cases"
  },
  {
    "name": "Malformed Bracket",
    "file": "edge-malformed-bracket.tscn",
    "category": "Edge Cases"
  },
  {
    "name": "Missing Parent",
    "file": "edge-missing-parent.tscn",
    "category": "Edge Cases"
  },
  {
    "name": "Unsupported 2d Audio",
    "file": "edge-unsupported-2d-audio.tscn",
    "category": "Edge Cases"
  },
  {
    "name": "Box Mesh",
    "file": "unit-box-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Capsule Mesh",
    "file": "unit-capsule-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Cylinder Mesh",
    "file": "unit-cylinder-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Mesh Instance Basic",
    "file": "unit-mesh-instance-basic.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Plane Mesh",
    "file": "unit-plane-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Prism Mesh",
    "file": "unit-prism-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Sphere Mesh",
    "file": "unit-sphere-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Torus Mesh",
    "file": "unit-torus-mesh.tscn",
    "category": "Unit - Primitive Meshes"
  },
  {
    "name": "Camera Basic",
    "file": "unit-camera-basic.tscn",
    "category": "Unit - Basic Nodes"
  },
  {
    "name": "Empty Scene",
    "file": "unit-empty-scene.tscn",
    "category": "Unit - Basic Nodes"
  },
  {
    "name": "Node3d Basic",
    "file": "unit-node3d-basic.tscn",
    "category": "Unit - Basic Nodes"
  },
  {
    "name": "External Cube",
    "file": "unit-external-cube.tscn",
    "category": "Unit - External Resources"
  },
  {
    "name": "External Sphere",
    "file": "unit-external-sphere.tscn",
    "category": "Unit - External Resources"
  },
  {
    "name": "External Texture",
    "file": "unit-external-texture.tscn",
    "category": "Unit - External Resources"
  },
  {
    "name": "Missing External Scene",
    "file": "unit-external-missing.tscn",
    "category": "Unit - External Resources"
  },
  {
    "name": "Material Emissive",
    "file": "unit-material-emissive.tscn",
    "category": "Unit - Materials"
  },
  {
    "name": "Material Metallic",
    "file": "unit-material-metallic.tscn",
    "category": "Unit - Materials"
  },
  {
    "name": "Hallway",
    "file": "example-hallway.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Hierarchy Deep",
    "file": "example-hierarchy-deep.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Hierarchy Wide",
    "file": "example-hierarchy-wide.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "All Meshes",
    "file": "integration-all-meshes.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "All Primitives",
    "file": "integration-all-primitives.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "External Only",
    "file": "integration-external-only.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "External Separation",
    "file": "integration-external-separation.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Lights All Types",
    "file": "integration-lights-all-types.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Mixed Nodes",
    "file": "integration-mixed-nodes.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Multiple Externals",
    "file": "integration-multiple-externals.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Parent Child Scene",
    "file": "integration-parent-child-scene.tscn",
    "category": "Examples - Complex Scenes"
  },
  {
    "name": "Three Cubes",
    "file": "integration-three-cubes.tscn",
    "category": "Examples - Complex Scenes"
  }
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

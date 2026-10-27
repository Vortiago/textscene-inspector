/**
 * <GridMap> items whose mesh is a PrimitiveMesh: Godot stores `item/<id>/mesh` as any
 * `Ref<Mesh>` (`scene/resources/3d/mesh_library.cpp:48-49`) and draws whatever kind it is
 * (`modules/gridmap/grid_map.cpp:688-700`), so a BoxMesh tile draws its box, not the placeholder.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderGridMapTiles, renderInstancedTile } from './testing/gridMapCorpus';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';

/** A library whose item 0 is the inline sub-resource `meshBlock` declares as `Mesh_item`. */
function inlineMeshLibrary(meshBlock: string): string {
  return `[gd_resource type="MeshLibrary" format=3]

${meshBlock}

[resource]
item/0/name = "Tile"
item/0/mesh = SubResource("Mesh_item")
`;
}

/** The size of a tile's geometry box, rounded to the micrometre. */
function geometrySize(tile: THREE.InstancedMesh): number[] {
  tile.geometry.computeBoundingBox();
  const size = tile.geometry.boundingBox!.getSize(new THREE.Vector3());
  return size.toArray().map((v) => Math.round(v * 1e6) / 1e6);
}

describe('<GridMap> item with an inline PrimitiveMesh', () => {
  it('draws the BoxMesh at its own size, not the wireframe placeholder', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary('[sub_resource type="BoxMesh" id="Mesh_item"]\nsize = Vector3(2, 0.5, 1)'),
    });
    expect((tile.material as THREE.MeshBasicMaterial).wireframe).toBeFalsy();
    expect(geometrySize(tile)).toEqual([2, 0.5, 1]);
  });

  it('draws the material the BoxMesh names', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary(`[sub_resource type="StandardMaterial3D" id="Red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="Mesh_item"]
material = SubResource("Red")`),
    });
    expect((tile.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
  });
});

describe('<GridMap> item with a TubeTrailMesh that names a Curve', () => {
  it("draws the tube scaled by the Curve in the library's own tables", async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary(`[sub_resource type="Curve" id="Curve_item"]
_data = [Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 3), 0.0, 0.0, 0, 0]

[sub_resource type="TubeTrailMesh" id="Mesh_item"]
radial_steps = 4
sections = 2
section_length = 1.0
section_rings = 1
curve = SubResource("Curve_item")`),
    });
    expect((tile.material as THREE.MeshBasicMaterial).wireframe).toBeFalsy();
    // The bottom row is three times the radius of 0.5.
    expect(geometrySize(tile)).toEqual([3, 2, 3]);
  });
});

describe('<GridMap> item with a TubeTrailMesh whose Curve is a .tres', () => {
  const GROWING_CURVE_FILE = `[gd_resource type="Curve" format=3]

[resource]
_data = [Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 3), 0.0, 0.0, 0, 0]
`;
  const TUBE_BODY = `radial_steps = 4
sections = 2
section_length = 1.0
section_rings = 1`;

  it("draws the tube scaled by the Curve file the library's own table names", async () => {
    const tile = await renderInstancedTile({
      library: `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="Curve" path="res://stage/meshes/grow.tres" id="1_curve"]

[sub_resource type="TubeTrailMesh" id="Mesh_item"]
${TUBE_BODY}
curve = ExtResource("1_curve")

[resource]
item/0/mesh = SubResource("Mesh_item")
`,
      files: { 'res://stage/meshes/grow.tres': GROWING_CURVE_FILE },
    });
    expect(geometrySize(tile)).toEqual([3, 2, 3]);
  });

  it('draws a .tres tube scaled by the Curve file that .tres names', async () => {
    const tile = await renderInstancedTile({
      library: `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="TubeTrailMesh" path="res://stage/meshes/tube.tres" id="1_tube"]

[resource]
item/0/mesh = ExtResource("1_tube")
`,
      files: {
        'res://stage/meshes/tube.tres': `[gd_resource type="TubeTrailMesh" format=3]

[ext_resource type="Curve" path="res://stage/meshes/grow.tres" id="1_curve"]

[resource]
${TUBE_BODY}
curve = ExtResource("1_curve")
`,
        'res://stage/meshes/grow.tres': GROWING_CURVE_FILE,
      },
    });
    expect(geometrySize(tile)).toEqual([3, 2, 3]);
  });
});

describe('<GridMap> item whose mesh is a PrimitiveMesh .tres', () => {
  it('draws the BoxMesh the file holds', async () => {
    const tile = await renderInstancedTile({
      library: `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="BoxMesh" path="res://stage/meshes/box.tres" id="1_box"]

[resource]
item/0/mesh = ExtResource("1_box")
`,
      files: {
        'res://stage/meshes/box.tres':
          '[gd_resource type="BoxMesh" format=3]\n\n[resource]\nsize = Vector3(0.5, 3, 0.25)\n',
      },
    });
    expect(geometrySize(tile)).toEqual([0.5, 3, 0.25]);
  });
});

describe('<GridMap> item with an inline PrimitiveMesh Godot builds no surface for', () => {
  it('draws nothing, neither the mesh nor the placeholder', async () => {
    // Equal radii: Godot refuses to build the torus (`primitive_meshes.cpp:2232`).
    const tiles = await renderGridMapTiles({
      library: inlineMeshLibrary(
        '[sub_resource type="TorusMesh" id="Mesh_item"]\ninner_radius = 1.0\nouter_radius = 1.0'
      ),
    });
    expect(tiles).toEqual([]);
  });
});

describe('<GridMap> item whose mesh path holds a TextMesh with no readable font', () => {
  it('draws the placeholder', async () => {
    const tile = await renderInstancedTile({
      library: `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="Mesh" path="res://stage/meshes/text.tres" id="1_text"]

[resource]
item/0/mesh = ExtResource("1_text")
`,
      files: { 'res://stage/meshes/text.tres': '[gd_resource type="TextMesh" format=3]\n\n[resource]\n' },
    });
    expect((tile.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });
});

describe('<GridMap> item whose inline mesh is a TextMesh with no readable font', () => {
  it('draws the placeholder, as the previewer has no outlines to draw', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary('[sub_resource type="TextMesh" id="Mesh_item"]'),
    });
    expect((tile.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  });
});

describe('<GridMap> item whose mesh has no surfaces', () => {
  // Godot places the cell, and its mesh draws nothing: a PlaceholderMesh has no surface
  // (`scene/resources/mesh.h:421`), and an ImmediateMesh saves none (`immediate_mesh.cpp:405-417`).
  it.each(['PlaceholderMesh', 'ImmediateMesh'])('draws nothing for %s, not the placeholder', async (type) => {
    const tiles = await renderGridMapTiles({
      library: inlineMeshLibrary(`[sub_resource type="${type}" id="Mesh_item"]`),
    });
    expect(tiles).toEqual([]);
  });
});

describe('<GridMap> cell Godot gives no mesh', () => {
  // Godot places a cell only for an item the library holds with a valid mesh
  // (`modules/gridmap/grid_map.cpp:676-678,689`).
  it('draws nothing for an item with no mesh', async () => {
    const tiles = await renderGridMapTiles({
      library: '[gd_resource type="MeshLibrary" format=3]\n\n[resource]\nitem/0/name = "Empty"\n',
    });
    expect(tiles).toEqual([]);
  });

  it('draws nothing for an item the library lacks', async () => {
    const tiles = await renderGridMapTiles({
      library: '[gd_resource type="MeshLibrary" format=3]\n\n[resource]\n',
    });
    expect(tiles).toEqual([]);
  });
});

describe('<GridMap> item with an inline ArrayMesh', () => {
  it('draws the ArrayMesh with the material its surface names in the library', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary(`[sub_resource type="StandardMaterial3D" id="Green"]
albedo_color = Color(0, 1, 0, 1)

[sub_resource type="ArrayMesh" id="Mesh_item"]
_surfaces = ${wallQuadSurfaces({ material: 'SubResource("Green")', name: 'tile' })}`),
    });
    expect((tile.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x00ff00);
  });
});

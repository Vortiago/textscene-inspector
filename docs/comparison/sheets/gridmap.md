---
type: GridMap
category: 3D
fixture: unit-grid-map.tscn
image: unit-grid-map
renders_as: a THREE.InstancedMesh per MeshLibrary item
---

# GridMap

GridMap instances each populated cell's MeshLibrary item mesh, batching cells of the
same item into one THREE.InstancedMesh. This fixture places one flat quad tile across
nine cells, which read as a single grey tiled surface receding to the upper right.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mesh_library` | ExtResource (`unit-grid-map-lib.tres`) | supplies the tile mesh — a flat 2×2 quad |
| `cell_size` | `Vector3(2, 2, 2)` | 2-unit spacing, so the 2×2 tiles abut without gaps |
| `data` / `cells` | 9 cells, item 0 | the populated 3×3 patch that fills the frame |

## Divergences

The nine tiles place pixel-for-pixel with Godot — same silhouette, same lower-left
notch, same recession. Tone is the one difference: our tile is a few values darker and
cooler (centre `93,99,111` → `82,88,98`, ~11/255 per channel, uniform across the plane).
Sky (`194,197,203`) and ground (`~60,54,37`) are identical in both images, so this is the
tile surface, not exposure or ambient. The quad's ArrayMesh declares no surface material,
so the previewer paints it with its neutral grey placeholder (`0xb0b0b0`), which reads
slightly darker than the surface Godot draws for the same material-less tile. Subtle, and
a placeholder-material effect — the GridMap geometry itself matches.

## Known limitations

- **cell_scale** — a GridMap's `cell_scale` (default 1.0) is not parsed; a map that sets it would render every tile at the wrong size.

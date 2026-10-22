/**
 * <GridMap> instances each MeshLibrary item's mesh, an ArrayMesh or a PrimitiveMesh, at its
 * populated cells. Each surface draws as one THREE.InstancedMesh, as one mesh per cell when its
 * material billboards, or as one THREE.Points holding every cell's points for a PointMesh. A loading
 * item draws nothing. An item whose mesh or library this previewer cannot read draws cell-sized
 * wireframe boxes in one InstancedMesh.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { nodeComponentRegistry, type NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { parseNodeWithRegistry } from '../../../core/NodeRegistry';
import type { TscnInternalResource, TscnNode } from '../../../parser/types';
import { LightmapSubInstanceProvider } from '../../../r3f/lightmap/useLightmapAssignment';
import { Node3D } from '../../base/node3d/Component';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import type { MaterialSource } from '../../../r3f/materials/materialSource';
import { useMeshContent, type SurfacedPart } from '../../../r3f/meshes/meshContent';
import { geometryDrawsPoints } from '../../../resources/meshes/godotSurface';
import { usePathResolution } from '../../../resources/useSubOrExtResource';
import { SurfaceMaterialSlot, useMaterialScalars } from '../../../r3f/materials/SurfaceMaterialSlot';
import { surfaceAttach, surfaceSources } from '../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../r3f/materials/useOneSurfaceStartingMaterial';
import { readyMaterial, useMaterial } from '../../../r3f/materials/useMaterial';
import { surfaceBillboard } from '../../../resources/materials/standardmaterial3d/materialBag';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../../godot/math/transform3d';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { pointsAtCells } from './pointCells';
import { drawHookProps, shadowCastingEffects, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { drawsAsOneBatch } from '../../../r3f/surfaceDrawHooks';
import { transform3DToMatrix } from '../../../r3f/nodeTreeTransforms';

/** Where each cell sits in the grid, and how much its mesh scales. */
type CellGrid = Pick<GridMapProperties, 'cellSize' | 'cellCenter' | 'cellScale'>;

/** Literal-only, so the key is constant and the placeholder batch never remounts its material. */
const PLACEHOLDER_TILE_MATERIAL = wireGizmoProgram(0x4488cc);

/** Written only by `cellMatrix`. `Matrix4.scale` reads it at once, so a large grid allocates none. */
const cellScaleVector = new THREE.Vector3();

/**
 * A cell's place: translate(cell·size + centering offset). The offset is Godot's `_get_offset()`:
 * `cell_size * 0.5` on each axis whose `cell_center_*` is on, all three by default. Without it the
 * tiles sit half a cell off from sibling nodes.
 */
function cellOrigin(cell: GridMapCell, { cellSize, cellCenter }: Omit<CellGrid, 'cellScale'>): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(
    cell.x * cellSize.x + (cellCenter.x ? cellSize.x * 0.5 : 0),
    cell.y * cellSize.y + (cellCenter.y ? cellSize.y * 0.5 : 0),
    cell.z * cellSize.z + (cellCenter.z ? cellSize.z * 0.5 : 0)
  );
}

/**
 * World matrix for one cell: its place × scale(cell_scale) × orientation × meshTransform
 * (`modules/gridmap/grid_map.cpp:685-687,696`).
 */
function cellMatrix(cell: GridMapCell, grid: CellGrid, meshTransform: Transform3D | null): THREE.Matrix4 {
  const basis = ORTHO_BASES[cell.rot] ?? ORTHO_BASES[0]!;
  const orient = new THREE.Matrix4().set(
    basis[0]!,
    basis[1]!,
    basis[2]!,
    0,
    basis[3]!,
    basis[4]!,
    basis[5]!,
    0,
    basis[6]!,
    basis[7]!,
    basis[8]!,
    0,
    0,
    0,
    0,
    1
  );
  const matrix = cellOrigin(cell, grid);
  matrix.scale(cellScaleVector.setScalar(grid.cellScale)).multiply(orient);
  if (meshTransform) matrix.multiply(transform3DToMatrix(meshTransform));
  return matrix;
}

export function GridMap({ node, children }: NodeComponentProps) {
  const properties = node.properties as GridMapProperties;
  const library = useMeshLibraryModel(properties.meshLibrary);

  const cellsByItem = useMemo(() => {
    const grouped = new Map<number, GridMapCell[]>();
    for (const cell of decodeGridMapCells(properties.cells ?? '')) {
      const list = grouped.get(cell.item);
      if (list) list.push(cell);
      else grouped.set(cell.item, [cell]);
    }
    return grouped;
  }, [properties.cells]);

  // Godot draws no cell while the GridMap holds baked meshes (`modules/gridmap/grid_map.cpp:688`).
  const hasBakedMeshes = properties.bakedMeshes.length > 0;
  const items = library.status === 'pending' || hasBakedMeshes ? [] : Array.from(cellsByItem.entries());
  const gridProps = {
    cellSize: properties.cellSize,
    cellCenter: properties.cellCenter,
    cellScale: properties.cellScale,
  };
  return (
    <Node3D node={node}>
      {hasBakedMeshes && <BakedMeshes refs={properties.bakedMeshes} />}
      {items.map(([itemId, cells]) => {
        // A library this previewer cannot load draws each cell's placeholder instead.
        if (!library.model) return <PlaceholderTiles key={itemId} cells={cells} {...gridProps} />;
        const item = library.model.get(itemId);
        // Godot draws a cell only for an item the library holds with a mesh (`:676-678,689`).
        if (!item?.meshPath) return null;
        return <GridMapItem key={itemId} item={item} cells={cells} {...gridProps} />;
      })}
      {children}
    </Node3D>
  );
}

/**
 * Each baked mesh as the instance Godot gives it at the GridMap's own transform
 * (`grid_map.cpp:97-104`, `:1037-1039`), drawn as a MeshInstance3D of that mesh would be. A
 * LightmapGI names each by its index (`lightmap_gi.cpp:1544-1550`).
 */
function BakedMeshes({ refs }: { refs: readonly string[] }) {
  const nodes = useMemo(() => refs.map(bakedMeshNode), [refs]);
  const MeshInstance3D = nodeComponentRegistry.get(MESH_INSTANCE_TYPE);
  if (!MeshInstance3D) return null;
  return (
    <>
      {nodes.map((meshNode, index) => (
        <LightmapSubInstanceProvider key={index} value={index}>
          <MeshInstance3D node={meshNode} />
        </LightmapSubInstanceProvider>
      ))}
    </>
  );
}

const MESH_INSTANCE_TYPE = 'MeshInstance3D';

/** A MeshInstance3D of the baked mesh `ref`, with every other property at its default. */
function bakedMeshNode(ref: string, index: number): TscnNode {
  const heading = { type: 'node', attributes: { type: MESH_INSTANCE_TYPE, name: `BakedMesh${index}` } };
  const node = parseNodeWithRegistry(heading, { mesh: ref });
  if (!node) throw new Error(`expected the ${MESH_INSTANCE_TYPE} parser to be registered, got none`);
  return node;
}

interface GridMapItemProps extends CellGrid {
  item: MeshLibraryItem;
  cells: GridMapCell[];
}

/**
 * All cells sharing one MeshLibrary item. Each surface decides on its own whether it batches,
 * as Godot billboards each surface's instances in its own shader (`scene_forward_clustered.glsl:338-342`).
 */
function GridMapItem({ item, cells, cellSize, cellCenter, cellScale }: GridMapItemProps) {
  const content = useMeshContent(usePathResolution(item.meshPath));

  // `cellCenter` is compared by identity: the parser hands back one shared
  // frozen instance for the all-centered default, so re-parsing an unchanged
  // file (every debounced keystroke) does not rebuild every cell's matrix.
  const matrices = useMemo(() => {
    const grid = { cellSize, cellCenter, cellScale };
    return cells.map((cell) => cellMatrix(cell, grid, item.meshTransform));
  }, [cells, cellSize, cellCenter, cellScale, item.meshTransform]);

  // GridMap has no `cast_shadow` of its own. The setting is per tile, read off
  // the library (`modules/gridmap/grid_map.cpp:799-800`).
  const shadow = shadowCastingEffects(item.castShadow);

  // Godot draws the mesh, so a mesh this previewer cannot read shows the placeholder.
  if (content.kind === 'unresolved') {
    return <PlaceholderTiles cells={cells} cellSize={cellSize} cellCenter={cellCenter} />;
  }
  if (content.kind !== 'surfaced') return null;
  const { parts, primitive } = content.mesh;
  return (
    <>
      {parts.map((part, partIndex) => (
        <GridMapPart key={partIndex} part={part} primitive={primitive} shadow={shadow} matrices={matrices} />
      ))}
    </>
  );
}

interface GridMapPartProps {
  part: SurfacedPart;
  primitive?: TscnInternalResource;
  shadow: ShadowCastingEffects;
  matrices: THREE.Matrix4[];
}

/** One part of an item's mesh at every cell: the surfaces that share one primitive type. */
function GridMapPart(props: GridMapPartProps) {
  return geometryDrawsPoints(props.part.geometry) ? (
    <PointsPart {...props} />
  ) : (
    <PartSurfaces {...props} geometry={props.part.geometry} />
  );
}

/**
 * Three cannot instance `THREE.Points`, so every cell's points are one geometry, shared by the
 * part's surfaces. It is new for each set of cells, and is disposed with them.
 */
function PointsPart(props: GridMapPartProps) {
  const { part, matrices } = props;
  const geometry = useMemo(() => pointsAtCells(part.geometry, matrices), [part.geometry, matrices]);
  useDisposeOnRelease(geometry);
  return <PartSurfaces {...props} geometry={geometry} />;
}

function PartSurfaces({
  part,
  geometry,
  primitive,
  shadow,
  matrices,
}: GridMapPartProps & { geometry: THREE.BufferGeometry }) {
  const surfaces = surfaceSources(part.materials);
  return (
    <>
      {surfaces.map((source, surface) => (
        <GridMapSurface
          key={surface}
          draw={{ geometry, primitive, source, surface, surfaceCount: surfaces.length, shadow }}
          matrices={matrices}
        />
      ))}
    </>
  );
}

/** One surface of an item's mesh, drawn on its own. */
interface SurfaceDraw {
  geometry: THREE.BufferGeometry;
  /** The PrimitiveMesh drawn, which a triplanar material tiles against. Absent for an ArrayMesh. */
  primitive?: TscnInternalResource;
  /** Undefined for a surface that names no material: Godot's default surface. */
  source: MaterialSource | undefined;
  /** The draw group this draw owns. */
  surface: number;
  surfaceCount: number;
  shadow: ShadowCastingEffects;
}

/**
 * Every cell of one surface: one batch, or one tile per cell when its material billboards. A points
 * surface is one `THREE.Points`. The decoded material decides, as the drawn one exists only inside a slot.
 */
function GridMapSurface({ draw, matrices }: { draw: SurfaceDraw; matrices: THREE.Matrix4[] }) {
  const scalars = useMaterialScalars(readyMaterial(useMaterial(draw.source)));
  if (geometryDrawsPoints(draw.geometry)) return <PointTiles draw={draw} />;
  if (drawsAsOneBatch(surfaceBillboard(scalars))) return <BatchedTiles draw={draw} matrices={matrices} />;
  return (
    <>
      {matrices.map((m, i) => (
        <CellTile key={i} draw={draw} matrix={m} />
      ))}
    </>
  );
}

/**
 * Every cell as one InstancedMesh, keyed on the count: three sizes the instance buffer at
 * construction. `useMeshContent` owns the geometry, which R3F leaves alone since it arrives
 * through `args`. The shadow hooks carry DOUBLE_SIDED and SHADOWS_ONLY per draw
 * (`r3f/surfaceDrawHooks.ts`).
 */
function BatchedTiles({ draw, matrices }: { draw: SurfaceDraw; matrices: THREE.Matrix4[] }) {
  const { geometry, shadow } = draw;
  const startingMaterial = useOneSurfaceStartingMaterial(draw.surfaceCount);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Every arg is a dependency: a changed arg rebuilds the mesh with identity instance matrices.
  useLayoutEffect(
    () => writeInstanceMatrices(meshRef.current, matrices),
    [matrices, geometry, startingMaterial]
  );

  return (
    <instancedMesh
      key={matrices.length}
      ref={meshRef}
      args={[geometry, startingMaterial, matrices.length]}
      {...drawHookProps(shadow)}
    >
      <OwnedSurfaceSlot draw={draw} />
    </instancedMesh>
  );
}

/** A surface's points at every cell as one THREE.Points. The geometry holds each cell's matrix, so the object keeps the identity. */
function PointTiles({ draw }: { draw: SurfaceDraw }) {
  const { geometry, shadow } = draw;
  const startingMaterial = useOneSurfaceStartingMaterial(draw.surfaceCount);
  return (
    <points args={[geometry, startingMaterial]} {...drawHookProps(shadow)}>
      <OwnedSurfaceSlot draw={draw} />
    </points>
  );
}

/**
 * One cell of a billboarding surface. A billboard turns about its own cell as in Godot
 * (`drawsAsOneBatch` says why a batch cannot). Each cell mounts its own slot, since a material
 * element attaches to one parent. Every such material shares one program.
 */
function CellTile({ draw, matrix }: { draw: SurfaceDraw; matrix: THREE.Matrix4 }) {
  const { geometry, shadow } = draw;
  const startingMaterial = useOneSurfaceStartingMaterial(draw.surfaceCount);
  return (
    <mesh
      args={[geometry, startingMaterial]}
      matrix={matrix}
      matrixAutoUpdate={false}
      {...drawHookProps(shadow)}
    >
      <OwnedSurfaceSlot draw={draw} />
    </mesh>
  );
}

/** The material of the one draw group a surface draw owns. */
function OwnedSurfaceSlot({ draw }: { draw: SurfaceDraw }) {
  return (
    <SurfaceMaterialSlot
      source={draw.source}
      attach={surfaceAttach(draw.surface, draw.surfaceCount)}
      triplanarMesh={draw.primitive}
      drawsPoints={geometryDrawsPoints(draw.geometry)}
    />
  );
}

/**
 * A cell-sized wireframe box at each cell's place, all in one draw, so a missing item in a large
 * grid costs one draw as its tiles would.
 */
function PlaceholderTiles({
  cells,
  cellSize,
  cellCenter,
}: { cells: GridMapCell[] } & Omit<CellGrid, 'cellScale'>) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(
    () => cells.map((cell) => cellOrigin(cell, { cellSize, cellCenter })),
    [cells, cellSize, cellCenter]
  );
  useLayoutEffect(() => writeInstanceMatrices(meshRef.current, matrices), [matrices]);
  return (
    <instancedMesh key={matrices.length} ref={meshRef} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={[cellSize.x, cellSize.y, cellSize.z]} />
      <meshBasicMaterial key={PLACEHOLDER_TILE_MATERIAL.key} {...PLACEHOLDER_TILE_MATERIAL.props} />
    </instancedMesh>
  );
}

/** Sets each instance of `mesh` to its matrix. A mesh not yet mounted waits for the next call. */
function writeInstanceMatrices(mesh: THREE.InstancedMesh | null, matrices: THREE.Matrix4[]): void {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  // three computes these once and culls by them, so a moved cell would stay culled at its old place.
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
}

/**
 * <GridMap> instances each MeshLibrary item's mesh, an ArrayMesh or a PrimitiveMesh, at its
 * populated cells. Each surface draws as one THREE.InstancedMesh, or as one THREE.Points or
 * THREE.LineSegments instanced at every cell for a points or lines surface. A billboarding material turns each cell about its own origin in its
 * program. A loading item draws nothing.
 * An item whose mesh or library this previewer cannot read draws cell-sized wireframe boxes in one
 * InstancedMesh.
 */

import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../../godot/scene/visualLayers';
import * as THREE from 'three';
import { nodeComponentRegistry, type NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { parseNodeWithRegistry } from '../../../core/NodeRegistry';
import type { TscnNode } from '../../../parser/types';
import { LightmapSubInstanceProvider } from '../../../r3f/lightmap/useLightmapAssignment';
import { Node3D } from '../../base/node3d/Component';
import { useMeshLibraryModel } from '../../../r3f/useMeshLibraryModel';
import type { MaterialSource } from '../../../r3f/materials/materialSource';
import { drawnTag, useMeshContent, type SurfacedPart } from '../../../r3f/meshes/meshContent';
import { geometryPrimitive } from '../../../resources/meshes/godotSurface';
import { usePathResolution } from '../../../resources/useSubOrExtResource';
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import { surfaceAttach, surfaceSources } from '../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../r3f/materials/useOneSurfaceStartingMaterial';
import {
  NextPassChain,
  nextPassRenderOrder,
  type ChainDrawFactory,
  type ChainDrawSpec,
} from '../../../r3f/materials/nextPass';
import { NO_RAYCAST } from '../../../r3f/materials/materialOverlay';
import type { MeshLibraryItem } from '../../../resources/meshlibrary/types';
import type { Transform3D } from '../../../godot/math/transform3d';
import type { GridMapProperties } from './types';
import { decodeGridMapCells, ORTHO_BASES, type GridMapCell } from './cellData';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import {
  instancesBounds,
  listedSlot,
  listedSlotOf,
  raycastInstanced,
  sharedInstancesAt,
  useSharedInstances,
} from '../../../r3f/meshes/sharedInstances';
import { drawHookProps, shadowCastingEffects, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { transform3DToMatrix } from '../../../r3f/nodeTreeTransforms';
import { isLocalToScene } from '../../../resources/textures/viewporttexture/localToScene.js';

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
  const isMeshHeldLocally = !library.resource || isLocalToScene(library.resource);

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
        return (
          <GridMapItem
            key={itemId}
            item={item}
            isMeshHeldLocally={isMeshHeldLocally}
            cells={cells}
            {...gridProps}
          />
        );
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
  /** The library, which holds the item's mesh for its materials' local-to-scene setup. */
  isMeshHeldLocally: boolean;
  cells: GridMapCell[];
}

/**
 * All cells sharing one MeshLibrary item, each surface as one instanced draw, which Godot
 * billboards per instance in its shader (`scene_forward_clustered.glsl:338-342`).
 */
function GridMapItem({ item, isMeshHeldLocally, cells, cellSize, cellCenter, cellScale }: GridMapItemProps) {
  const content = useMeshContent(usePathResolution(item.meshPath), isMeshHeldLocally);

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
  const { parts } = content.mesh;
  return (
    <>
      {parts.map((part, partIndex) => (
        <GridMapPart key={partIndex} part={part} shadow={shadow} matrices={matrices} />
      ))}
    </>
  );
}

interface GridMapPartProps {
  part: SurfacedPart;
  shadow: ShadowCastingEffects;
  matrices: THREE.Matrix4[];
}

/** One part of an item's mesh at every cell: the surfaces that share one primitive type. */
function GridMapPart(props: GridMapPartProps) {
  return geometryPrimitive(props.part.geometry) === 'triangles' ? (
    <PartSurfaces {...props} />
  ) : (
    <ListedPart {...props} />
  );
}

/**
 * A points or lines part at every cell as one instanced geometry over the item's own, shared by the part's
 * surfaces, new for each set of cells, with the box and sphere of every cell.
 */
function ListedPart(props: GridMapPartProps) {
  const { part, matrices } = props;
  const cellInstances = useMemo<CellInstances>(
    () => ({
      geometry: sharedInstancesAt(part.geometry, matrices),
      ...instancesBounds(part.geometry, matrices),
    }),
    [part.geometry, matrices]
  );
  useSharedInstances(cellInstances.geometry, part.geometry);
  return <PartSurfaces {...props} cellInstances={cellInstances} />;
}

/** What a points or lines draw mounts as. */
type ListedObject = THREE.Points | THREE.LineSegments;

/** The points or lines of a part at every cell, and the box and sphere three frames and culls it by. */
interface CellInstances extends ReturnType<typeof instancesBounds> {
  geometry: THREE.InstancedBufferGeometry;
}

function PartSurfaces({
  part,
  cellInstances,
  shadow,
  matrices,
}: GridMapPartProps & { cellInstances?: CellInstances }) {
  const surfaces = surfaceSources(part.materials);
  const { geometry } = part;
  // A cell's chain draw is its own instanced batch of the cells, at its surface's
  // ordinal, over the geometry the part draws, and at its surface's own draw group.
  const chainDraw: ChainDrawFactory = (spec) =>
    cellInstances ? (
      <ChainInstancedCells spec={spec} cellInstances={cellInstances} />
    ) : (
      <ChainBatchedTiles spec={spec} matrices={matrices} />
    );
  return (
    <>
      {surfaces.map((source, surface) => (
        <GridMapSurface
          key={surface}
          draw={{ geometry, cellInstances, source, surface, surfaceCount: surfaces.length, shadow }}
          matrices={matrices}
        />
      ))}
      <NextPassChain
        sources={surfaces}
        geometry={cellInstances?.geometry ?? geometry}
        primitive={geometryPrimitive(geometry)}
        godotLayers={GODOT_DEFAULT_VISUAL_LAYERS}
        shadow={shadow}
        draw={chainDraw}
      />
    </>
  );
}

/** The chain link of a tile surface's material, as one more instanced batch of the cells. */
function ChainBatchedTiles({ spec, matrices }: { spec: ChainDrawSpec; matrices: THREE.Matrix4[] }) {
  const startingMaterial = useOneSurfaceStartingMaterial(spec.surfaceCount);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Every arg is a dependency: a changed arg rebuilds the mesh with identity instance matrices.
  useLayoutEffect(() => writeInstanceMatrices(meshRef.current, matrices), [matrices, spec.geometry]);
  return (
    <instancedMesh
      key={matrices.length}
      ref={meshRef}
      args={[spec.geometry, startingMaterial, matrices.length]}
      renderOrder={nextPassRenderOrder(spec.ordinal)}
      // The surface's own batch is the grid's pickable body; a coincident second hit
      // would report the same cells twice.
      raycast={NO_RAYCAST}
      receiveShadow
      onBeforeRender={spec.shadow.onBeforeRender}
      onAfterRender={spec.shadow.onAfterRender}
    >
      <SurfaceMaterialSlot source={spec.source} attach={spec.attach} {...listedSlotOf(spec.geometry)} />
    </instancedMesh>
  );
}

/** The chain link of a points or lines surface's material, as one more draw of the cells' primitives. */
function ChainInstancedCells({ spec, cellInstances }: { spec: ChainDrawSpec; cellInstances: CellInstances }) {
  return (
    <CellsDrawn
      cellInstances={cellInstances}
      surfaceCount={spec.surfaceCount}
      renderOrder={nextPassRenderOrder(spec.ordinal)}
      raycast={NO_RAYCAST}
      // The chain draw casts nothing of its own: the surface's own draw casts the
      // geometry once, so only the colour pair mounts.
      receiveShadow
      onBeforeRender={spec.shadow.onBeforeRender}
      onAfterRender={spec.shadow.onAfterRender}
    >
      <SurfaceMaterialSlot
        source={spec.source}
        attach={spec.attach}
        {...listedSlot(geometryPrimitive(cellInstances.geometry), 'instances')}
      />
    </CellsDrawn>
  );
}

/** One surface of an item's mesh, drawn on its own. */
interface SurfaceDraw {
  /** The geometry drawn: the item's own, or a points or lines surface's instances at every cell. */
  geometry: THREE.BufferGeometry;
  /** A points or lines surface's primitives at every cell. Undefined for triangles. */
  cellInstances?: CellInstances;
  /** Undefined for a surface that names no material: Godot's default surface. */
  source: MaterialSource | undefined;
  /** The draw group this draw owns. */
  surface: number;
  surfaceCount: number;
  shadow: ShadowCastingEffects;
}

/**
 * Every cell of one surface as one instanced draw, a billboarding one too: its program billboards
 * each cell about its own origin, as Godot's multimesh does (`surfaceBillboard.ts`).
 */
function GridMapSurface({ draw, matrices }: { draw: SurfaceDraw; matrices: THREE.Matrix4[] }) {
  if (!draw.cellInstances) return <BatchedTiles draw={draw} matrices={matrices} />;
  return <InstancedCells draw={draw} cellInstances={draw.cellInstances} />;
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

/** A surface's points or lines at every cell, one instanced object picked at each cell. */
function InstancedCells({ draw, cellInstances }: { draw: SurfaceDraw; cellInstances: CellInstances }) {
  return (
    <CellsDrawn
      cellInstances={cellInstances}
      surfaceCount={draw.surfaceCount}
      raycast={raycastInstanced}
      {...drawHookProps(draw.shadow)}
    >
      <OwnedSurfaceSlot draw={{ ...draw, geometry: cellInstances.geometry }} />
    </CellsDrawn>
  );
}

type CellsDrawnProps = Pick<
  THREE.Points,
  'renderOrder' | 'raycast' | 'castShadow' | 'receiveShadow' | 'onBeforeRender' | 'onAfterRender'
> &
  Partial<Pick<THREE.Light, 'onBeforeShadow' | 'onAfterShadow'>>;

/** The points or lines object over the cells' instances, carrying the box three culls it by. */
function CellsDrawn({
  cellInstances: { geometry, boundingBox, boundingSphere },
  surfaceCount,
  children,
  ...drawProps
}: { cellInstances: CellInstances; surfaceCount: number; children: ReactNode } & Partial<CellsDrawnProps>) {
  const startingMaterial = useOneSurfaceStartingMaterial(surfaceCount);
  const drawnRef = useRef<ListedObject>(null);
  const Drawn = drawnTag(geometryPrimitive(geometry));
  // Typed props hold no box on these objects, which three and the framing read off the object.
  useLayoutEffect(() => {
    if (drawnRef.current) Object.assign(drawnRef.current, { boundingBox, boundingSphere });
  }, [boundingBox, boundingSphere]);
  return (
    <Drawn ref={drawnRef} args={[geometry, startingMaterial]} {...drawProps}>
      {children}
    </Drawn>
  );
}

/** The material of the one draw group a surface draw owns. */
function OwnedSurfaceSlot({ draw }: { draw: SurfaceDraw }) {
  return (
    <SurfaceMaterialSlot
      source={draw.source}
      attach={surfaceAttach(draw.surface, draw.surfaceCount)}
      {...listedSlotOf(draw.geometry)}
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

/**
 * A material's `next_pass` chain: one extra surface draw per resolved link, in chain
 * order after its base, as `_geometry_instance_add_surface_with_material_chain` adds
 * the surface once for the start material and once per link of its
 * `while (material->next_pass.is_valid())` walk
 * (`render_forward_clustered.cpp:4183-4201`), starting from the effective surface
 * material and appending a valid overlay's chain after the whole surface chain
 * (`:4202-4241`). A link that reads the stencil draws nothing, because this canvas
 * requests no stencil buffer, and the walk continues past it; Godot refuses cycles at
 * the setter (`material.cpp:39-42`), so only a hand-written file can produce one, and
 * the visited set draws each material once.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { materialSourceKey, resolveNextPass, type MaterialSource } from './materialSource';
import { NO_RAYCAST } from './materialOverlay';
import { drawnTag } from '../meshes/meshContent';
import type { SurfacePrimitive } from '../../resources/meshes/godotSurface';
import { readyMaterial, useMaterial } from './useMaterial';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';
import { surfaceAttach, surfaceSources } from './SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from './useOneSurfaceStartingMaterial';
import type { ShadowCastingEffects } from '../shadowCasting';
import { visualLayersUserData } from '../visualLayers';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';

/**
 * The visited seed every chain's walk starts from: nothing has drawn yet, so no key is
 * held. The walkers never mutate their visited set — `visitedWith` returns a new one —
 * so one instance serves every group, every owner and every overlay link per render.
 *
 * @canonical The visited seed of a next_pass chain walk
 */
export const NOTHING_DRAWN: ReadonlySet<string> = new Set();

/**
 * The draw order of a next_pass chain draw: the surface's own draw is ordinal 0, each
 * resolved link takes its index, a stencil-skipped link leaves a numbered gap, and the
 * overlay mounts one past the greatest ordinal any chain reached.
 *
 * @canonical The draw order of a next_pass chain draw
 */
export function nextPassRenderOrder(ordinal: number): number {
  return ordinal;
}

/**
 * The element and bind props of a draw the base draws: `THREE.Points` for a points
 * surface, and a detached `THREE.SkinnedMesh` for a skinned one, as the skin matrices
 * stay in mesh space and the node's transform applies after them.
 *
 * @canonical The drawn element of a surface draw
 */
export function drawnElementOf(primitive: SurfacePrimitive, skeleton: THREE.Skeleton | null | undefined) {
  if (skeleton && primitive === 'triangles') {
    return { Drawn: 'skinnedMesh' as const, skin: { skeleton, bindMode: THREE.DetachedBindMode } };
  }
  return { Drawn: drawnTag(primitive), skin: {} };
}

/**
 * Reads the geometry off the base draw, in place across re-parses. Dep-less, since a
 * re-parse replaces the geometry and a `[ref]` list would keep the old one; the updater
 * returns the same value when nothing moved, so the pair cannot loop. The layout pass
 * swaps a re-parsed geometry before paint, and on mount it runs before the parent's
 * ref lands, so the passive pass reads the first geometry.
 *
 * @canonical The geometry a surface draw reads back
 */
export function useDrawnGeometry(ref: RefObject<THREE.Object3D | null>): THREE.BufferGeometry | null {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const readBack = () => {
    const attached = (ref.current as { geometry?: THREE.BufferGeometry } | null)?.geometry ?? null;
    setGeometry((previous) => (previous === attached ? previous : attached));
  };
  useLayoutEffect(readBack);
  useEffect(readBack);
  return geometry;
}

/** What every chain draw shares with the base it covers. */
export interface ChainDrawBase {
  /** What the base draws, so the chain draw draws it too. */
  primitive: SurfacePrimitive;
  /** The base is skinned, so a chain draw is skinned by the same skeleton. */
  skeleton?: THREE.Skeleton | null;
  /**
   * The node's `layers` mask, which a decal's and a reflection probe's masks filter on:
   * the chain draw carries the base's own, as Godot draws the same surface again.
   */
  godotLayers: number;
  /**
   * The base's shadow hooks. A chain draw casts nothing of its own, so only the colour
   * pair mounts, and SHADOWS_ONLY skips its draw like any other colour pass.
   */
  shadow: ShadowCastingEffects;
}

/** One extra draw of the base geometry, as the overlay's mirrors it: unpicked, receiving only. */
function ChainDraw({
  geometry,
  source,
  ordinal,
  attach,
  surfaceCount,
  primitive,
  skeleton,
  godotLayers,
  shadow,
}: {
  geometry: THREE.BufferGeometry;
  source: MaterialSource;
  ordinal: number;
  /** Where this link's slot attaches across the part's draw groups. */
  attach: string;
  /** The part's draw-group count, which sizes the invisible starting materials. */
  surfaceCount: number;
} & ChainDrawBase) {
  const startingMaterial = useOneSurfaceStartingMaterial(surfaceCount);
  const { Drawn, skin } = drawnElementOf(primitive, skeleton);
  return (
    <Drawn
      {...skin}
      args={[geometry, startingMaterial]}
      geometry={geometry}
      renderOrder={nextPassRenderOrder(ordinal)}
      // The base draw is the node's pickable body; a coincident second hit would
      // report the same node twice.
      raycast={NO_RAYCAST}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      // The node's layers mask, which a decal's and a reflection probe's masks filter on.
      userData={visualLayersUserData(godotLayers)}
    >
      <SurfaceMaterialSlot
        source={source}
        attach={attach}
        points={primitive === 'points' ? 'mesh' : undefined}
      />
    </Drawn>
  );
}

/** The props every pass of a chain reads. */
export type PassProps = {
  /** The pass material, resolved against the tables of the file that wrote it. */
  source: MaterialSource | undefined;
  /** The draw position: the surface's own draw is 0, each link its index. */
  ordinal: number;
  /** False for a starting pass, whose draw the part's surface slot mounts. */
  drawsSelf: boolean;
  /** Every source key from the starting material through this pass. */
  visited: ReadonlySet<string>;
  /** The base geometry, read back from the base draw. */
  geometry: THREE.BufferGeometry | null;
  /** Where this pass's slot attaches across the part's draw groups. */
  attach: string;
  /** The part's draw-group count, which sizes the invisible starting materials. */
  surfaceCount: number;
  /**
   * Renders the pass's own draw when the owner's object is instanced or placed, the
   * plain surface mesh's draw being the default. The walk decides the pass's draw and
   * carries the continuation; the factory mounts only this one draw.
   */
  draw?: ChainDrawFactory;
  /** Reports the greatest walked position, so an overlay mounts one past it. */
  onOrdinal?: (ordinal: number) => void;
} & ChainDrawBase;

/**
 * What a chain draw site receives from the walk: the pass, and what it covers. The base
 * fields ride `PassProps`, narrowed here to what a drawn pass has: a resolved source,
 * its own ordinal, and the geometry non-null to draw.
 */
export type ChainDrawSpec = Omit<
  PassProps,
  'source' | 'ordinal' | 'drawsSelf' | 'visited' | 'geometry' | 'draw' | 'onOrdinal'
> & {
  source: MaterialSource;
  ordinal: number;
  geometry: THREE.BufferGeometry;
};

/** Renders one chain draw. The default mounts a plain draw of the shared geometry. */
export type ChainDrawFactory = (spec: ChainDrawSpec) => ReactNode;

/**
 * One pass of a chain, recursive. The starting pass draws nothing of its own; every
 * deeper pass draws itself and resolves its own continuation, so the arrival mounts
 * the link when its file lands. A stencil-reading pass draws nothing and the walk
 * continues past it; a pass whose material already drew is cut, drawing each material
 * of a hand-written cycle once.
 *
 * @canonical One pass of a material's next_pass chain
 */
export function NextPassLink(props: PassProps) {
  const { source, ordinal, drawsSelf, visited, geometry, attach, surfaceCount, onOrdinal, draw, shadow } =
    props;
  const loaded = useMaterial(source);
  const material = readyMaterial(loaded);
  const scalars = useMemo(
    () => (material ? parseStandardMaterial3DScalars(material.resource.data) : null),
    [material]
  );
  // Stable between loads: a re-render of an already-loaded link re-scans nothing.
  const nextSource = useMemo(
    () => (material && scalars ? resolveNextPass(scalars.nextPass, material) : undefined),
    [material, scalars]
  );
  const nextVisited = useMemo(() => visitedWith(visited, source), [visited, source]);
  // The pass's fate reported once it is known, in the layout pass: a resolved one
  // reached its position whether it drew or was skipped over, and a declined one ends
  // its chain there. A pass still loading waits, and the overlay's own order then
  // moves past it in the same frame the link draws, before paint.
  useLayoutEffect(() => {
    if (material || loaded.status === 'declined') onOrdinal?.(ordinal);
  }, [loaded.status, material, ordinal, onOrdinal]);

  // A pass whose material already drew on this surface is cut: the walk drew it once
  // and continued through it already, so its repeat ends here.
  if (source && visited.has(materialSourceKey(source))) return null;
  if (!material || !scalars || !source) return null;

  const continuation =
    nextSource !== undefined ? (
      <NextPassLink
        source={nextSource}
        ordinal={ordinal + 1}
        drawsSelf
        visited={nextVisited}
        geometry={geometry}
        attach={attach}
        surfaceCount={surfaceCount}
        draw={draw}
        onOrdinal={onOrdinal}
        primitive={props.primitive}
        skeleton={props.skeleton}
        godotLayers={props.godotLayers}
        shadow={shadow}
      />
    ) : null;
  // No stencil buffer is requested, so a stencil-reading link draws nothing and the
  // walk continues past it at the next ordinal, the starting pass's draw kept.
  if (scalars.readsStencil) return continuation;
  if (!geometry) return null;
  const site: ChainDrawSpec = {
    source,
    ordinal,
    attach,
    surfaceCount,
    geometry,
    primitive: props.primitive,
    skeleton: props.skeleton,
    godotLayers: props.godotLayers,
    shadow,
  };
  return (
    <>
      {drawsSelf && (draw ? draw(site) : <ChainDraw {...site} />)}
      {continuation}
    </>
  );
}

/**
 * The visited set the next pass walks with: every key so far, plus this pass's own. The
 * imperative GLB walk shares it, so a hand-written cycle draws each material once on
 * both.
 *
 * @canonical The visited set of a next_pass chain walk
 */
export function visitedWith(
  visited: ReadonlySet<string>,
  source: MaterialSource | undefined
): ReadonlySet<string> {
  if (!source) return visited;
  const own = materialSourceKey(source);
  if (visited.has(own)) return visited;
  return new Set([...visited, own]);
}

/**
 * One part's next_pass chain across all of its draw groups, plus the part's overlay
 * mount through its own factory, whose draw lands one past the greatest ordinal any
 * chain reached — `MATERIAL_OVERLAY_RENDER_ORDER` for a part with no chain. Mounts
 * nothing extra for a part whose every group resolves to no chain.
 */
export function NextPassChain({
  meshRef,
  geometry: ownGeometry,
  sources,
  overlay,
  draw,
  primitive,
  skeleton,
  godotLayers,
  shadow,
}: {
  /** The base draw, whose geometry every extra draw shares. */
  meshRef?: RefObject<THREE.Object3D | null>;
  /** The geometry every extra draw shares, where the owner holds it directly. */
  geometry?: THREE.BufferGeometry | null;
  /** The per-group starting materials, override applied. */
  sources: readonly (MaterialSource | undefined)[];
  /** Renders the part's overlay draw, at the explicit order one past the surface chains. */
  overlay?: (renderOrder: number) => ReactNode;
  /** Renders each pass's own draw when the owner's object is instanced or placed. */
  draw?: ChainDrawFactory;
  /** The base draws points, so the chain draws do too. */
  primitive: SurfacePrimitive;
  /** The skeleton that skins a skinned base's chain links, or null for an unskinned draw. */
  skeleton?: THREE.Skeleton | null;
  /** The node's `layers` mask, which its chain draws carry for the decals and probes. */
  godotLayers: number;
  shadow: ShadowCastingEffects;
}) {
  // Owners that hold their geometry directly leave the read-back nothing to read: a
  // stable ref keeps the hook whole without one.
  const readBackRef = useRef<THREE.Object3D | null>(null);
  const readBack = useDrawnGeometry(meshRef ?? readBackRef);
  const geometry = ownGeometry !== undefined ? ownGeometry : readBack;
  const [reached, setReached] = useState(0);
  const onOrdinal = useCallback(
    (ordinal: number) => setReached((greatest) => Math.max(greatest, ordinal)),
    []
  );
  const groups = surfaceSources(sources);
  return (
    <>
      {groups.map((source, group) => (
        <NextPassLink
          key={group}
          source={source}
          ordinal={0}
          drawsSelf={false}
          // The starting pass's own key lands in the set when it recurses; the set
          // holds only what has drawn, so the pass's fate is its own to decide.
          visited={NOTHING_DRAWN}
          geometry={geometry}
          attach={surfaceAttach(group, groups.length)}
          surfaceCount={groups.length}
          draw={draw}
          onOrdinal={onOrdinal}
          primitive={primitive}
          skeleton={skeleton}
          godotLayers={godotLayers}
          shadow={shadow}
        />
      ))}
      {geometry && overlay && overlay(nextPassRenderOrder(reached + 1))}
    </>
  );
}

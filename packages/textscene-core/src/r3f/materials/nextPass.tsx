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
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { materialSourceKey, resolveNextPass, type MaterialSource } from './materialSource';
import { NO_RAYCAST } from './materialOverlay';
import { readyMaterial, useMaterial } from './useMaterial';
import { SurfaceMaterialSlot } from './SurfaceMaterialSlot';
import { surfaceAttach, surfaceSources } from './SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from './useOneSurfaceStartingMaterial';
import type { ShadowCastingEffects } from '../shadowCasting';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';

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
 */
export function drawnElementOf(drawsPoints: boolean, skeleton: THREE.Skeleton | null | undefined) {
  return skeleton && !drawsPoints
    ? { Drawn: 'skinnedMesh' as const, skin: { skeleton, bindMode: THREE.DetachedBindMode } }
    : { Drawn: drawsPoints ? ('points' as const) : ('mesh' as const), skin: {} };
}

/**
 * Reads the geometry off the base draw, in place across re-parses. Dep-less, since a
 * re-parse replaces the geometry and a `[ref]` list would keep the old one; the updater
 * returns the same value when nothing moved, so the pair cannot loop. The layout pass
 * swaps a re-parsed geometry before paint, and on mount it runs before the parent's
 * ref lands, so the passive pass reads the first geometry.
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
  /** The base draws points, so the chain draw does too. */
  drawsPoints: boolean;
  /** The base is skinned, so a chain draw is skinned by the same skeleton. */
  skeleton?: THREE.Skeleton | null;
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
  drawsPoints,
  skeleton,
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
  const { Drawn, skin } = drawnElementOf(drawsPoints, skeleton);
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
    >
      <SurfaceMaterialSlot source={source} attach={attach} points={drawsPoints ? 'mesh' : undefined} />
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
  /** Reports the greatest walked position, so an overlay mounts one past it. */
  onOrdinal?: (ordinal: number) => void;
} & ChainDrawBase;

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
  const { source, ordinal, drawsSelf, visited, geometry, attach, surfaceCount, onOrdinal, shadow } = props;
  const loaded = useMaterial(source);
  const material = readyMaterial(loaded);
  const scalars = useMemo(
    () => (material ? parseStandardMaterial3DScalars(material.resource.data) : null),
    [material]
  );
  // The pass's fate reported once it is known: a resolved one reached its position
  // whether it drew or was skipped over, and a declined one ends its chain there. A
  // pass still loading waits, and the overlay's own order then moves past it, in
  // place, in the same frame the link draws.
  useEffect(() => {
    if (material || loaded.status === 'declined') onOrdinal?.(ordinal);
  }, [loaded.status, material, ordinal, onOrdinal]);

  // A pass whose material already drew on this surface is cut: the walk drew it once
  // and continued through it already, so its repeat ends here.
  if (source && visited.has(materialSourceKey(source))) return null;
  if (!material || !scalars || !source) return null;

  const nextSource = resolveNextPass(scalars.nextPass, material);
  const continuation =
    nextSource !== undefined ? (
      <NextPassLink
        source={nextSource}
        ordinal={ordinal + 1}
        drawsSelf
        visited={visitedWith(visited, source)}
        geometry={geometry}
        attach={attach}
        surfaceCount={surfaceCount}
        onOrdinal={onOrdinal}
        drawsPoints={props.drawsPoints}
        skeleton={props.skeleton}
        shadow={shadow}
      />
    ) : null;
  // No stencil buffer is requested, so a stencil-reading link draws nothing and the
  // walk continues past it at the next ordinal, the starting pass's draw kept.
  if (scalars.readsStencil) return continuation;
  if (!geometry) return null;
  return (
    <>
      {drawsSelf && (
        <ChainDraw
          geometry={geometry}
          source={source}
          ordinal={ordinal}
          attach={attach}
          surfaceCount={surfaceCount}
          drawsPoints={props.drawsPoints}
          skeleton={props.skeleton}
          shadow={shadow}
        />
      )}
      {continuation}
    </>
  );
}

/** The visited set the next pass walks with: every key so far, plus this pass's own. */
function visitedWith(visited: ReadonlySet<string>, source: MaterialSource | undefined): ReadonlySet<string> {
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
  sources,
  overlay,
  drawsPoints,
  shadow,
}: {
  /** The base draw, whose geometry every extra draw shares. */
  meshRef: RefObject<THREE.Object3D | null>;
  /** The per-group starting materials, override applied. */
  sources: readonly (MaterialSource | undefined)[];
  /** Renders the part's overlay draw, at the explicit order one past the surface chains. */
  overlay?: (renderOrder: number) => ReactNode;
  /** The base draws points, so the chain draws do too. */
  drawsPoints: boolean;
  shadow: ShadowCastingEffects;
}) {
  const geometry = useDrawnGeometry(meshRef);
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
          visited={new Set()}
          geometry={geometry}
          attach={surfaceAttach(group, groups.length)}
          surfaceCount={groups.length}
          onOrdinal={onOrdinal}
          drawsPoints={drawsPoints}
          shadow={shadow}
        />
      ))}
      {geometry && overlay && overlay(nextPassRenderOrder(reached + 1))}
    </>
  );
}

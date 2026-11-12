/**
 * The surfaced mesh drawer: draws a decoded mesh with the material of each surface, once as a
 * body or at every instance of a buffer. It owns each draw's object, the surface slots, the
 * `next_pass` chains, the overlay, the shadow hooks, the layers and the instance buffer, which the
 * enclosing GeometryInstance3D base feeds (`useInstanceDraw`).
 */

import { useRef, type ReactNode, type RefObject } from 'react';
import type * as THREE from 'three';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';
import { InstancePasses } from '../materials/InstancePasses';
import type { MaterialSource } from '../materials/materialSource';
import { drawnElementOf } from '../materials/nextPass';
import { drawnTag } from '../meshes/meshContent';
import { node3dGroupSpread, type NodeTransform } from '../nodeTransform';
import { drawHookProps } from '../shadowCasting';
import { useInstanceDraw, type OwnInstanceDraw } from '../visibilityRange/geometryInstance';
import { visualLayersUserData } from '../visualLayers';
import { InstancedParts } from './InstancedParts';
import type { MeshInstances } from './meshInstances';

/** The surfaces of a mesh that one three object draws: a draw group for each, and its material. */
export interface MeshPart {
  geometry: THREE.BufferGeometry;
  /** The material of each draw group, before `material_override`. Undefined is Godot's default surface. */
  materials: readonly (MaterialSource | undefined)[];
}

/** What a mesh at one place draws its triangles or its points as. */
type DrawnBody = THREE.Mesh | THREE.Points;

/** The object of a mesh drawn once: the first part's draw, which holds every later part. */
interface MeshBody {
  /** Lands on the body, for a caller that measures or places what it draws. */
  ref?: RefObject<DrawnBody | null>;
  name?: string;
  /** Where the body sits under its parent. Omitted, at the parent's own place. */
  transform?: NodeTransform;
}

interface AtOnePlace {
  instances?: undefined;
  body?: MeshBody;
  /** The skeleton that skins the first part's triangles, or null for an unskinned draw. */
  skeleton?: THREE.Skeleton | null;
  /**
   * The instance has no bounds, so Godot places none of its surfaces. The body stays the object
   * its first part draws as, so a mesh that gains its bounds back keeps its body mounted.
   */
  isUnplaced?: boolean;
  /**
   * Mounts inside the body after the parts. A mesh with no part still mounts the body, so what a
   * caller mounts here stays mounted while its mesh loads.
   */
  children?: ReactNode;
}

interface AtEveryInstance {
  /** The buffer of instances every part draws at. */
  instances: MeshInstances;
  /**
   * The shadow hooks and the layers of a caller under no GeometryInstance3D: a GridMap tile,
   * which Godot draws as an instance of its own. Omitted, the enclosing base hands them over.
   */
  owner?: OwnInstanceDraw;
}

type SurfacedMeshDrawerProps = { parts: readonly MeshPart[] } & (AtOnePlace | AtEveryInstance);

export function SurfacedMeshDrawer(props: SurfacedMeshDrawerProps) {
  if (props.instances) return <InstancedParts {...props} />;
  return <BodyParts {...props} />;
}

/** The spread of a body with no transform of its own, which leaves the object's defaults alone. */
const AT_PARENT = {};

function BodyParts({
  parts,
  body = {},
  skeleton,
  isUnplaced = false,
  children,
}: { parts: readonly MeshPart[] } & AtOnePlace) {
  const { shadow, layers } = useInstanceDraw();
  const ownRef = useRef<DrawnBody | null>(null);
  const bodyRef = body.ref ?? ownRef;
  const [first, ...later] = parts;
  // The body is the first part's draw, and a mesh holds its triangles before its points.
  const { Drawn, skin } = drawnElementOf(
    first !== undefined && geometryDrawsPoints(first.geometry),
    skeleton
  );
  const placed = body.transform ? node3dGroupSpread(body.transform) : AT_PARENT;
  return (
    <Drawn
      {...skin}
      ref={bodyRef}
      name={body.name}
      {...placed}
      // Not `visible = false` for SHADOWS_ONLY: `WebGLShadowMap.renderObject` would skip the
      // shadow pass and the children. The hooks skip each colour draw.
      {...drawHookProps(shadow)}
      userData={visualLayersUserData(layers)}
    >
      {first && !isUnplaced && <PartPasses part={first} drawRef={bodyRef} skeleton={skeleton} />}
      {!isUnplaced && later.map((part, index) => <LaterPart key={index} part={part} />)}
      {children}
    </Drawn>
  );
}

/**
 * A part after the first: the points of a mesh that also holds triangles. A child of the body, so
 * it shares the body's place, with passes of its own, as Godot draws the overlay over every surface.
 */
function LaterPart({ part }: { part: MeshPart }) {
  const { shadow, layers } = useInstanceDraw();
  const drawRef = useRef<DrawnBody | null>(null);
  const Drawn = drawnTag(geometryDrawsPoints(part.geometry));
  return (
    <Drawn ref={drawRef} {...drawHookProps(shadow)} userData={visualLayersUserData(layers)}>
      <PartPasses part={part} drawRef={drawRef} />
    </Drawn>
  );
}

/** The geometry of a part and the passes its instance draws it in, mounted inside the part's draw. */
function PartPasses({
  part,
  drawRef,
  skeleton,
}: {
  part: MeshPart;
  drawRef: RefObject<DrawnBody | null>;
  skeleton?: THREE.Skeleton | null;
}) {
  return (
    <>
      <primitive object={part.geometry} attach="geometry" />
      <InstancePasses
        meshRef={drawRef}
        sources={part.materials}
        drawsPoints={geometryDrawsPoints(part.geometry)}
        skeleton={skeleton}
      />
    </>
  );
}

/**
 * The editor gizmo of a LightmapGI: the edges between the capture probes of its baked data, and a
 * sphere at each probe lit by its spherical harmonics (`lightmap_gi_gizmo_plugin.cpp:83-223`). The
 * component mounts it in a selected-only `PluginGizmo`.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { boxlessUserData } from '../../../r3f/bounds';
import { GizmoGroup } from '../../../r3f/components/GizmoGroup';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { viewportProgramInputs } from '../../../r3f/materialProgramInputs';
import { pixelDitherFade } from '../../../r3f/materials/godotPixelDitherFade';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import {
  probeEdgeSegments,
  readCaptureProbes,
  type CaptureProbes,
} from '../../../resources/lightmapgidata/captureProbes';
import { probeSphereMesh } from './probeSpheres';

/** LightmapGI::get_aabb is `AABB()` (`lightmap_gi.cpp:1622`), so the gizmo adds nothing to the selection box. */
const BOXLESS_USER_DATA = boxlessUserData();

/** `editors/3d_gizmos/gizmo_colors/lightmap_lines` (`editor_settings.cpp:891`). */
const GIZMO_COLOR = Object.freeze({ r: 0.5, g: 0.6, b: 1 });

/** The alpha of `lightmap_lines_material` (`lightmap_gi_gizmo_plugin.cpp:41-45`). */
const LINE_ALPHA = 0.1;

/** `editors/3d_gizmos/gizmo_settings/lightmap_gi_probe_size` (`editor_settings.cpp:909`). */
const PROBE_SIZE = 0.4;

const SPHERE_RADIUS = PROBE_SIZE * 0.5;

/** The probe material fades out between half and one and a half probe sizes (`:51-52`). */
const SPHERE_FADE = pixelDitherFade(PROBE_SIZE * 0.5, PROBE_SIZE * 1.5);

export function LightmapGIGizmo({ probeData }: { probeData: string | undefined }) {
  const probes = useMemo(() => readCaptureProbes(probeData), [probeData]);
  if (probes === null) return null;
  return (
    <>
      <ProbeEdges probes={probes} />
      <ProbeSpheres probes={probes} />
    </>
  );
}

function ProbeEdges({ probes }: { probes: CaptureProbes }) {
  const edges = useMemo(() => probeEdgeSegments(probes), [probes]);
  return (
    <GizmoLine isBoxless positions={edges} color={useGodotLinearColor(GIZMO_COLOR)} opacity={LINE_ALPHA} />
  );
}

/** Unshaded, lit by vertex colours Godot reads as linear (`FLAG_SRGB_VERTEX_COLOR` off), with no fog (`:53-55`). */
const SPHERE_MATERIAL = viewportProgramInputs({
  props: { injection: SPHERE_FADE },
  merge: [{ vertexColors: true, fog: false }],
});

function ProbeSpheres({ probes }: { probes: CaptureProbes }) {
  const geometry = useMemo(() => {
    const { positions, colors, indices } = probeSphereMesh(probes, SPHERE_RADIUS);
    const built = new THREE.BufferGeometry();
    built.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    built.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    built.setIndex(new THREE.BufferAttribute(indices, 1));
    return built;
  }, [probes]);
  useDisposeOnRelease(geometry);
  return (
    <GizmoGroup>
      <mesh geometry={geometry} userData={BOXLESS_USER_DATA}>
        <meshBasicMaterial key={SPHERE_MATERIAL.key} {...SPHERE_MATERIAL.props} />
      </mesh>
    </GizmoGroup>
  );
}

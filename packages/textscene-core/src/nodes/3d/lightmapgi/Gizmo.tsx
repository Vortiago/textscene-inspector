/**
 * The editor gizmo of a LightmapGI: the edges between the capture probes of its baked data
 * (`lightmap_gi_gizmo_plugin.cpp:83-124`). The component mounts it in a selected-only `PluginGizmo`.
 */

import { useMemo } from 'react';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../r3f/godotColor';
import { probeEdgeSegments, readCaptureProbes } from '../../../resources/lightmapgidata/captureProbes';

/** `editors/3d_gizmos/gizmo_colors/lightmap_lines` (`editor_settings.cpp:891`). */
const GIZMO_COLOR = Object.freeze({ r: 0.5, g: 0.6, b: 1 });

/** The alpha of `lightmap_lines_material` (`lightmap_gi_gizmo_plugin.cpp:41-45`). */
const LINE_ALPHA = 0.1;

export function LightmapGIGizmo({ probeData }: { probeData: string | undefined }) {
  const edges = useMemo(() => {
    const probes = readCaptureProbes(probeData);
    return probes && probeEdgeSegments(probes);
  }, [probeData]);
  const color = useGodotLinearColor(GIZMO_COLOR);
  return edges && <GizmoLine positions={edges} color={color} opacity={LINE_ALPHA} />;
}

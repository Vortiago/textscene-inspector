/**
 * `<ConnectionLine>` — one resolved GraphEdit connection: the curve
 * (`connectionCurve.ts`, `GraphEdit::get_connection_line`) tessellated and
 * stroked (`connectionStroke.ts`, the shader's fixed AA/rim bands) into a
 * hand-built `BufferGeometry`, painted the same way `<StyleBoxQuad>` paints
 * `border_blend`: vertex colours stay raw sRGB and are decoded per-fragment,
 * because linearising the two endpoint colours before the GPU interpolates
 * between them bends the ramp (`StyleBoxQuad.tsx`'s own doc for the measured
 * error this avoids).
 *
 * Positions bake their own Y flip (`connectionStroke.ts`), so this renders a
 * bare `<mesh>` with no wrapping flip group — `Line2D`'s own pattern for a
 * hand-built stroke, not `StyleBoxQuad`'s (whose geometry module emits
 * un-flipped absolute coordinates instead). Being a raw mesh rather than a
 * `<ControlQuad>`/`<StyleBoxQuad>`, it spreads `useControlClipPlanes()` on
 * its own account (`nativeClipCoverage.test.tsx`'s own doc).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { canvasItemFacing } from '../../../../r3f/canvasItemFacing';
import { useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { materialProgramInputs, type ProgramInjection } from '../../../../r3f/materialProgramInputs';
import { multiplyModulate, type RGBA } from '../../../../r3f/canvasItemModulate';
import type { ControlColor } from '../control/types';
import { connectionControlPoints, tessellateConnectionLine } from './connectionCurve';
import { connectionStrokeGeometry } from './connectionStroke';
import type { ResolvedConnection } from './connectionEndpoints';

export interface ConnectionLineProps {
  connection: ResolvedConnection;
  curvature: number;
  lineWidth: number;
  rimColor: ControlColor;
  tintOwn: RGBA;
  renderOrder: number;
}

function toStrokeColor(c: ControlColor): RGBA {
  return { r: c.r, g: c.g, b: c.b, a: c.a };
}

export function ConnectionLine({ connection, curvature, lineWidth, rimColor, tintOwn, renderOrder }: ConnectionLineProps) {
  const clippingPlanes = useControlClipPlanes();
  const geometry = useMemo(() => {
    const controlPoints = connectionControlPoints(connection.from.pos, connection.to.pos, curvature);
    const points = tessellateConnectionLine(controlPoints, curvature);
    const from = toStrokeColor(multiplyModulate(tintOwn, connection.from.color));
    const to = toStrokeColor(multiplyModulate(tintOwn, connection.to.color));
    const rim = toStrokeColor(multiplyModulate(tintOwn, rimColor));
    const { positions, indices, colors } = connectionStrokeGeometry(points, lineWidth, from, to, rim);
    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setIndex(indices);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 4));
    return geo;
  }, [connection, curvature, lineWidth, rimColor, tintOwn]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  const program = materialProgramInputs({
    props: {
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      injection: CONNECTION_SRGB_VERTEX_COLORS,
      clippingPlanes: clippingPlanes as THREE.Plane[],
    },
    merge: [canvasItemFacing()],
  });

  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

/** Shared with the minimap's own polyline (`MinimapChrome.tsx`), which colours its vertices the same way. */
export const CONNECTION_SRGB_VERTEX_COLORS: ProgramInjection = {
  cacheKey: 'godot-graphedit-connection-srgb-vertex-colors',
  onBeforeCompile: decodeVertexColorsFromSRGB,
};

/** `Color::srgb_to_linear`, applied to the interpolated vertex colour — `StyleBoxQuad.tsx`'s own copy, for the same reason. */
function decodeVertexColorsFromSRGB(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    /* glsl */ `
    vec3 godotSrgbToLinear = mix(
      pow((vColor.rgb + 0.055) / 1.055, vec3(2.4)),
      vColor.rgb / 12.92,
      step(vColor.rgb, vec3(0.04045))
    );
    diffuseColor *= vec4(godotSrgbToLinear, vColor.a);
    `
  );
}

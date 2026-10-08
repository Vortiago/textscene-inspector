/**
 * `<ConnectionLine>`: one resolved GraphEdit connection, the curve of `connectionCurve.ts`
 * (`GraphEdit::get_connection_line`) stroked by `connectionStroke.ts` into a `BufferGeometry`.
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
import { materialProgramInputs } from '../../../../r3f/materialProgramInputs';
import { CANVAS_SRGB_DEFINES } from '../../../../r3f/canvasSrgbMultiply';
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

export function ConnectionLine({
  connection,
  curvature,
  lineWidth,
  rimColor,
  tintOwn,
  renderOrder,
}: ConnectionLineProps) {
  // A raw mesh, so it applies the clip planes itself (`nativeClipCoverage.test.tsx`).
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
      // sRGB vertex colours, ramped as Godot ramps them (`canvasSrgbMultiply.ts`).
      defines: CANVAS_SRGB_DEFINES,
      clippingPlanes: clippingPlanes as THREE.Plane[],
    },
    merge: [canvasItemFacing()],
  });

  // The positions carry their own Y flip (`connectionStroke.ts`), so no flip group wraps the
  // mesh, as for `Line2D`.
  return (
    <mesh renderOrder={renderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial key={program.key} {...program.props} />
    </mesh>
  );
}

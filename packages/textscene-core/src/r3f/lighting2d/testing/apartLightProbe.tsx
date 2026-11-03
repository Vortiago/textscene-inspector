/**
 * Records what each light hands the pass for a normal-mapped item, without one: its declaration and
 * its placer. It wraps the canvas's lighting and passes every call on.
 */

import { useCallback, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import {
  CanvasLighting2DContext,
  useCanvasLighting2D,
  type ApartPlacer,
  type CanvasLighting2D,
} from '../lightPassContext';
import type { CanvasLightDeclaration } from '../itemLightList';

/** What the lights under a `RecordApartLights` handed the pass, by ordinal. */
export interface ApartLightRecord {
  readonly declarations: Map<number, CanvasLightDeclaration>;
  readonly placers: Map<number, ApartPlacer>;
}

export function apartLightRecord(): ApartLightRecord {
  return { declarations: new Map(), placers: new Map() };
}

/** Where light `ordinal` places itself now. */
export function placeOf(record: ApartLightRecord, ordinal: number): THREE.Vector3 {
  const place = new THREE.Vector3();
  record.placers.get(ordinal)!(place);
  return place;
}

export function RecordApartLights({ record, children }: { record: ApartLightRecord; children: ReactNode }) {
  const lighting = useCanvasLighting2D();
  // Stable while the pass's own registrars are, as a light re-declares when its registrar changes.
  const { registerLight: passRegisterLight, registerApartPlacer: passRegisterApartPlacer } = lighting;
  const registerLight = useCallback<CanvasLighting2D['registerLight']>(
    (declaration) => {
      const slot = passRegisterLight(declaration);
      record.declarations.set(slot.ordinal, declaration);
      return slot;
    },
    [passRegisterLight, record]
  );
  const registerApartPlacer = useCallback<CanvasLighting2D['registerApartPlacer']>(
    (ordinal, placer) => {
      record.placers.set(ordinal, placer);
      return passRegisterApartPlacer(ordinal, placer);
    },
    [passRegisterApartPlacer, record]
  );
  const value = useMemo<CanvasLighting2D>(
    () => ({ ...lighting, registerLight, registerApartPlacer }),
    [lighting, registerLight, registerApartPlacer]
  );
  return <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>;
}

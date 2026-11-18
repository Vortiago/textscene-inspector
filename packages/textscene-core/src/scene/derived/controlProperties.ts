import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import { degToRadf, radToDegf } from '../../godot/math/math.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { numberOf, realValue } from './valueOf.js';

/** `Side` (`math_defs.h:84-89`), in the order `data.anchor` and `data.offset` index them. */
const SIDES = ['left', 'top', 'right', 'bottom'] as const;

const ANCHOR_SIDES: ReadonlyMap<string, number> = new Map(
  SIDES.map((side, index) => [`anchor_${side}`, index])
);

/** Control's `rotation_degrees` and the anchor setter, which can move the opposite anchor too. */
export class ControlProperties implements DerivedProperties {
  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'rotation_degrees') return undefined;
    return realValue(radToDegf(numberOf(stored('rotation'))));
  }

  set(property: string, value: VariantValue, reads: NodeReads): readonly StoredWrite[] | undefined {
    if (property === 'rotation_degrees') return [['rotation', realValue(degToRadf(numberOf(value)))]];
    const side = ANCHOR_SIDES.get(property);
    return side === undefined ? undefined : setAnchor(side, numberOf(value), reads);
  }
}

/** `_set_anchor` keeps the offsets and pushes the opposite anchor (`control.cpp:758-789`, `.h:495`). */
function setAnchor(side: number, anchor: number, { stored }: NodeReads): readonly StoredWrite[] {
  const opposite = (side + 2) % 4;
  const moved = f(anchor);
  const oppositeAnchor = numberOf(stored(`anchor_${SIDES[opposite]}`));
  const isPastOpposite = side < 2 ? moved > oppositeAnchor : moved < oppositeAnchor;
  return [
    [`anchor_${SIDES[side]}`, realValue(moved)],
    ...(isPastOpposite ? [[`anchor_${SIDES[opposite]}`, realValue(moved)] as const] : []),
  ];
}

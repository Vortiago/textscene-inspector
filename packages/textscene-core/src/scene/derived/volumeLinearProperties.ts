import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { dbToLinear, linearToDb } from './decibels.js';
import { numberOf, realValue } from './valueOf.js';

/** An AudioStreamPlayer's `volume_linear` over `volume_db` (`audio_stream_player.cpp:83-89`). */
export class VolumeLinearProperties implements DerivedProperties {
  storedWritten(): void {}

  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'volume_linear') return undefined;
    return realValue(dbToLinear(numberOf(stored('volume_db'))));
  }

  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    if (property !== 'volume_linear') return undefined;
    return [['volume_db', realValue(linearToDb(numberOf(value)))]];
  }
}

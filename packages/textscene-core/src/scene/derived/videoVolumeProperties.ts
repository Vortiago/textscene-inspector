import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { dbToLinear, linearToDb } from './decibels.js';
import { numberOf, realValue } from './valueOf.js';

/** `video_stream_player.cpp:420-426`: a level this low sets the volume to silence. */
const SILENT_BELOW_DB = -79;
/** `get_volume_db` answers this for silence (`video_stream_player.cpp:428-434`). */
const SILENCE_DB = -80;

/** VideoStreamPlayer's `volume`, kept exactly as written until `volume_db` is, as Godot keeps it. */
export class VideoVolumeProperties implements DerivedProperties {
  /** Written by `set`. Cleared by a write of `volume_db`. */
  private volume: number | null = null;

  storedWritten(property: string): void {
    if (property === 'volume_db') this.volume = null;
  }

  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'volume') return undefined;
    if (this.volume !== null) return realValue(this.volume);
    const db = numberOf(stored('volume_db'));
    return realValue(db < SILENT_BELOW_DB ? 0 : dbToLinear(db));
  }

  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    if (property !== 'volume') return undefined;
    this.volume = f(numberOf(value));
    return [['volume_db', realValue(this.volume === 0 ? SILENCE_DB : linearToDb(this.volume))]];
  }
}

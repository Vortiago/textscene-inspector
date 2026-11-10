/**
 * Theora video slice, foreign-format kind (ADR-0031): Godot loads any `.ogv` as a `VideoStreamTheora`
 * (`modules/theora/video_stream_theora.cpp:792-823`). `parse.ts` reads its picture size into a
 * ParsedResource on the generic `resource` bus slot, and no frame is decoded.
 */

import { registerResourceSlice } from '../../sliceRegistration';
import { parseTheoraVideo } from './parse';

/**
 * Theora's three header packets sit on the first pages of the file, ahead of any frame. 1 MiB
 * leaves room for a large comment header, and reads a hundredth of a 100 MB clip.
 */
const THEORA_HEADER_BYTES = 1024 * 1024;

registerResourceSlice({
  slice: 'theoravideo',
  kind: 'foreign-format',
  typeNames: [],
  // The one extension Godot's Theora loader recognises (`video_stream_theora.cpp:792-823`).
  extensions: ['.ogv'],
  parseBytes: parseTheoraVideo,
  headBytes: THEORA_HEADER_BYTES,
  binaryBytes: true,
  busType: 'resource',
});

/**
 * Theora video slice, foreign-format kind (ADR-0031): Godot loads any `.ogv` as a `VideoStreamTheora`
 * (`modules/theora/video_stream_theora.cpp:792-823`). `parse.ts` reads its picture size into a
 * ParsedResource on the generic `resource` bus slot, and no frame is decoded.
 */

import { registerResourceSlice } from '../../sliceRegistration';
import { parseTheoraVideo } from './parse';

registerResourceSlice({
  slice: 'theoravideo',
  kind: 'foreign-format',
  typeNames: [],
  extensions: ['.ogv'],
  parseBytes: parseTheoraVideo,
  binaryBytes: true,
  busType: 'resource',
});

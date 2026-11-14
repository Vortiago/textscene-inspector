/**
 * The underline FreeType gives the face of an sfnt, in design units: `face->underline_position`,
 * the centre of the stroke and below the baseline when negative, and `face->underline_thickness`.
 */
import { tableFits, type SfntFile } from './sfntTables';

export interface SfntUnderline {
  readonly underlinePosition: number;
  readonly underlineThickness: number;
}

const NO_UNDERLINE: SfntUnderline = { underlinePosition: 0, underlineThickness: 0 };

/** `tt_face_load_post` reads a 32-byte frame whole or not at all, and keeps a zeroed one (`ttload.c:1331-1361`). */
const POST_FRAME_LENGTH = 32;
const POST_UNDERLINE_POSITION_OFFSET = 8;
const POST_UNDERLINE_THICKNESS_OFFSET = 10;

/** The outline tables `sfnt_load_face` looks for (`sfobjs.c:870-872`), and the strike tables it reads sizes from (`:876-880`). */
const OUTLINE_TAGS = ['glyf', 'CFF ', 'CFF2'];
const COLOUR_STRIKE_TAGS = ['CBLC', 'CBDT'];
const STRIKE_TAGS = ['EBLC', 'CBLC', 'bloc', 'sbix'];

/**
 * The `post` underline, with the position moved from the top of the stroke to its centre
 * (`sfobjs.c:1421-1426`). FreeType sets it only on a face it scales or whose `sbix` sits over
 * outlines (`:1332-1333`), so a face of bitmap strikes alone has none.
 */
export function readSfntUnderline(sfnt: SfntFile): SfntUnderline {
  const post = sfnt.tables.get('post');
  if (!post || !tableFits(sfnt.dv, post, POST_FRAME_LENGTH) || !hasScaledMetrics(sfnt)) return NO_UNDERLINE;
  const position = sfnt.dv.getInt16(post.offset + POST_UNDERLINE_POSITION_OFFSET, false);
  const thickness = sfnt.dv.getInt16(post.offset + POST_UNDERLINE_THICKNESS_OFFSET, false);
  return { underlinePosition: freeTypeUnderlinePosition(position, thickness), underlineThickness: thickness };
}

/** The `post` position of the top of the stroke, moved to its centre with C's integer halving (`sfobjs.c:1424-1425`). */
export function freeTypeUnderlinePosition(postPosition: number, postThickness: number): number {
  return postPosition - Math.trunc(postThickness / 2);
}

/**
 * `FT_IS_SCALABLE || FT_HAS_SBIX`: outlines that no colour strike overrides (`sfobjs.c:905-906`),
 * or no strike at all, which FreeType marks scalable with empty glyphs (`:1322-1325`).
 */
function hasScaledMetrics({ tables }: SfntFile): boolean {
  const has = (tag: string) => tables.has(tag);
  const hasOutline = OUTLINE_TAGS.some(has) && !COLOUR_STRIKE_TAGS.some(has);
  return hasOutline || !STRIKE_TAGS.some(has);
}

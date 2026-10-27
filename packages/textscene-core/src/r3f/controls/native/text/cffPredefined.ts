/**
 * The data a CFF table predefines: StandardEncoding, which a `seac` names its parts through, and the
 * charsets of the Expert and Expert Subset fonts (Adobe Technical Note #5176 Appendices B and C).
 * A font names one of the charsets by its offset, 1 or 2, instead of listing the glyphs.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

/** The string id of each glyph of charset 0, `ISOAdobe`: the ids in order. */
export const ISO_ADOBE_CHARSET: readonly number[] = Array.from({ length: 229 }, (_, sid) => sid);

/** The string id of each glyph of charset 1, `Expert`. */
export const EXPERT_CHARSET: readonly number[] = [
  0, 1, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 13, 14, 15, 99, 239, 240, 241, 242, 243, 244, 245,
  246, 247, 248, 27, 28, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265,
  266, 109, 110, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284,
  285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305,
  306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 158, 155, 163, 319, 320, 321, 322, 323,
  324, 325, 326, 150, 164, 169, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341,
  342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362,
  363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378,
];

/** The string id of each glyph of charset 2, `ExpertSubset`. */
export const EXPERT_SUBSET_CHARSET: readonly number[] = [
  0, 1, 231, 232, 235, 236, 237, 238, 13, 14, 15, 99, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 27,
  28, 249, 250, 251, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 109, 110, 267, 268,
  269, 270, 272, 300, 301, 302, 305, 314, 315, 158, 155, 163, 320, 321, 322, 323, 324, 325, 326, 150, 164,
  169, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346,
];

/** The codes StandardEncoding gives a string id from 96 on, in string id order. */
const UPPER_STANDARD_CODES = [
  161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 177, 178, 179, 180, 182, 183,
  184, 185, 186, 187, 188, 189, 191, 193, 194, 195, 196, 197, 198, 199, 200, 202, 203, 205, 206, 207, 208,
  225, 227, 232, 233, 234, 235, 241, 245, 248, 249, 250, 251,
];

/** The string id StandardEncoding gives `code`, or 0, the `.notdef` glyph, for a code it leaves out. */
export function standardEncodingSid(code: number): number {
  if (code >= 32 && code <= 126) return code - 31;
  const index = UPPER_STANDARD_CODES.indexOf(code);
  return index < 0 ? 0 : 96 + index;
}

/**
 * The importers a font's sidecar names. Their `[params]` become the FontFile's properties
 * (`resource_importer_dynamic_font.cpp:150-200`, `resource_importer_bmfont.cpp:98`).
 */

/** The importer of a raw TrueType, OpenType or WOFF font (`resource_importer_dynamic_font.cpp`). */
export const DYNAMIC_FONT_IMPORTER = 'font_data_dynamic';

/** The importer of a BMFont descriptor (`resource_importer_bmfont.cpp`). */
export const BMFONT_IMPORTER = 'font_data_bmfont';

/** Whether the project's default font builds glyph mipmaps (`gui/theme/default_font_generate_mipmaps`). */

import { projectDefaultFontGeneratesMipmaps } from '../../../parser/projectSettingsParser.js';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext.js';

export function useProjectDefaultFontGeneratesMipmaps(): boolean {
  return projectDefaultFontGeneratesMipmaps(useProjectSettings().settings);
}

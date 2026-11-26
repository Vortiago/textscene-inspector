import { createSettledFonts, type SettledFonts } from '../text/settledFonts';

/** Written by the first call in a test. The test setup clears it before each test. */
let fonts: SettledFonts | null = null;

/** One store of settled fonts for the whole of a test, for a context a test builds with no view. */
export function testSettledFonts(): SettledFonts {
  return (fonts ??= createSettledFonts());
}

export function resetTestSettledFonts(): void {
  fonts = null;
}

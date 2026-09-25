/**
 * The site edition a build produces, for the build scripts and `vite.config.ts`.
 * `src/siteEdition.ts` reads the same variable inside the app, where Vite inlines it.
 *
 * The dev edition (Cloudflare Pages, `pnpm dev`) carries the built-in scenes and the
 * parity gallery. The public edition (GitHub Pages, `pnpm build:pages`) opens only
 * the files a user brings.
 */

/** The value of `VITE_SITE_EDITION` that selects the public edition. Any other is dev. */
export const PUBLIC_SITE_EDITION = 'public';

export function isPublicSiteBuild() {
  return process.env.VITE_SITE_EDITION === PUBLIC_SITE_EDITION;
}

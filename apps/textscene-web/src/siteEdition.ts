/**
 * Whether this build is the public edition: no built-in scenes, no fixture fetches
 * and no parity gallery. `scripts/siteEdition.mjs` holds the build-side half.
 * Vite inlines the value, so the dev-only code behind it drops out of the bundle.
 */
export const IS_PUBLIC_SITE = import.meta.env.VITE_SITE_EDITION === 'public';

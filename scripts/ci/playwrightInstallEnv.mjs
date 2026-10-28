/**
 * The environment `playwright install` needs to download the browser that the lockfile pins.
 * The cloud container sets PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD and bakes an older Chromium, whose
 * Canvas 2D text pixels differ from CI's, so the install must run with the flag removed.
 */

/** A copy of `env` that lets `playwright install` download. The browsers path stays as given. */
export function playwrightInstallEnv(env) {
  const installEnv = { ...env };
  delete installEnv.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  return installEnv;
}

import { describe, expect, it } from 'vitest';
import { playwrightInstallEnv } from './playwrightInstallEnv.mjs';

describe('playwrightInstallEnv', () => {
  it('drops the flag that makes `playwright install` skip the download', () => {
    const env = playwrightInstallEnv({ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1', HOME: '/root' });

    expect(env).not.toHaveProperty('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD');
  });

  it('keeps the browsers path, so the browser lands where the launch looks for it', () => {
    const env = playwrightInstallEnv({
      PLAYWRIGHT_BROWSERS_PATH: '/opt/pw-browsers',
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    });

    expect(env.PLAYWRIGHT_BROWSERS_PATH).toBe('/opt/pw-browsers');
  });

  it('leaves the given environment unchanged', () => {
    const env = { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' };

    playwrightInstallEnv(env);

    expect(env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD).toBe('1');
  });
});

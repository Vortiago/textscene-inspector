import { readFileSync } from 'node:fs';
import {
  VSCODE_VERSION_ENV,
  vscodeTestVersion,
} from '../../apps/textscene-vscode/src/test/integration/integrationLaunch.ts';

export async function resolveVscodeTestCacheVersion(requested, enginesRange) {
  let version = vscodeTestVersion(requested, enginesRange);
  if (version === 'stable') {
    const response = await fetch('https://update.code.visualstudio.com/api/releases/stable?released=true', {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Could not resolve stable VS Code: HTTP ${response.status}`);
    const releases = await response.json();
    version = Array.isArray(releases) ? releases[0] : undefined;
  }
  if (typeof version !== 'string' || /^\d+\.\d+\.\d+$/.exec(version)?.[0] !== version) {
    throw new Error(`Expected an exact VS Code version, got ${JSON.stringify(version)}`);
  }
  return version;
}

if (import.meta.main) {
  const manifest = JSON.parse(
    readFileSync(new URL('../../apps/textscene-vscode/package.json', import.meta.url), 'utf8')
  );
  console.log(await resolveVscodeTestCacheVersion(process.env[VSCODE_VERSION_ENV], manifest.engines.vscode));
}

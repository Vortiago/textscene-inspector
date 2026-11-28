import { createMockUri, vscode as vscodeMocks } from '../test-setup';
import { ANY_PATH_PATTERN } from '../watchPatterns';

export function fireWorkspacePathEvent(kind: 'onDidCreate' | 'onDidDelete', path: string): void {
  const createWatcher = vscodeMocks.workspace.createFileSystemWatcher;
  const index = createWatcher.mock.calls.map(([pattern]: [string]) => pattern).lastIndexOf(ANY_PATH_PATTERN);
  const watcher = createWatcher.mock.results[index].value;
  watcher[kind].mock.calls.at(-1)[0](createMockUri(path));
}

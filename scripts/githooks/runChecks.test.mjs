import { afterEach, describe, expect, it, vi } from 'vitest';
import { commandLine, runChecks } from './runChecks.mjs';

describe('commandLine', () => {
  it('leaves plain arguments bare', () => {
    expect(commandLine(['npx', 'eslint', '--cache', 'src/a-b.ts'])).toBe('npx eslint --cache src/a-b.ts');
  });

  it('quotes a glob and a brace', () => {
    expect(commandLine(['pnpm', '--filter', './packages/*', '--filter', '...{./apps/web}', 'build'])).toBe(
      "pnpm --filter './packages/*' --filter '...{./apps/web}' build"
    );
  });

  it('escapes a single quote inside a quoted argument', () => {
    expect(commandLine(['echo', "it's"])).toBe("echo 'it'\\''s'");
  });
});

describe('runChecks', () => {
  afterEach(() => vi.restoreAllMocks());

  const silence = () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return vi.spyOn(console, 'error').mockImplementation(() => {});
  };
  const exitWith = (status) => [process.execPath, '-e', `process.exit(${status})`];

  it('returns 0 when every check passes', () => {
    const error = silence();
    expect(runChecks('t', [exitWith(0)])).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('stops at the first failed check and prints the command that reruns it', () => {
    const error = silence();
    expect(runChecks('t', [exitWith(3), exitWith(4)])).toBe(3);
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0].split('\n')).toEqual([
      '',
      't: FAILED check 1 of 2 (exit status 3). Rerun it with:',
      `  ${commandLine(exitWith(3))}`,
    ]);
  });

  it('offers the command that reruns every check when the caller gives one', () => {
    const error = silence();
    runChecks('t', [exitWith(1)], 'pnpm check');
    expect(error.mock.calls[0][0]).toContain('t: rerun every check with: pnpm check');
  });

  it('passes a path with a space and an ampersand as one argument', () => {
    silence();
    const command = [
      process.execPath,
      '-e',
      'process.exit(process.argv[1] === "a&b c.md" ? 0 : 5)',
      'a&b c.md',
    ];
    expect(runChecks('t', [command])).toBe(0);
  });

  it('reports a command that cannot start', () => {
    const error = silence();
    expect(runChecks('t', [['textscene-no-such-command']])).toBe(1);
    expect(error.mock.calls[0][0]).toContain('FAILED check 1 of 1 (did not start');
  });
});

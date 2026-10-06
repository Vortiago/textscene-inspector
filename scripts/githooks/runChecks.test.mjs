import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkName, commandLine, failureSummary, runChecks } from './runChecks.mjs';

describe('checkName', () => {
  it('names a pnpm script', () => {
    expect(checkName(['pnpm', 'type-check:all'])).toBe('type-check:all');
  });

  it('names the tool behind a launcher', () => {
    expect(checkName(['npx', 'eslint', '--cache', 'a.ts'])).toBe('eslint');
    expect(checkName(['pnpm', 'exec', 'prettier', '--cache', '--check', 'a.ts'])).toBe('prettier');
  });

  it('skips a filter and its value', () => {
    expect(checkName(['pnpm', '--filter', '...{./apps/web}', 'type-check'])).toBe('type-check');
  });

  it('falls back to the whole command when every argument is a launcher', () => {
    expect(checkName(['pnpm', 'exec'])).toBe('pnpm exec');
  });
});

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

describe('failureSummary', () => {
  it('names the failed check, its rerun command and pnpm check', () => {
    const summary = failureSummary('pre-push', {
      command: ['npx', 'eslint', '--cache', 'a.ts'],
      position: 2,
      total: 5,
      outcome: 'exit status 1',
    });
    expect(summary.split('\n')).toEqual([
      '',
      'pre-push: FAILED check 2 of 5: eslint (exit status 1)',
      'pre-push: rerun this check with: npx eslint --cache a.ts',
      'pre-push: rerun every push check on your working tree with: pnpm check',
    ]);
  });
});

describe('runChecks', () => {
  afterEach(() => vi.restoreAllMocks());

  const silence = () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return vi.spyOn(console, 'error').mockImplementation(() => {});
  };

  it('returns 0 when every check passes', () => {
    const error = silence();
    expect(runChecks('t', [[process.execPath, '-e', '']])).toBe(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('stops at the first failed check and returns its status', () => {
    const error = silence();
    const plan = [
      [process.execPath, '-e', 'process.exit(3)'],
      [process.execPath, '-e', 'process.exit(4)'],
    ];
    expect(runChecks('t', plan)).toBe(3);
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toContain('t: FAILED check 1 of 2');
  });

  it('reports a command that cannot start', () => {
    const error = silence();
    expect(runChecks('t', [['textscene-no-such-command']])).toBe(1);
    expect(error.mock.calls[0][0]).toMatch(
      /FAILED check 1 of 1: textscene-no-such-command \((did not start|exit status)/
    );
  });
});

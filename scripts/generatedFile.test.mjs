import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkGenerated, replaceMarkedBlock, writeGenerated } from './generatedFile.mjs';

const BEGIN = '<!-- x:begin -->';
const END = '<!-- x:end -->';

describe('replaceMarkedBlock', () => {
  it('replaces the text between the markers and keeps the text around them', () => {
    const text = `intro\n${BEGIN}\nold\n${END}\noutro\n`;
    expect(replaceMarkedBlock(text, BEGIN, END, 'new\n')).toBe(`intro\n${BEGIN}\nnew\n${END}\noutro\n`);
  });

  it('names the begin marker when it is missing', () => {
    expect(() => replaceMarkedBlock(`text\n${END}\n`, BEGIN, END, '')).toThrow(`no ${BEGIN}`);
  });

  it('names the end marker when it is missing', () => {
    expect(() => replaceMarkedBlock(`${BEGIN}\ntext\n`, BEGIN, END, '')).toThrow(`no ${END} after ${BEGIN}`);
  });

  it('names the end marker when it comes before the begin marker', () => {
    expect(() => replaceMarkedBlock(`${END}\n${BEGIN}\n`, BEGIN, END, '')).toThrow(
      `no ${END} after ${BEGIN}`
    );
  });
});

describe('writeGenerated and checkGenerated', () => {
  let dir;
  let logs;
  let errors;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'generated-file-'));
    logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  const printed = (spy) => spy.mock.calls.join('\n');

  /** A file at `name` in the temporary directory that holds `text`. */
  function fileWith(name, text) {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  }

  describe('writeGenerated', () => {
    it('writes a file whose text changed and leaves a fresh one alone', () => {
      const fresh = fileWith('fresh.txt', 'same');
      const changed = fileWith('changed.txt', 'old');
      writeGenerated(
        [
          [fresh, 'same'],
          [changed, 'new'],
        ],
        { tool: 'gen' }
      );
      expect(readFileSync(changed, 'utf8')).toBe('new');
      expect(printed(logs)).toContain('changed.txt');
      expect(printed(logs)).not.toContain('fresh.txt');
    });

    it('creates a missing file in a missing directory', () => {
      const path = join(dir, 'sub/out.txt');
      writeGenerated([[path, 'text']], { tool: 'gen' });
      expect(readFileSync(path, 'utf8')).toBe('text');
    });

    it('says the files are up to date when nothing changed', () => {
      const fresh = fileWith('fresh.txt', 'same');
      writeGenerated([[fresh, 'same']], { tool: 'gen' });
      expect(printed(logs)).toBe('[gen] up to date.');
    });

    it('prints the summary', () => {
      const fresh = fileWith('fresh.txt', 'same');
      writeGenerated([[fresh, 'same']], { tool: 'gen', summary: '3 sheet(s)' });
      expect(printed(logs)).toContain('3 sheet(s)');
    });
  });

  describe('checkGenerated', () => {
    const report = { tool: 'gen', command: 'pnpm gen' };

    it('writes neither a stale nor a missing file', () => {
      const stale = fileWith('stale.txt', 'old');
      const missing = join(dir, 'missing.txt');
      checkGenerated(
        [
          [stale, 'new'],
          [missing, 'text'],
        ],
        report
      );
      expect(readFileSync(stale, 'utf8')).toBe('old');
      expect(existsSync(missing)).toBe(false);
    });

    it('fails the run, naming each stale path and the command that regenerates it', () => {
      const stale = fileWith('stale.txt', 'old');
      const fresh = fileWith('fresh.txt', 'same');
      checkGenerated(
        [
          [stale, 'new'],
          [fresh, 'same'],
        ],
        report
      );
      expect(process.exitCode).toBe(1);
      expect(printed(errors)).toContain('stale.txt');
      expect(printed(errors)).not.toContain('fresh.txt');
      expect(printed(errors)).toContain('`pnpm gen`');
    });

    it('names the first line where a stale file differs', () => {
      const stale = fileWith('stale.txt', 'a\nb\nc\n');
      checkGenerated([[stale, 'a\nb\nX\n']], report);
      expect(printed(errors)).toContain('first difference at line 3');
    });

    it('names a file that one more line would make fresh', () => {
      const stale = fileWith('stale.txt', 'a\n');
      checkGenerated([[stale, 'a\nb\n']], report);
      expect(printed(errors)).toContain('first difference at line 2');
    });

    it('names a missing file as missing', () => {
      checkGenerated([[join(dir, 'missing.txt'), 'text']], report);
      expect(printed(errors)).toContain('missing.txt (missing)');
    });

    it('leaves the exit code alone and says up to date when every file is fresh', () => {
      const fresh = fileWith('fresh.txt', 'same');
      checkGenerated([[fresh, 'same']], report);
      expect(process.exitCode).toBeUndefined();
      expect(printed(logs)).toBe('[gen] up to date.');
    });

    it('prints the summary', () => {
      const stale = fileWith('stale.txt', 'old');
      checkGenerated([[stale, 'new']], { ...report, summary: '3 sheet(s)' });
      expect(printed(errors)).toContain('3 sheet(s)');
    });
  });
});

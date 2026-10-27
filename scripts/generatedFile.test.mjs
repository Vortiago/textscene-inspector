import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceMarkedBlock, writeOrCheck } from './generatedFile.mjs';

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

describe('writeOrCheck', () => {
  const report = { tool: 'gen', command: 'pnpm gen' };
  let dir;
  let errors;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'generated-file-'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('writes a file whose text changed and returns its path', () => {
    const fresh = join(dir, 'fresh.txt');
    const changed = join(dir, 'changed.txt');
    writeFileSync(fresh, 'same');
    writeFileSync(changed, 'old');
    const outputs = [
      [fresh, 'same'],
      [changed, 'new'],
    ];
    expect(writeOrCheck(outputs, { check: false, ...report })).toEqual([changed]);
    expect(readFileSync(changed, 'utf8')).toBe('new');
  });

  it('creates a missing file in a missing directory', () => {
    const path = join(dir, 'sub/out.txt');
    writeOrCheck([[path, 'text']], { check: false, ...report });
    expect(readFileSync(path, 'utf8')).toBe('text');
  });

  it('under check, writes nothing and returns the stale and the missing paths', () => {
    const stale = join(dir, 'stale.txt');
    const missing = join(dir, 'missing.txt');
    writeFileSync(stale, 'old');
    const outputs = [
      [stale, 'new'],
      [missing, 'text'],
    ];
    expect(writeOrCheck(outputs, { check: true, ...report })).toEqual([stale, missing]);
    expect(readFileSync(stale, 'utf8')).toBe('old');
    expect(existsSync(missing)).toBe(false);
  });

  it('under check, fails the run with the command that regenerates a stale file', () => {
    const stale = join(dir, 'stale.txt');
    writeFileSync(stale, 'old');
    writeOrCheck([[stale, 'new']], { check: true, ...report });
    expect(process.exitCode).toBe(1);
    expect(errors.mock.calls.join('\n')).toContain('`pnpm gen`');
  });

  it('under check, leaves the exit code alone when every file is fresh', () => {
    const fresh = join(dir, 'fresh.txt');
    writeFileSync(fresh, 'same');
    expect(writeOrCheck([[fresh, 'same']], { check: true, ...report })).toEqual([]);
    expect(process.exitCode).toBeUndefined();
  });
});

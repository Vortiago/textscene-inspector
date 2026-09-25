/** The severity dot's class list, which a gutter row and the file-level section share. */
import { describe, expect, it } from 'vitest';
import type { Severity } from '@textscene/core/linter';
import { severityDotClass } from './problemClasses';
import styles from './r3f-main.module.css';

const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];

describe('severityDotClass', () => {
  it.each(SEVERITIES)('gives a %s the dot class and its own colour class', (severity) => {
    const classes = severityDotClass(severity).split(' ');
    expect(classes).toContain(styles.severityDot);
    expect(classes.some((name) => new RegExp(severity, 'i').test(name))).toBe(true);
  });

  it('gives each severity a class list of its own', () => {
    expect(new Set(SEVERITIES.map(severityDotClass)).size).toBe(SEVERITIES.length);
  });

  it('names no undefined class, so every severity has its colour rule', () => {
    for (const severity of SEVERITIES) {
      expect(severityDotClass(severity)).not.toMatch(/undefined/);
    }
  });
});

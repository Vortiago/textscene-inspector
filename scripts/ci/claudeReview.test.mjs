/** How the Claude review's answer becomes a pull request review or comment. */
import { describe, expect, it } from 'vitest';
import { commentBody, reviewPayload, SUMMARY_HEADING } from './claudeReview.mjs';

const finding = { path: 'src/a.ts', line: 12, severity: 'important', body: 'The cache never clears.' };

describe('reviewPayload', () => {
  it('puts each finding on its line, marked with its severity', () => {
    expect(reviewPayload({ summary: '1 Important.', findings: [finding] })).toEqual({
      event: 'COMMENT',
      body: `${SUMMARY_HEADING}\n\n1 Important.`,
      comments: [
        { path: 'src/a.ts', line: 12, side: 'RIGHT', body: '🔴 **Important**: The cache never clears.' },
      ],
    });
  });

  it('posts the summary alone when there is no finding', () => {
    expect(reviewPayload({ summary: 'No findings.' }).comments).toEqual([]);
  });

  it('refuses a severity that REVIEW.md does not name', () => {
    expect(() => reviewPayload({ summary: '', findings: [{ ...finding, severity: 'minor' }] })).toThrow(
      /got minor/
    );
  });
});

describe('commentBody', () => {
  it('lists each finding under the summary with its file and line', () => {
    expect(commentBody({ summary: '1 Nit.', findings: [{ ...finding, severity: 'nit' }] })).toBe(
      `${SUMMARY_HEADING}\n\n1 Nit.\n\n- \`src/a.ts:12\` 🟡 **Nit**: The cache never clears.`
    );
  });

  it('is the summary alone when there is no finding', () => {
    expect(commentBody({ summary: 'No findings.', findings: [] })).toBe(`${SUMMARY_HEADING}\n\nNo findings.`);
  });
});

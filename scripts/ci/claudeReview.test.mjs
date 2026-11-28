import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { REPO_ROOT } from '../repoRoot.mjs';

const workflow = parse(readFileSync(join(REPO_ROOT, '.github/workflows/claude-review.yml'), 'utf8'));
const verify = workflow.jobs.review.steps.find((step) => step.name === 'Verify the completed review');
const temp = mkdtempSync(join(tmpdir(), 'claude-review-'));
const script = join(temp, 'verify.cjs');
writeFileSync(script, verify.run);
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const target = `owner/repo/pull/12 (git diff ${'a'.repeat(40)}...${'b'.repeat(40)})`;
const run = { session_id: 'session', task_id: 'review', run_id: 'run' };
const start = {
  ...run,
  type: 'system',
  subtype: 'task_started',
  description: '/code-review',
  task_type: 'local_agent',
  spawn_depth: 1,
  prompt: `Review target: \`${target}\`\n\nReview instructions`,
};
const config = join(temp, 'config');
const transcript = join(
  config,
  'projects',
  'repo',
  run.session_id,
  'subagents',
  `agent-${run.task_id}.jsonl`
);
mkdirSync(dirname(transcript), { recursive: true });
const completed = {
  ...run,
  type: 'system',
  subtype: 'task_notification',
  status: 'completed',
  output_file: transcript,
};
const result = {
  session_id: run.session_id,
  type: 'result',
  subtype: 'success',
  is_error: false,
  num_turns: 0,
  result: 'Code review found no issues.',
};

const foreignTranscript = join(temp, 'foreign.jsonl');
const finding = {
  file: 'example.js',
  line: 1,
  summary: 'Private text.',
  severity: 'nit',
  failure_scenario: 'Example input.',
};

function check(messages, answer = '[]') {
  const entry = {
    type: 'assistant',
    sessionId: run.session_id,
    agentId: run.task_id,
    message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: answer }] },
  };
  writeFileSync(transcript, [entry, { type: 'attachment' }].map((row) => JSON.stringify(row)).join('\n'));
  writeFileSync(foreignTranscript, JSON.stringify(entry));
  const file = join(temp, 'execution.json');
  if (messages) writeFileSync(file, JSON.stringify(messages));
  const summary = join(temp, 'summary.md');
  writeFileSync(summary, '');
  const checked = spawnSync(process.execPath, [script], {
    env: {
      CLAUDE_CONFIG_DIR: config,
      EXECUTION_FILE: messages ? file : '',
      REVIEW_TARGET: target,
      GITHUB_STEP_SUMMARY: summary,
    },
    encoding: 'utf8',
  });
  return { ...checked, summary: readFileSync(summary, 'utf8') };
}

describe('the hosted Claude review', () => {
  it.each([
    ['[]', '0 findings'],
    [JSON.stringify([finding]), '1 finding'],
    ['```json\n' + JSON.stringify([finding, finding]) + '\n```', '2 findings'],
  ])('reports the completed task’s count in the log and summary', (answer, count) => {
    const checked = check([start, completed, result], answer);
    expect(checked.status).toBe(0);
    const receipt = `Claude reviewed ${target}: ${count}.`;
    expect(checked.stdout.trim()).toBe(receipt);
    expect(checked.summary.trim()).toBe(receipt);
  });

  it.each([
    ['workflow validation skip without an execution file', undefined, 'skipped this workflow change'],
    ['missing review', [result], 'start'],
    ['unfinished review', [start, result], 'completion'],
    ['failed review', [start, { ...completed, status: 'failed' }, result], 'failed'],
    ['stopped review', [start, { ...completed, status: 'stopped' }, result], 'stopped'],
    ['another task', [start, { ...completed, task_id: 'other' }, result], 'completion'],
    [
      'resumed task with a shared transcript',
      [start, completed, { ...start, run_id: 'new', prompt: '' }, result],
      'resumed',
    ],
    ['another run', [start, { ...completed, run_id: 'other' }, result], 'completion'],
    ['another head', [{ ...start, prompt: start.prompt.replaceAll('b', 'c') }, completed, result], 'start'],
    ['nested namesake', [{ ...start, spawn_depth: 2 }, completed, result], 'start'],
    ['wrapper error', [start, completed, { ...result, is_error: true }], 'result'],
    ['missing task transcript', [start, { ...completed, output_file: '' }, result], 'task transcript'],
    [
      'foreign task transcript',
      [start, { ...completed, output_file: foreignTranscript }, result],
      'task transcript',
    ],
    ['wrapper wording as the task answer', [start, completed, result], 'findings array', result.result],
    ['malformed finding', [start, completed, result], 'findings array', '[{}]'],
  ])('rejects a %s', (_reason, messages, expected, answer) => {
    const checked = check(messages, answer);
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain(`::error::${target}: `);
    expect(checked.stderr).toContain(expected);
    expect(checked.summary).toBe('');
  });
});

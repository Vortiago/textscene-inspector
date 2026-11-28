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
const diff = `git diff ${'a'.repeat(40)}...${'b'.repeat(40)}`;
const target = `owner/repo/pull/12 (${diff})`;
const request = workflow.jobs.review.steps
  .find((step) => step.id === 'claude')
  .with.prompt.replace('/code-review high --comment ', '')
  .replace('${{ steps.review.outputs.target }}', target);
const run = { session_id: 'session', task_id: 'review', run_id: 'run' };
const start = {
  ...run,
  type: 'system',
  subtype: 'task_started',
  description: '/code-review',
  task_type: 'local_agent',
  spawn_depth: 1,
  prompt: `Review target: \`${request}\`\n\nReview instructions`,
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

const identity = { sessionId: run.session_id, agentId: run.task_id };
const call = { type: 'tool_use', id: 'call', name: 'Bash', input: { command: diff } };
const output = {
  type: 'tool_result',
  tool_use_id: call.id,
  is_error: false,
  content: 'diff --git a/foo b/foo',
};
function inspection(request = call, response = output) {
  return [
    { ...identity, type: 'assistant', message: { content: [request] } },
    { ...identity, type: 'user', message: { content: [response] } },
  ];
}

function check(messages, answer = '[]', reads = inspection()) {
  const entry = {
    type: 'assistant',
    ...identity,
    message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: answer }] },
  };
  writeFileSync(
    transcript,
    [...reads, entry, { type: 'attachment' }].map((row) => JSON.stringify(row)).join('\n')
  );
  writeFileSync(foreignTranscript, readFileSync(transcript));
  const file = join(temp, 'execution.json');
  if (messages) writeFileSync(file, JSON.stringify(messages));
  const summary = join(temp, 'summary.md');
  writeFileSync(summary, '');
  const checked = spawnSync(process.execPath, [script], {
    env: {
      CLAUDE_CONFIG_DIR: config,
      EXECUTION_FILE: messages ? file : '',
      REVIEW_TARGET: target,
      REVIEW_DIFF: diff,
      GITHUB_STEP_SUMMARY: summary,
    },
    encoding: 'utf8',
  });
  return { ...checked, summary: readFileSync(summary, 'utf8') };
}

describe('the hosted Claude review', () => {
  it.each([
    ['[]', '0 findings', inspection(call, { ...output, content: '(Bash completed with no output)' })],
    ['No issues.\n```json\n[]\n```\nFinished.', '0 findings'],
    [JSON.stringify([finding]), '1 finding'],
    ['Reviewed.\n```json\n' + JSON.stringify([finding]) + '\n```\nPosted.', '1 finding'],
    ['```json\n' + JSON.stringify([finding, finding]) + '\n```', '2 findings'],
  ])('reports the completed task’s count in the log and summary', (answer, count, reads) => {
    const checked = check([start, completed, result], answer, reads);
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
    [
      'ambiguous JSON findings',
      [start, completed, result],
      'findings array',
      '```json\n[]\n```\n```json\n[]\n```',
    ],
    ['missing diff read', [start, completed, result], 'git diff', '[]', []],
    [
      'failed diff read',
      [start, completed, result],
      'git diff',
      '[]',
      inspection(call, { ...output, is_error: true }),
    ],
    [
      'wrong range',
      [start, completed, result],
      'git diff',
      '[]',
      inspection({ ...call, input: { command: 'git diff HEAD' } }),
    ],
    [
      'unrelated tool result',
      [start, completed, result],
      'git diff',
      '[]',
      inspection(call, { ...output, tool_use_id: 'x' }),
    ],
    [
      'background diff',
      [start, completed, result],
      'git diff',
      '[]',
      inspection({ ...call, input: { command: diff, run_in_background: true } }),
    ],
    ['malformed finding', [start, completed, result], 'findings array', '[{}]'],
  ])('rejects a %s', (_reason, messages, expected, answer, reads) => {
    const checked = check(messages, answer, reads);
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain(`::error::${target}: `);
    expect(checked.stderr).toContain(expected);
    expect(checked.summary).toBe('');
  });
});

describe('the requested commits', () => {
  const resolve = workflow.jobs.review.steps.find((step) => step.id === 'review');
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const range = `${base}...${head}`;

  it.each([
    ['matching pull request', base, head, 0],
    ['owner comment', '', '', 0],
    ['changed base with the same head', 'c'.repeat(40), head, 1],
    ['changed head with the same base', base, 'c'.repeat(40), 1],
  ])('binds a %s to its requested patch', (_name, eventBase, eventHead, status) => {
    const output = join(temp, 'target.txt');
    writeFileSync(output, '');
    const run = `gh() { echo "$API_RANGE"; }\ngit() { return 0; }\n${resolve.run}`;
    const checked = spawnSync('bash', ['-e', '-c', run], {
      env: {
        PATH: process.env.PATH,
        GITHUB_OUTPUT: output,
        GITHUB_REPOSITORY: 'owner/repo',
        PR_NUMBER: '12',
        GITHUB_EVENT_NAME: eventBase ? 'pull_request' : 'issue_comment',
        EVENT_BASE: eventBase,
        EVENT_HEAD: eventHead,
        API_RANGE: range,
      },
      encoding: 'utf8',
    });
    expect(checked.status).toBe(status);
    expect(readFileSync(output, 'utf8')).toBe(status === 0 ? `diff=${diff}\ntarget=${target}\n` : '');
    if (status !== 0) expect(checked.stdout).toContain('Request another review.');
  });
});

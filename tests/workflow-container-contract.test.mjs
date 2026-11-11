import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/deploy-website.yml', import.meta.url), 'utf8');
const jobs = workflow.split('\n  deploy:\n');
const verify = jobs[0];
const deploy = `  deploy:\n${jobs[1]}`;
const image = 'mcr.microsoft.com/playwright:v1.64.0-noble@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f';

test('both jobs use the exact pinned browser image and skip redundant browser installation', () => {
  assert.equal(jobs.length, 2);
  for (const job of [verify, deploy]) {
    assert.ok(job.includes(`image: ${image}`));
    assert.ok(job.includes("options: --init --shm-size=1g"));
    assert.ok(!job.includes('playwright install'));
    assert.ok(job.includes('git config --global --add safe.directory "$GITHUB_WORKSPACE"'));
    assert.ok(job.includes('python -m venv .venv'));
    assert.ok(job.includes('echo "$GITHUB_WORKSPACE/.venv/bin" >> "$GITHUB_PATH"'));
    assert.ok(job.includes('python -m pip install --requirement requirements-career.txt'));
  }
});

test('production deploy is limited to main push or main manual dispatch', () => {
  assert.match(deploy, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(deploy, /github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(deploy, /github\.event_name != 'pull_request'/);
});

test('all established verification, build, and dry-run commands remain', () => {
  for (const command of [
    'python scripts/build-career.py',
    'python scripts/build-resume.py',
    'npm ci',
    'npm run check',
    'npm run articles:build',
    'npx wrangler deploy',
  ]) assert.ok(workflow.includes(command), `missing command: ${command}`);
});

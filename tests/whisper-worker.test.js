const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const readline = require('node:readline');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

function worker() {
  const children = [];
  const context = { module: { exports: {} }, setTimeout, clearTimeout, require: name => {
    if (name === 'fs') return { existsSync: () => true };
    if (name === 'path') return path;
    if (name === 'readline') return readline;
    if (name.includes('logger')) return { createServiceLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) };
    if (name === 'child_process') return { spawn: () => {
      const child = new EventEmitter();
      Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), requests: [],
        kill() { this.killed = true; },
        stdin: { write(line, callback) { child.requests.push(JSON.parse(line)); callback(); } }
      });
      children.push(child);
      return child;
    } };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/services/whisper-worker.service.js'), 'utf8'), context);
  const service = new context.module.exports();
  service.configure({ pythonPath: 'fake-python', scriptPath: 'fake-worker.py' });
  return { service, children };
}

test('worker timeout kills the stalled process and rejects all requests waiting behind it', async t => {
  const { service, children } = worker();
  t.after(() => service.close());
  const results = await Promise.allSettled([
    service._request({ action: 'warmup' }, 15),
    service._request({ action: 'transcribe' }, 1000)
  ]);
  assert.equal(children[0].killed, true);
  assert.equal(service.process, null);
  assert.equal(service.pending.size, 0);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason.code, 'WHISPER_TIMEOUT');
  }
  const next = service._request({ action: 'transcribe' }, 1000);
  const fresh = children[1];
  children[0].emit('close', 1);
  children[0].stdout.write('{"event":"ready","stale":true}\n');
  assert.equal(service.process, fresh);
  assert.equal(service.readyInfo, null);
  fresh.stdout.write(JSON.stringify({ id: fresh.requests[0].id, ok: true, text: 'new' }) + '\n');
  assert.equal((await next).text, 'new');
});

test('aborting transcription terminates the worker and does not start a process for an already cancelled request', async t => {
  const { service, children } = worker();
  t.after(() => service.close());
  const controller = new AbortController();
  const task = service.transcribe('fake.wav', { signal: controller.signal });
  const reason = Object.assign(new Error('cancelled'), { code: 'ABORT_ERR' });
  controller.abort(reason);
  await assert.rejects(task, error => error === reason);
  assert.equal(children[0].killed, true);
  assert.equal(service.pending.size, 0);
  await assert.rejects(service.transcribe('fake.wav', { signal: controller.signal }), /cancelled/);
  assert.equal(children.length, 1);
});

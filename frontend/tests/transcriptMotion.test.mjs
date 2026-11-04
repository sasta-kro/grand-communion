import test from 'node:test';
import assert from 'node:assert/strict';
import { animateTranscriptEnd } from '../src/lib/transcriptMotion.ts';

function timeline() {
  let id = 0;
  const frames = new Map();
  return {
    clock: { now: () => 0, request: cb => { frames.set(++id, cb); return id; }, cancel: id => frames.delete(id) },
    tick(now) { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(now)); },
    get pending() { return frames.size; },
  };
}

test('incoming speech moves through intermediate positions and tracks measured heights', () => {
  const time = timeline();
  const area = { scrollTop: 100, scrollHeight: 500, clientHeight: 300 };
  let finished = false;
  animateTranscriptEnd(area, false, () => { finished = true; }, time.clock);
  assert.equal(area.scrollTop, 100);
  time.tick(160);
  assert.ok(area.scrollTop > 100 && area.scrollTop < 200);
  area.scrollHeight = 600;
  time.tick(320);
  assert.equal(area.scrollTop, 300);
  assert.equal(finished, true);
});

test('manual navigation cancels following without jumping to the end', () => {
  const time = timeline();
  const area = { scrollTop: 0, scrollHeight: 500, clientHeight: 300 };
  const cancel = animateTranscriptEnd(area, false, () => assert.fail('cancelled follow completed'), time.clock);
  time.tick(80);
  const position = area.scrollTop;
  cancel();
  time.tick(320);
  assert.equal(area.scrollTop, position);
  assert.equal(time.pending, 0);
});

test('reduced motion reaches the latest speech without animation frames', () => {
  const time = timeline();
  const area = { scrollTop: 0, scrollHeight: 500, clientHeight: 300 };
  let finished = false;
  animateTranscriptEnd(area, true, () => { finished = true; }, time.clock);
  assert.equal(area.scrollTop, 200);
  assert.equal(finished, true);
  assert.equal(time.pending, 0);
});

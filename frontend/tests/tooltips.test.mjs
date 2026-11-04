import test from "node:test";
import assert from "node:assert/strict";
import { getTooltipDelay, setTooltipDelay, scheduleTooltip } from "../src/lib/interfacePreferences.ts";

test("hover waits for the configured delay and leaving cancels it", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let shown = 0;
  const cancel = scheduleTooltip(() => shown++, 0.6);
  context.mock.timers.tick(599);
  assert.equal(shown, 0);
  cancel(); context.mock.timers.tick(1);
  assert.equal(shown, 0);
  scheduleTooltip(() => shown++, 1);
  context.mock.timers.tick(999); assert.equal(shown, 0);
  context.mock.timers.tick(1); assert.equal(shown, 1);
});
test("hover preferences accept positive finite seconds only", () => {
  const previous = getTooltipDelay();
  assert.equal(setTooltipDelay(1.25), true);
  assert.equal(getTooltipDelay(), 1.25);
  for (const value of [0, -1, NaN, Infinity]) assert.equal(setTooltipDelay(value), false);
  assert.equal(getTooltipDelay(), 1.25);
  setTooltipDelay(previous);
});

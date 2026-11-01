import test from "node:test";
import assert from "node:assert/strict";
import { chatDestination } from "../src/lib/chatNavigation.ts";

test("Chat has an explicit destination when there are no active sessions", () => {
  assert.equal(chatDestination([]), "#/chat");
  assert.equal(chatDestination([{ id: "last", status: "paused" }]), "#/chat");
});
test("Chat opens the only running session, not an old paused one", () => {
  assert.equal(chatDestination([{ id: "old", status: "paused" }, { id: "live", status: "running" }]), "#/scene/live");
});
test("Chat provides a choice when several sessions are running", () => {
  assert.equal(chatDestination([{ id: "a", status: "running" }, { id: "b", status: "running" }]), "#/chat");
});

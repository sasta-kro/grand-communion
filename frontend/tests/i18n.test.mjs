import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { i18n, tr } from "../src/i18n/index.ts";
import { helpForLabel } from "../src/i18n/help.ts";

const english = JSON.parse(fs.readFileSync(new URL("../src/i18n/en.json", import.meta.url)));
const helpBindings = JSON.parse(fs.readFileSync(new URL("../src/i18n/help-topics.json", import.meta.url)));

test("English interpolation and plurals do not expose resource keys", () => {
  assert.equal(tr("navigation.sessionsRunning", { count: 1 }), "1 session running");
  assert.equal(tr("navigation.sessionsRunning", { count: 3 }), "3 sessions running");
  assert.equal(tr("common.viewCharacter", { name: "Mara" }), "View Mara");
});
test("a language can translate labels and help with English fallback", async () => {
  i18n.addResourceBundle("fr", "translation", { "settings.globalDeliveryGap": "Intervalle global", "help.globalGap": "Aide traduite" });
  await i18n.changeLanguage("fr");
  assert.equal(tr("settings.globalDeliveryGap"), "Intervalle global");
  assert.equal(helpForLabel("Intervalle global"), "Aide traduite");
  assert.equal(tr("common.retry"), "Retry");
  await i18n.changeLanguage("en");
});
test("every bound help topic has a real label and explanation", () => {
  assert.ok(Object.keys(helpBindings).length > 80);
  for (const [label, help] of Object.entries(helpBindings)) {
    assert.ok(english[label], label); assert.ok(english[help], help);
  }
});
test("visible JSX text and static labels come from resources", () => {
  const root = new URL("../src/", import.meta.url);
  const violations = [];
  const scan = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) { scan(file); continue; }
      if (!file.endsWith(".tsx")) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = node => {
        if (ts.isJsxText(node) && /[a-zA-Z]/.test(node.text)) violations.push(`${file}: ${node.text.trim()}`);
        if (ts.isJsxAttribute(node) && ["label", "title", "subtitle", "description", "hint", "placeholder", "aria-label"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) && /[a-zA-Z]/.test(node.initializer.text)) violations.push(`${file}: ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  };
  scan(root.pathname);
  assert.deepEqual(violations, []);
});

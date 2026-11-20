import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const requireApi = createRequire(new URL("../../api-server/package.json", import.meta.url));
const { build } = await import(requireApi.resolve("esbuild"));
const output = new URL("../dist/pdf-controls-test.mjs", import.meta.url);
await mkdir(new URL("../dist/", import.meta.url), { recursive: true });
// Test the actual event handlers without signing in or reading private photos.
await build({
  entryPoints: [new URL("../src/components/ui-kit.tsx", import.meta.url).pathname],
  outfile: output.pathname, bundle: true, platform: "node", format: "esm",
  jsx: "automatic", packages: "external",
  plugins: [{
    name: "hook-host",
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "hook-host" }));
      builder.onLoad({ filter: /.*/, namespace: "hook-host" }, () => ({
        contents: "export const useState = initial => globalThis.pdfTestState.useState(initial)",
      }));
    },
  }],
});
const { TaskEvidenceExportButton, TaskGroupRow, TaskRow } = await import(output.href);
const event = { preventDefault() {}, stopPropagation() {} };
function elements(node, predicate) {
  if (!node || typeof node !== "object") return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...[node.props?.children].flat(Infinity).flatMap(child => elements(child, predicate)),
  ];
}
function scenario({ shareError, supported = true, invalidPdf = false } = {}) {
  const state = [];
  let cursor = 0;
  const calls = { fetch: [], share: 0, download: 0 };
  globalThis.pdfTestState = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], value => { state[slot] = value; }];
    },
  };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => supported,
    share: async () => { calls.share++; if (shareError) throw shareError; },
  } });
  globalThis.fetch = async (url) => {
    calls.fetch.push(url);
    return new Response(invalidPdf ? "%PDF-incomplete" : "%PDF-1.4\nfixture\n%%EOF", {
      headers: { "Content-Type": "application/pdf" },
    });
  };
  globalThis.window = { setTimeout() {} };
  globalThis.document = {
    body: { appendChild() {} },
    createElement: () => ({ click() { calls.download++; }, remove() {} }),
  };
  const render = () => {
    cursor = 0;
    return TaskEvidenceExportButton({ taskId: "task-a", taskTitle: "Campanha", scope: "store", taskStatus: "completed", storeName: "Centro" });
  };
  const find = (testid) => elements(render(), n => n.props?.["data-testid"] === testid)[0];
  return { calls, render, find };
}
for (const config of [{}, { supported: false }, { shareError: Object.assign(new Error("denied"), { name: "NotAllowedError" }) }, { shareError: Object.assign(new Error("cancelled"), { name: "AbortError" }) }]) {
  const test = scenario(config);
  await test.find("button-export-task-photos-task-a").props.onClick(event);
  assert.deepEqual(test.calls.fetch, ["/api/tasks/task-a/evidence/pdf?scope=store"]);
  assert.equal(test.calls.share, 0, "Generating a PDF must not open sharing automatically");
  assert.equal(test.calls.download, 0, "User chooses whether to share or download");
  const share = test.find("button-share-task-pdf-task-a");
  assert.equal(Boolean(share), config.supported !== false);
  if (share) {
    share.props.onClick(event);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(test.calls.share, 1);
    const notices = elements(test.render(), n => n.props?.role === "status").map(n => n.props.children).join(" ");
    assert.doesNotMatch(notices, /bloque|denied|NotAllowedError/i);
  }
  test.find("button-save-task-pdf-task-a").props.onClick(event);
  assert.equal(test.calls.download, 1);
  assert.equal(test.calls.fetch.length, 1, "Sharing/downloading must reuse the prepared file");
}
const invalid = scenario({ invalidPdf: true });
await invalid.find("button-export-task-photos-task-a").props.onClick(event);
assert.equal(invalid.find("button-save-task-pdf-task-a"), undefined);
assert.ok(elements(invalid.render(), n => n.props?.role === "status").length);
const task = { id: "a", title: "Campanha", storeName: "Centro", storeId: "s", status: "completed", priority: "low", dueDate: "2026-11-19", dueTime: "12:00" };
const group = TaskGroupRow({ tasks: [task, { ...task, id: "b", storeId: "t" }] });
const footer = elements(group, n => n.props?.className === "task-group-actions")[0];
assert.ok(footer, "Group PDF action must be inside the task card and outside collapsed details");
assert.equal(elements(footer, n => n.type === TaskEvidenceExportButton).length, 1);
const row = TaskRow({ task });
assert.equal(elements(row, n => n.type === TaskEvidenceExportButton)[0].props.scope, "store");
console.log("PDF controls passed: actions inside cards, manual sharing/download, unsupported/cancelled/denied sharing, incomplete PDF rejected.");

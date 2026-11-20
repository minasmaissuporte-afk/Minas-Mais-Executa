import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const requireApi = createRequire(new URL("../../api-server/package.json", import.meta.url));
const { transform } = await import(requireApi.resolve("esbuild"));
const source = await readFile(new URL("../src/pages/task-detail.tsx", import.meta.url), "utf8");
const start = source.indexOf("  const complete = () =>");
const end = source.indexOf("  const comment = () =>", start);
assert.ok(start >= 0 && end > start);
const { code } = await transform(source.slice(start, end), { loader: "ts" });

function prepare(role) {
  let callbacks;
  let thankedTaskId = null;
  let invalidations = 0;
  const deps = {
    task: { id: "task-test" }, me: { data: { role } },
    completeTask: { mutate: (_request, options) => { callbacks = options; } },
    reviewTask: { mutate: (_request, options) => { callbacks = options; } },
    invalidateTask: () => { invalidations++; },
    setNotice() {}, setReviewComment() {}, reviewComment: "",
    setThankedTaskId: value => { thankedTaskId = value; },
  };
  const actions = new Function("deps", `const {${Object.keys(deps).join(",")}} = deps;\n${code}; return {complete, review};`)(deps);
  return {
    ...actions,
    succeed: () => callbacks.onSuccess(),
    fail: () => callbacks.onError(),
    get thanked() { return thankedTaskId; },
    get invalidations() { return invalidations; },
  };
}
for (const role of ["manager", "supervisor", "admin"]) {
  const test = prepare(role);
  test.complete();
  assert.equal(test.thanked, null, "No success message before server confirmation");
  test.succeed();
  assert.equal(test.thanked, role === "admin" ? null : "task-test");
  assert.equal(test.invalidations, 1, "Preserve existing task refresh");
  const failed = prepare(role);
  failed.complete();
  failed.fail();
  assert.equal(failed.thanked, null, "No thank-you message on failed completion");
}
const approved = prepare("supervisor");
approved.review("approve");
assert.equal(approved.thanked, null);
approved.succeed();
assert.equal(approved.thanked, "task-test");
const rejected = prepare("supervisor");
rejected.review("reject");
rejected.succeed();
assert.equal(rejected.thanked, null);
const message = await readFile(new URL("../src/components/task-completion-message.tsx", import.meta.url), "utf8");
for (const text of [
  "Muito obrigado pela conclusão da tarefa!",
  "E não se esqueça: nada é tão bom que não possa melhorar!",
  "Você é um líder de excelência!",
]) assert.ok(message.includes(text));
assert.match(source, /open=\{!!task && thankedTaskId === task.id\}/);
console.log("Completion message passed: manager/supervisor success, approval, errors, rejection, admin and task-scoped display.");

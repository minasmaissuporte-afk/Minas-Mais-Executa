import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import sharp from "sharp";
import { createEvidencePdf } from "../dist/pdf-renderer-test.mjs";

// Execute the actual route body, with in-memory I/O adapters. No real database,
// identities, private photos or production storage are modified by this test.
const operations = await readFile(new URL("../src/routes/operations.ts", import.meta.url), "utf8");
const start = operations.indexOf('router.get("/tasks/:id/evidence/pdf"');
const end = operations.indexOf('router.post("/tasks/:id/evidence"', start);
assert.ok(start >= 0 && end > start);
const { code } = await transform(operations.slice(start, end), { loader: "ts", format: "cjs" });
const validImage = await sharp({ create: { width: 64, height: 96, channels: 3, background: "#cc2222" } }).jpeg().toBuffer();
const tasks = [
  { id: "a", storeId: "store-a", storeName: "Centro", title: "Campanha", batchGroupId: "group" },
  { id: "b", storeId: "store-b", storeName: "Norte", title: "Campanha", batchGroupId: "group" },
];
const tasksTable = {};
const evidencesTable = {};

async function request({ allowedStores, corrupt = false, scope = "task", status = "completed" }) {
  let handler;
  let selectedTaskIds = [];
  const downloaded = [];
  const db = {
    select: () => ({
      from: (table) => ({
        where: async () => table === tasksTable ? tasks : selectedTaskIds.map((id) => ({
          id: `photo-${id}`, taskId: id, objectPath: `/objects/${id}`, fileName: `${id}.jpg`,
        })),
      }),
    }),
  };
  const dependencies = {
    router: { get: (_path, callback) => { handler = callback; } },
    seedPromise: Promise.resolve(),
    GetTaskParams: { safeParse: (params) => ({ success: true, data: params }) },
    getTaskWithEvidence: async () => ({ ...tasks[0], status }),
    DownloadTaskEvidencePdfQueryParams: {
      safeParse: (query) => ["task", "store"].includes(query.scope)
        ? { success: true, data: query } : { success: false },
    },
    canAccessTask: async (_req, task) => allowedStores.includes(task.storeId),
    db, tasksTable, evidencesTable,
    eq: () => ({}), and: () => ({}),
    inArray: (_column, ids) => { selectedTaskIds = ids; return {}; },
    isNormalizedPrivateObjectPath: () => true,
    createEvidencePdf,
    objectStorageService: {
      getObjectEntityFile: async (path) => {
        downloaded.push(path);
        return {
          createReadStream: async function* () {
            yield corrupt && path.endsWith("b") ? Buffer.from("corrupt source") : validImage;
          },
        };
      },
    },
  };
  // The route intentionally has no creator check: authorization is store-based.
  new Function("deps", `const {${Object.keys(dependencies).join(",")}} = deps;\n${code}`)(dependencies);
  const response = {
    code: 200, headers: {}, body: undefined,
    status(value) { this.code = value; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
  };
  const log = { info() {}, error() {} };
  await handler({ params: { id: "a" }, query: { scope }, log }, response);
  return { response, downloaded };
}
const all = await request({ allowedStores: ["store-a", "store-b"] });
assert.equal(all.response.code, 200);
assert.equal(all.response.headers["Content-Type"], "application/pdf");
assert.ok(all.response.body.includes(Buffer.from("%%EOF")));
assert.equal((all.response.body.toString("latin1").match(/\/Subtype\s*\/Image\b/g) ?? []).length, 2);
const scoped = await request({ allowedStores: ["store-a"] });
assert.equal(scoped.response.code, 200);
assert.deepEqual(scoped.downloaded, ["/objects/a"], "Out-of-scope store photos must never be downloaded");
const forbidden = await request({ allowedStores: ["store-b"] });
assert.equal(forbidden.response.code, 404);
assert.equal(forbidden.downloaded.length, 0);
const broken = await request({ allowedStores: ["store-a", "store-b"], corrupt: true });
assert.equal(broken.response.code, 500);
assert.equal(broken.response.headers["Content-Type"], undefined, "Do not return PDF headers for failed generation");
assert.ok(broken.response.body.error.includes("Norte"));
assert.equal(Buffer.isBuffer(broken.response.body), false, "No partial PDF can be returned");
console.log("PDF route passed: accessible tasks export, stores isolated, corrupt image returns JSON error without partial PDF.");
const oneStore = await request({ allowedStores: ["store-a", "store-b"], scope: "store" });
assert.equal(oneStore.response.code, 200);
assert.deepEqual(oneStore.downloaded, ["/objects/a"], "A store PDF must not fetch sibling stores even for admins");
assert.ok(oneStore.response.headers["Content-Disposition"].includes("Centro"));
for (const status of ["pending", "in_progress", "pending_review", "rejected"]) {
  const incomplete = await request({ allowedStores: ["store-a"], scope: "store", status });
  assert.equal(incomplete.response.code, 409, status);
  assert.equal(incomplete.downloaded.length, 0);
}
const batchPending = await request({ allowedStores: ["store-a", "store-b"], status: "pending" });
assert.equal(batchPending.response.code, 200, "Batch export remains available without completing every store");
const invalidScope = await request({ allowedStores: ["store-a"], scope: "everything" });
assert.equal(invalidScope.response.code, 400);
console.log("PDF scope passed: store only, filename identified, completion required only for individual export, invalid scope rejected.");

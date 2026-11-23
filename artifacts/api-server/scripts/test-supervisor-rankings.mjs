import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const operations = await readFile(new URL("../src/routes/operations.ts", import.meta.url), "utf8");
const start = operations.indexOf('router.get("/rankings/supervisors"');
const end = operations.indexOf('router.get("/rankings"', start);
assert.ok(start >= 0 && end > start, "Supervisor ranking route should exist before the store ranking route");
const { code } = await transform(operations.slice(start, end), { loader: "ts", format: "cjs" });

const storesTable = {};
const tasksTable = {};
const stores = [
  { id: "store-a", supervisor: "Ana Paula" },
  { id: "store-b", supervisor: " Ana   Paula " },
  { id: "store-c", supervisor: "Jhonathan" },
  { id: "store-no-supervisor", supervisor: "" },
];
const completionTasks = [
  { storeId: "store-a", status: "completed", createdAt: new Date("2026-11-23T11:00:00.000Z"), completedAt: new Date("2026-11-23T12:00:00.000Z") },
  { storeId: "store-b", status: "completed", createdAt: new Date("2026-11-23T05:00:00.000Z"), completedAt: new Date("2026-11-23T12:00:00.000Z") },
  { storeId: "store-c", status: "completed", createdAt: new Date("2026-11-22T06:00:00.000Z"), completedAt: new Date("2026-11-23T12:00:00.000Z") },
  { storeId: "store-no-supervisor", status: "completed", createdAt: new Date("2026-11-22T12:00:00.000Z"), completedAt: new Date("2026-11-23T12:00:00.000Z") },
];

async function request({ role = "supervisor", query = {} } = {}) {
  let handler;
  let dbReads = 0;
  const dependencies = {
    router: { get: (_path, callback) => { handler = callback; } },
    seedPromise: Promise.resolve(),
    actor: () => ({ role }),
    GetSupervisorRankingsQueryParams: {
      safeParse: (input) => {
        const dates = [input.fromDate, input.toDate].filter((value) => value !== undefined);
        const valid = dates.every((value) => value instanceof Date && Number.isFinite(value.getTime()));
        return valid ? { success: true, data: input } : { success: false };
      },
    },
    GetSupervisorRankingsResponse: { parse: (value) => value },
    db: {
      select: () => ({
        from: (table) => {
          dbReads += 1;
          if (table === storesTable) return Promise.resolve(stores);
          return { where: async () => completionTasks };
        },
      }),
    },
    storesTable,
    tasksTable: {
      ...tasksTable,
      storeId: "storeId",
      status: "status",
      completedAt: "completedAt",
    },
    eq: () => ({}),
    inArray: () => ({}),
    gte: () => ({}),
    lt: () => ({}),
    and: () => ({}),
    isDateInput: (value) => typeof value === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
    dateInputInSaoPaulo: (date) => date.toISOString().slice(0, 10),
    addDaysToDateInput: (value, days) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    },
    saoPauloStartOfDay: (value) => new Date(`${value}T03:00:00.000Z`),
    rankingMetrics: (completed) => {
      const elapsed = completed
        .filter((task) => task.status === "completed" && task.completedAt)
        .map((task) => task.completedAt.getTime() - task.createdAt.getTime())
        .filter((duration) => Number.isFinite(duration) && duration >= 0);
      const points = elapsed.reduce((total, duration) => {
        const hours = duration / (60 * 60 * 1000);
        return total + (hours <= 1 ? 100 : hours <= 6 ? 80 : hours <= 24 ? 60 : hours <= 72 ? 40 : 20);
      }, 0);
      return { points, tasksCompleted: elapsed.length };
    },
  };
  new Function("deps", `const {${Object.keys(dependencies).join(",")}} = deps;\n${code}`)(dependencies);
  const response = {
    code: 200,
    body: undefined,
    status(value) { this.code = value; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ query: { fromDate: "2026-11-23", toDate: "2026-11-23", ...query } }, response);
  return { response, dbReads };
}

const supervisor = await request();
assert.equal(supervisor.response.code, 200);
assert.deepEqual(supervisor.response.body, {
  rankings: [
    { supervisorName: "Ana Paula", points: 160, storeCount: 2, storesWithCompletions: 2, tasksCompleted: 2 },
    { supervisorName: "Jhonathan", points: 40, storeCount: 1, storesWithCompletions: 1, tasksCompleted: 1 },
  ],
  totalPoints: 260,
  storeCount: 4,
  storesWithCompletions: 4,
});
assert.ok(supervisor.response.body.rankings.every((entry) => !("storeName" in entry) && !("manager" in entry)));

const admin = await request({ role: "admin" });
assert.equal(admin.response.code, 200);

const manager = await request({ role: "manager" });
assert.equal(manager.response.code, 403);
assert.equal(manager.dbReads, 0, "Managers must not read network-wide supervisor metrics");

const invalidDate = await request({ query: { fromDate: "not-a-date" } });
assert.equal(invalidDate.response.code, 400);
assert.equal(invalidDate.dbReads, 0, "Invalid date requests must not query ranking data");

const invalidRange = await request({ query: { fromDate: "2026-11-24", toDate: "2026-11-23" } });
assert.equal(invalidRange.response.code, 400);
assert.equal(invalidRange.dbReads, 0, "Reversed date ranges must not query ranking data");

console.log("Supervisor ranking route passed: network aggregates, date validation, no store-level details, managers denied.");

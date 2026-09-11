import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  AddTaskEvidenceBody,
  AddTaskEvidenceParams,
  DeleteAllTasksBody,
  DeleteTaskEvidenceParams,
  AddTaskCommentBody,
  AddTaskCommentParams,
  CompleteTaskParams,
  CreateBulkTasksBody,
  CreateRecurringTasksBody,
  CreateTaskBody,
  GetTaskParams,
  CreateStoreBody,
  UpdateStoreBody,
  UpdateStoreParams,
  DeleteStoreParams,
  ListTeamMembersQueryParams,
  CreateTeamMemberBody,
  UpdateTeamMemberBody,
  UpdateTeamMemberParams,
  DeleteTeamMemberParams,
  ListTasksQueryParams,
  ListTaskSummariesQueryParams,
  UpdateTaskBody,
  UpdateTaskParams,
  ReviewTaskBody,
  ReviewTaskParams,
} from "@workspace/api-zod";
import {
  activityTable,
  db,
  evidencesTable,
  pushSubscriptionsTable,
  taskCommentsTable,
  taskOriginsTable,
  teamMembersTable,
  storesTable,
  tasksTable,
} from "@workspace/db";
import { actor, requireAdmin } from "../middlewares/authorization";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { getPushPublicKey, notifyTaskAssignees } from "../lib/push";

const router: IRouter = Router();

const now = new Date();
const today = now.toISOString().slice(0, 10);
const objectStorageService = new ObjectStorageService();

function rankingCycleEndingOn(endDate: Date, days: number) {
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
}

function currentRankingCycle(days = 30) {
  return rankingCycleEndingOn(new Date(), days);
}

function previousRankingCycle(currentCycle: { start: string; end: string }, days: number) {
  const endDate = new Date(`${currentCycle.start}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return rankingCycleEndingOn(endDate, days);
}

function rankingPointsForElapsedMs(elapsedMs: number) {
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  if (elapsedHours <= 1) return 100;
  if (elapsedHours <= 6) return 80;
  if (elapsedHours <= 24) return 60;
  if (elapsedHours <= 72) return 40;
  return 20;
}

function rankingMetrics(tasks: Array<Pick<typeof tasksTable.$inferSelect, "status" | "completedAt" | "createdAt">>) {
  const completedTasks = tasks.filter((task) => task.status === "completed" && task.completedAt);
  const elapsedTimes = completedTasks
    .map((task) => task.completedAt!.getTime() - task.createdAt.getTime())
    .filter((elapsedMs) => Number.isFinite(elapsedMs) && elapsedMs >= 0);
  const points = elapsedTimes.reduce((total, elapsedMs) => total + rankingPointsForElapsedMs(elapsedMs), 0);

  return {
    points,
    averageExecutionMinutes: elapsedTimes.length
      ? Math.round(elapsedTimes.reduce((total, elapsedMs) => total + elapsedMs, 0) / elapsedTimes.length / (60 * 1000))
      : 0,
    execution: tasks.length
      ? Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100)
      : 0,
  };
}

const rankingStoreGroups = {
  GG: [
    "Lavras 1", "Lavras 3", "Lafaiete 2", "Lafaiete 4", "Barbacena 1",
    "Lafaiete 5", "Congonhas", "São João 3", "Campo Belo", "Barbacena 3", "Divinopolis 1",
  ],
  G: [
    "São Joao 1", "Boa esperança", "Lavras 4", "Lafaiete 8", "Divinopolis 5",
    "Lafaiete 6", "Candeias", "Itauna", "Belo horizonte 4", "Lafaiete 1", "Belo horizonte 2",
  ],
  M: [
    "Lafaiete 3", "Belo horizonte 5", "Belo horizonte 3", "Betim", "São João 2",
    "Barbacena 2", "Pouso Alegre", "Campo Belo 3", "Oliveira", "Alfenas", "Lafaiete 7",
  ],
  P: [
    "Três Corações", "Campo Belo 2", "Lavras 2", "Barbacena 4", "Perdões",
    "Divinopolis 6", "Divinopolis 3", "Formiga 4", "Formiga 1", "Formiga 2",
    "Divinopolis 4", "Divinopolis 2",
  ],
} as const;

function normalizeRankingStoreName(name: string) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/^loja\s+/, "");
}

const rankingGroupByStoreName = new Map(
  Object.entries(rankingStoreGroups).flatMap(([group, stores]) =>
    stores.map((store) => [normalizeRankingStoreName(store), group] as const),
  ),
);

function rankingGroupForStore(storeName: string) {
  const normalizedName = normalizeRankingStoreName(storeName);
  const withoutUnitOne = normalizedName.replace(/\s1$/, "");
  return rankingGroupByStoreName.get(normalizedName)
    ?? (withoutUnitOne === normalizedName ? rankingGroupByStoreName.get(`${normalizedName} 1`) : undefined)
    ?? (withoutUnitOne !== normalizedName ? rankingGroupByStoreName.get(withoutUnitOne) : undefined)
    ?? "Sem grupo";
}

function isNormalizedPrivateObjectPath(path: string): boolean {
  return path.startsWith("/objects/")
    && path.length > "/objects/".length
    && !path.includes("\\")
    && !path.split("/").some((segment) => segment === "." || segment === "..")
    && objectStorageService.normalizeObjectEntityPath(path) === path;
}

async function deleteTaskData(taskIds: string[]) {
  if (!taskIds.length) return;
  const [taskRecords, evidence] = await Promise.all([
    db
      .select({ modelObjectPath: tasksTable.modelObjectPath })
      .from(tasksTable)
      .where(inArray(tasksTable.id, taskIds)),
    db
      .select({ objectPath: evidencesTable.objectPath })
      .from(evidencesTable)
      .where(inArray(evidencesTable.taskId, taskIds)),
  ]);
  await db.transaction(async (tx) => {
    await tx.delete(evidencesTable).where(inArray(evidencesTable.taskId, taskIds));
    await tx.delete(taskCommentsTable).where(inArray(taskCommentsTable.taskId, taskIds));
    await tx.delete(taskOriginsTable).where(inArray(taskOriginsTable.taskId, taskIds));
    await tx.delete(tasksTable).where(inArray(tasksTable.id, taskIds));
  });
  const objectPaths = [...new Set([
    ...evidence.map((item) => item.objectPath),
    ...taskRecords.map((item) => item.modelObjectPath),
  ].filter((path): path is string => Boolean(path)))];
  await Promise.allSettled(objectPaths.map((path) => objectStorageService.deleteObjectEntity(path)));
}

async function scopedStoreIds(req: import("express").Request): Promise<string[] | null> {
  const member = actor(req);
  if (member.role === "admin") return null;
  if (member.role === "manager") return member.storeId ? [member.storeId] : [];
  const stores = await db.select({ id: storesTable.id, supervisorMemberId: storesTable.supervisorMemberId }).from(storesTable);
  return stores.filter((store) => store.supervisorMemberId === member.id).map((store) => store.id);
}

async function canAccessTask(req: import("express").Request, task: { storeId: string }): Promise<boolean> {
  const storeIds = await scopedStoreIds(req);
  return storeIds === null || storeIds.includes(task.storeId);
}

async function canCreateTask(req: import("express").Request, storeIds: string[]): Promise<boolean> {
  const member = actor(req);
  if (member.role === "admin") return true;
  if (member.role !== "supervisor") return false;
  const allowedStoreIds = await scopedStoreIds(req);
  return allowedStoreIds !== null && storeIds.every((storeId) => allowedStoreIds.includes(storeId));
}

async function getTaskOrigin(taskId: string) {
  const [origin] = await db
    .select()
    .from(taskOriginsTable)
    .where(eq(taskOriginsTable.taskId, taskId));
  return origin ?? null;
}

async function isVisibleToAdmin(req: import("express").Request, task: { id: string; status: string }): Promise<boolean> {
  return true;
}

async function canReviewTask(req: import("express").Request, task: { storeId: string }): Promise<boolean> {
  if (actor(req).role !== "supervisor") return false;
  const [store] = await db
    .select({ supervisorMemberId: storesTable.supervisorMemberId })
    .from(storesTable)
    .where(eq(storesTable.id, task.storeId));
  return store?.supervisorMemberId === actor(req).id;
}

async function resolveActiveMember(name: string, role: "manager" | "supervisor") {
  if (!name.trim()) return null;
  const normalizedName = name.trim().toLowerCase();
  const matches = await db.select().from(teamMembersTable).where(
    and(
      sql`lower(trim(${teamMembersTable.name})) = ${normalizedName}`,
      eq(teamMembersTable.role, role),
      eq(teamMembersTable.active, true),
    ),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

async function resolveActiveMembersByIds(ids: string[], role: "manager" | "supervisor") {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return [];
  return db
    .select()
    .from(teamMembersTable)
    .where(and(
      inArray(teamMembersTable.id, uniqueIds),
      eq(teamMembersTable.role, role),
      eq(teamMembersTable.active, true),
    ));
}

async function storeIdsForSupervisors(supervisorIds: string[]) {
  const uniqueIds = [...new Set(supervisorIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const stores = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(inArray(storesTable.supervisorMemberId, uniqueIds));
  return stores.map((store) => store.id);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

async function resolveManagerForStore(store: {
  id: string;
  manager: string;
  managerMemberId: string | null;
}) {
  const [linkedManager] = store.managerMemberId
    ? await db
      .select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.id, store.managerMemberId),
        eq(teamMembersTable.role, "manager"),
        eq(teamMembersTable.active, true),
      ))
    : [];
  const manager = linkedManager ?? await resolveActiveMember(store.manager, "manager");
  if (!manager || !manager.active || manager.role !== "manager") return null;
  if (manager.storeId && manager.storeId !== store.id) return null;
  return manager;
}

async function applyMemberStoreAssignment(
  member: { id: string; name: string; role: string },
  storeId: string | null,
): Promise<void> {
  if (member.role !== "manager" || !storeId) return;
  await db.update(storesTable)
    .set({ manager: "", managerMemberId: null })
    .where(and(eq(storesTable.managerMemberId, member.id), ne(storesTable.id, storeId)));
  await db.update(teamMembersTable).set({ storeId }).where(eq(teamMembersTable.id, member.id));
}

function canExecuteTask(req: import("express").Request, task: { assignee: string; assigneeMemberId: string | null; assigneeMemberIds?: string[] | null }): boolean {
  const member = actor(req);
  return member.role === "admin"
    || task.assigneeMemberIds?.includes(member.id) === true
    || task.assigneeMemberId === member.id;
}

async function ensureSeedData() {
  const existingStores = await db.select({ id: storesTable.id }).from(storesTable);
  if (existingStores.length === 0) {
    await db
      .insert(storesTable)
      .values([
        {
          id: "store-centro",
          name: "Loja Centro",
          city: "Belo Horizonte",
          region: "Metropolitana",
          manager: "João Mendes",
          supervisor: "Fernanda Lima",
          execution: 98,
        },
        {
          id: "store-savassi",
          name: "Loja Savassi",
          city: "Belo Horizonte",
          region: "Metropolitana",
          manager: "Mariana Alves",
          supervisor: "Fernanda Lima",
          execution: 94,
        },
        {
          id: "store-contagem",
          name: "Loja Contagem",
          city: "Contagem",
          region: "Metropolitana",
          manager: "Carlos Eduardo",
          supervisor: "Rafael Nunes",
          execution: 91,
        },
        {
          id: "store-betim",
          name: "Loja Betim",
          city: "Betim",
          region: "Metropolitana",
          manager: "Ana Paula",
          supervisor: "Rafael Nunes",
          execution: 87,
        },
      ])
      .onConflictDoNothing();
  }

  const supervisorDefaults = [
    ["store-centro", "Fernanda Lima"],
    ["store-savassi", "Fernanda Lima"],
    ["store-contagem", "Rafael Nunes"],
    ["store-betim", "Rafael Nunes"],
  ] as const;
  for (const [storeId, supervisor] of supervisorDefaults) {
    await db
      .update(storesTable)
      .set({ supervisor })
      .where(and(eq(storesTable.id, storeId), eq(storesTable.supervisor, "")));
  }

  const existingTeamMembers = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable);
  if (existingTeamMembers.length === 0) {
    await db
      .insert(teamMembersTable)
      .values([
        {
          id: "member-joao-mendes",
          name: "João Mendes",
          email: "joao.mendes@minasmais.com.br",
          phone: "(31) 99999-1001",
          role: "manager",
          storeId: "store-centro",
        },
        {
          id: "member-mariana-alves",
          name: "Mariana Alves",
          email: "mariana.alves@minasmais.com.br",
          phone: "(31) 99999-1002",
          role: "manager",
          storeId: "store-savassi",
        },
        {
          id: "member-carlos-eduardo",
          name: "Carlos Eduardo",
          email: "carlos.eduardo@minasmais.com.br",
          phone: "(31) 99999-1003",
          role: "manager",
          storeId: "store-contagem",
        },
        {
          id: "member-ana-paula",
          name: "Ana Paula",
          email: "ana.paula@minasmais.com.br",
          phone: "(31) 99999-1004",
          role: "manager",
          storeId: "store-betim",
        },
        {
          id: "member-fernanda-lima",
          name: "Fernanda Lima",
          email: "fernanda.lima@minasmais.com.br",
          phone: "(31) 99999-2001",
          role: "supervisor",
          storeId: null,
        },
        {
          id: "member-rafael-nunes",
          name: "Rafael Nunes",
          email: "rafael.nunes@minasmais.com.br",
          phone: "(31) 99999-2002",
          role: "supervisor",
          storeId: null,
        },
      ])
      .onConflictDoNothing();
  }
  await db
    .insert(teamMembersTable)
    .values({
      id: "member-admin-david",
      name: "David",
      email: "david@drogariasminasmais.com.br",
      phone: "",
      role: "admin",
      active: true,
    })
    .onConflictDoNothing();

  const storesNeedingLinks = await db.select().from(storesTable);
  const storesById = new Map(storesNeedingLinks.map((store) => [store.id, store]));
  for (const store of storesNeedingLinks) {
    const manager = store.managerMemberId ? null : await resolveActiveMember(store.manager, "manager");
    const supervisor = store.supervisorMemberId ? null : await resolveActiveMember(store.supervisor, "supervisor");
    if (manager && manager.storeId === store.id) {
      await db.update(storesTable)
        .set({ managerMemberId: manager.id, manager: manager.name.trim() })
        .where(and(
          eq(storesTable.id, store.id),
          isNull(storesTable.managerMemberId),
          sql`lower(trim(${storesTable.manager})) = ${store.manager.trim().toLowerCase()}`,
        ));
    }
    if (supervisor) {
      await db.update(storesTable)
        .set({ supervisorMemberId: supervisor.id, supervisor: supervisor.name.trim() })
        .where(and(
          eq(storesTable.id, store.id),
          isNull(storesTable.supervisorMemberId),
          sql`lower(trim(${storesTable.supervisor})) = ${store.supervisor.trim().toLowerCase()}`,
        ));
    }
  }

  const tasksNeedingLinks = await db.select().from(tasksTable);
  for (const task of tasksNeedingLinks) {
    if (task.assigneeMemberId || (task.assigneeRole !== "manager" && task.assigneeRole !== "supervisor")) continue;
    const store = storesById.get(task.storeId);
    const assignee = task.assigneeRole === "manager" && store
      ? await resolveManagerForStore(store)
      : await resolveActiveMember(task.assignee, task.assigneeRole);
    if (assignee && (task.assigneeRole !== "manager" || assignee.storeId === task.storeId)) {
      await db.update(tasksTable)
        .set({ assigneeMemberId: assignee.id, assigneeMemberIds: [assignee.id], assignee: assignee.name.trim() })
        .where(and(
          eq(tasksTable.id, task.id),
          isNull(tasksTable.assigneeMemberId),
          eq(tasksTable.assigneeRole, task.assigneeRole),
          sql`lower(trim(${tasksTable.assignee})) = ${task.assignee.trim().toLowerCase()}`,
        ));
    }
  }
}

const seedPromise = ensureSeedData().catch((error) => {
  logger.error({ err: error }, "Failed to seed operational data");
});

router.get("/notifications/public-key", async (_req, res) => {
  res.json({ publicKey: getPushPublicKey() });
});

router.post("/notifications/subscription", async (req, res) => {
  const member = actor(req);
  if (member.role !== "manager" && member.role !== "supervisor") {
    res.status(403).json({ error: "Somente gerentes e supervisores podem registrar notificações." });
    return;
  }
  const body = req.body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof body.endpoint !== "string"
    || !body.endpoint
    || typeof body.keys?.p256dh !== "string"
    || typeof body.keys?.auth !== "string"
  ) {
    res.status(400).json({ error: "Subscription de push inválida." });
    return;
  }
  const updatedAt = new Date();
  await db
    .insert(pushSubscriptionsTable)
    .values({
      id: `push-${crypto.randomUUID()}`,
      memberId: member.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        memberId: member.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        updatedAt,
      },
    });
  res.status(204).send();
});

router.get("/me", async (req, res) => {
  await seedPromise;
  const member = actor(req);
  res.json({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    storeIds: (await scopedStoreIds(req)) ?? [],
  });
});

async function getTaskWithEvidence(id: string) {
  await seedPromise;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, id));
  if (!task) return null;
  const evidence = await db
    .select()
    .from(evidencesTable)
    .where(eq(evidencesTable.taskId, id))
    .orderBy(desc(evidencesTable.createdAt));
  const [origin] = await db
    .select()
    .from(taskOriginsTable)
    .where(eq(taskOriginsTable.taskId, id));
  const [creator] = origin
    ? await db
      .select({ name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, origin.createdByMemberId))
    : [];
  const comments = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.taskId, id))
    .orderBy(taskCommentsTable.createdAt);
  const commentUserIds = [...new Set(comments.map((comment) => comment.userId))];
  const commentUsers = commentUserIds.length
    ? await db
      .select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(inArray(teamMembersTable.id, commentUserIds))
    : [];
  const commentUserNames = new Map(commentUsers.map((user) => [user.id, user.name]));
  return {
    ...task,
    assigneeMemberIds: task.assigneeMemberIds?.length
      ? task.assigneeMemberIds
      : task.assigneeMemberId
        ? [task.assigneeMemberId]
        : [],
    evidenceTypes: task.evidenceTypes ?? [],
    evidence: evidence.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      type: item.type,
      fileName: item.fileName,
      objectPath: item.objectPath,
      createdAt: item.createdAt.toISOString(),
      userName: item.userName,
      location: item.location,
    })),
    modelObjectPath: task.modelObjectPath ?? null,
    comments: comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      userName: commentUserNames.get(comment.userId) ?? comment.userId,
    })),
    createdByRole: origin?.createdByRole ?? "admin",
    createdByName: creator?.name ?? "Administração",
    completedAt: task.completedAt?.toISOString() ?? null,
    completedBy: task.completedBy ?? null,
  };
}

router.get("/dashboard/summary", async (req, res) => {
  await seedPromise;
  const visibleStoreIds = await scopedStoreIds(req);
  const cycle = currentRankingCycle();
  const storeFilter = visibleStoreIds === null ? undefined : inArray(storesTable.id, visibleStoreIds);
  const taskFilters = [
    visibleStoreIds === null ? undefined : inArray(tasksTable.storeId, visibleStoreIds),
    or(
      eq(tasksTable.dueDate, today),
      eq(tasksTable.status, "overdue"),
      and(gte(tasksTable.dueDate, cycle.start), lte(tasksTable.dueDate, cycle.end)),
    ),
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  const [visibleTasks, visibleStores] = await Promise.all([
    db
      .select({
        storeId: tasksTable.storeId,
        dueDate: tasksTable.dueDate,
        status: tasksTable.status,
      })
      .from(tasksTable)
      .where(taskFilters.length ? and(...taskFilters) : undefined),
    db
      .select()
      .from(storesTable)
      .where(storeFilter),
  ]);
  const todaysTasks = visibleTasks.filter((task) => task.dueDate === today);
  const cycleTasks = visibleTasks.filter((task) => task.dueDate >= cycle.start && task.dueDate <= cycle.end);
  const completed = todaysTasks.filter((task) => task.status === "completed").length;
  const overdue = visibleTasks.filter((task) => task.status === "overdue").length;
  const execution = todaysTasks.length
    ? Math.round((completed / todaysTasks.length) * 100)
    : 0;
  res.json({
    role: actor(req).role,
    storeName: actor(req).role === "manager" ? visibleStores[0]?.name ?? "" : "",
    tasksToday: todaysTasks.length,
    completed,
    pending: todaysTasks.filter((task) => task.status !== "completed").length,
    overdue,
    execution,
    storesCount: visibleStores.length,
    campaignsActive: 2,
    actionPlans: 3,
    storeFulfillment: visibleStores.map((store) => {
      const storeTasks = cycleTasks.filter((task) => task.storeId === store.id);
      return {
        storeName: store.name,
        completed: storeTasks.filter((task) => task.status === "completed").length,
        pending: storeTasks.filter((task) => task.status !== "completed").length,
      };
    }),
  });
});

router.get("/activity", async (req, res) => {
  await seedPromise;
  const rows = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(10);
  if (actor(req).role !== "admin") {
    res.json([]);
    return;
  }
  res.json(
    rows.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  );
});

router.get("/tasks", async (req, res) => {
  await seedPromise;
  const parsed = ListTasksQueryParams.safeParse({
    ...req.query,
    dateFrom: req.query.dateFrom ? new Date(String(req.query.dateFrom)) : undefined,
    dateTo: req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros inválidos." });
    return;
  }
  const filters = [];
  if (parsed.data.status) filters.push(eq(tasksTable.status, parsed.data.status));
  if (parsed.data.category) {
    filters.push(eq(tasksTable.category, parsed.data.category));
  }
  if (parsed.data.storeId) filters.push(eq(tasksTable.storeId, parsed.data.storeId));
  if (parsed.data.dateFrom) {
    filters.push(gte(tasksTable.dueDate, parsed.data.dateFrom.toISOString().slice(0, 10)));
  }
  if (parsed.data.dateTo) {
    filters.push(lte(tasksTable.dueDate, parsed.data.dateTo.toISOString().slice(0, 10)));
  }
  const storeIds = await scopedStoreIds(req);
  if (storeIds !== null) {
    if (!storeIds.length || (parsed.data.storeId && !storeIds.includes(parsed.data.storeId))) {
      res.json([]);
      return;
    }
    filters.push(inArray(tasksTable.storeId, storeIds));
  }
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(tasksTable.dueTime);
  const payload = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
  res.json(payload.filter((task) => task));
});

router.get("/tasks/summary", async (req, res) => {
  await seedPromise;
  const parsed = ListTaskSummariesQueryParams.safeParse({
    ...req.query,
    dateFrom: req.query.dateFrom ? new Date(String(req.query.dateFrom)) : undefined,
    dateTo: req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros inválidos." });
    return;
  }
  const filters = [];
  if (parsed.data.status) filters.push(eq(tasksTable.status, parsed.data.status));
  if (parsed.data.category) filters.push(eq(tasksTable.category, parsed.data.category));
  if (parsed.data.storeId) filters.push(eq(tasksTable.storeId, parsed.data.storeId));
  if (parsed.data.dateFrom) filters.push(gte(tasksTable.dueDate, parsed.data.dateFrom.toISOString().slice(0, 10)));
  if (parsed.data.dateTo) filters.push(lte(tasksTable.dueDate, parsed.data.dateTo.toISOString().slice(0, 10)));
  const storeIds = await scopedStoreIds(req);
  if (storeIds !== null) {
    if (!storeIds.length || (parsed.data.storeId && !storeIds.includes(parsed.data.storeId))) {
      res.json([]);
      return;
    }
    filters.push(inArray(tasksTable.storeId, storeIds));
  }
  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      storeId: tasksTable.storeId,
      storeName: tasksTable.storeName,
      assignee: tasksTable.assignee,
      assigneeMemberId: tasksTable.assigneeMemberId,
      assigneeMemberIds: tasksTable.assigneeMemberIds,
      assigneeRole: tasksTable.assigneeRole,
      batchGroupId: tasksTable.batchGroupId,
      category: tasksTable.category,
      priority: tasksTable.priority,
      dueDate: tasksTable.dueDate,
      dueTime: tasksTable.dueTime,
      createdAt: tasksTable.createdAt,
      status: tasksTable.status,
      createdByRole: taskOriginsTable.createdByRole,
      createdByName: teamMembersTable.name,
    })
    .from(tasksTable)
    .leftJoin(taskOriginsTable, eq(taskOriginsTable.taskId, tasksTable.id))
    .leftJoin(teamMembersTable, eq(teamMembersTable.id, taskOriginsTable.createdByMemberId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(tasksTable.dueTime);
  res.json(rows.map((row) => ({
    ...row,
    assigneeMemberIds: row.assigneeMemberIds ?? [],
    createdByRole: row.createdByRole ?? "admin",
    createdByName: row.createdByName ?? "Administração",
    createdAt: row.createdAt.toISOString(),
  })));
});

router.get("/tasks/notifications", async (req, res) => {
  await seedPromise;
  const storeIds = await scopedStoreIds(req);
  if (storeIds !== null && !storeIds.length) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({
      id: tasksTable.id,
      createdAt: tasksTable.createdAt,
      assigneeMemberId: tasksTable.assigneeMemberId,
      assigneeMemberIds: tasksTable.assigneeMemberIds,
    })
    .from(tasksTable)
    .where(storeIds === null ? undefined : inArray(tasksTable.storeId, storeIds))
    .orderBy(desc(tasksTable.createdAt));
  res.json(rows.map((row) => ({
    ...row,
    assigneeMemberIds: row.assigneeMemberIds ?? [],
    createdAt: row.createdAt.toISOString(),
  })));
});

router.post("/tasks", async (req, res) => {
  await seedPromise;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da tarefa inválidos." });
    return;
  }
  if (!(await canCreateTask(req, [parsed.data.storeId]))) {
    res.status(403).json({ error: "Você só pode criar tarefas para as lojas vinculadas ao seu perfil." });
    return;
  }
  if (actor(req).role === "admin" && parsed.data.assigneeRole !== "manager" && parsed.data.assigneeRole !== "supervisor") {
    res.status(400).json({ error: "Administradores devem selecionar supervisores para delimitar as lojas." });
    return;
  }
  const selectedSupervisorIds = [...new Set(parsed.data.assigneeMemberIds ?? [])];
  if (actor(req).role === "admin" && !selectedSupervisorIds.length) {
    res.status(400).json({ error: "Selecione pelo menos um supervisor responsável." });
    return;
  }
  if (actor(req).role === "admin") {
    const activeSupervisors = await resolveActiveMembersByIds(selectedSupervisorIds, "supervisor");
    if (activeSupervisors.length !== selectedSupervisorIds.length) {
      res.status(400).json({ error: "Selecione apenas supervisores ativos." });
      return;
    }
  }
  if (actor(req).role === "supervisor" && parsed.data.assigneeRole !== "manager") {
    res.status(400).json({ error: "Tarefas criadas pela supervisão devem ser atribuídas a um gerente." });
    return;
  }
  if (parsed.data.modelObjectPath && !isNormalizedPrivateObjectPath(parsed.data.modelObjectPath)) {
    res.status(400).json({ error: "Caminho do modelo visual inválido." });
    return;
  }
  const [selectedStore] = await db.select().from(storesTable).where(eq(storesTable.id, parsed.data.storeId));
  if (!selectedStore) {
    res.status(400).json({ error: "Loja não encontrada." });
    return;
  }
  if (actor(req).role === "admin" && !(await storeIdsForSupervisors(parsed.data.assigneeMemberIds ?? [])).includes(selectedStore.id)) {
    res.status(400).json({ error: "A loja deve pertencer a um dos supervisores selecionados." });
    return;
  }
  const task = {
    id: `task-${crypto.randomUUID()}`,
    ...parsed.data,
    storeName: selectedStore.name,
    assigneeRole: parsed.data.assigneeRole ?? "manager",
    dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
    evidenceTypes: parsed.data.evidenceTypes ?? [],
    modelObjectPath: parsed.data.modelObjectPath ?? null,
    assigneeMemberId: null as string | null,
    status: "pending",
  };
  const selectedAssigneeIds = [...new Set(parsed.data.assigneeMemberIds ?? [])];
  const assigneeMembers = task.assigneeRole === "manager"
    ? [await resolveManagerForStore(selectedStore)].filter(isPresent)
    : selectedAssigneeIds.length
      ? await resolveActiveMembersByIds(selectedAssigneeIds, "supervisor")
      : [await resolveActiveMember(task.assignee, "supervisor")].filter(isPresent);
  if (!assigneeMembers.length || assigneeMembers.length !== (task.assigneeRole === "manager" ? 1 : selectedAssigneeIds.length || 1)) {
    res.status(400).json({ error: "Responsável não encontrado." });
    return;
  }
  const assigneeMember = assigneeMembers[0];
  if (task.assigneeRole === "manager" && assigneeMember.storeId && assigneeMember.storeId !== selectedStore.id) {
    res.status(400).json({ error: "O gerente responsável não está vinculado à loja selecionada." });
    return;
  }
  task.assignee = assigneeMembers.map((member) => member.name.trim()).join(", ");
  task.assigneeMemberId = assigneeMember.id;
  const assigneeMemberIds = assigneeMembers.map((member) => member.id);
  task.assigneeMemberIds = assigneeMemberIds;
  const inserted = await db.transaction(async (tx) => {
    for (const assigneeId of assigneeMemberIds) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"team-member:" + assigneeId}))`);
    }
    const available = await tx
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(and(inArray(teamMembersTable.id, assigneeMemberIds), eq(teamMembersTable.active, true)));
    if (!available || available.length !== assigneeMemberIds.length) return false;
    await tx.insert(tasksTable).values(task);
    await tx.insert(taskOriginsTable).values({
      taskId: task.id,
      createdByMemberId: actor(req).id,
      createdByRole: actor(req).role,
    });
    return true;
  });
  if (!inserted) {
    res.status(409).json({ error: "O responsável não está mais disponível. Atualize a página e escolha outro." });
    return;
  }
  const result = await getTaskWithEvidence(task.id);
  await notifyTaskAssignees(assigneeMemberIds.map((assigneeMemberId) => ({
    id: task.id,
    title: task.title,
    assigneeMemberId,
  })));
  res.status(201).json(result);
});

router.post("/tasks/bulk", async (req, res) => {
  await seedPromise;
  const parsed = CreateBulkTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da tarefa em massa inválidos." });
    return;
  }
  if (actor(req).role === "admin" && parsed.data.assigneeRole !== "manager" && parsed.data.assigneeRole !== "supervisor") {
    res.status(400).json({ error: "Administradores devem selecionar supervisores para delimitar as lojas." });
    return;
  }
  const selectedSupervisorIds = [...new Set(parsed.data.assigneeMemberIds ?? [])];
  if (actor(req).role === "admin" && !selectedSupervisorIds.length) {
    res.status(400).json({ error: "Selecione pelo menos um supervisor responsável." });
    return;
  }
  if (actor(req).role === "admin") {
    const activeSupervisors = await resolveActiveMembersByIds(selectedSupervisorIds, "supervisor");
    if (activeSupervisors.length !== selectedSupervisorIds.length) {
      res.status(400).json({ error: "Selecione apenas supervisores ativos." });
      return;
    }
  }
  const requestedStoreIds = [...new Set(parsed.data.storeIds)];
  if (actor(req).role === "admin") {
    const allowedStoreIds = await storeIdsForSupervisors(selectedSupervisorIds);
    const invalidStoreIds = requestedStoreIds.filter((storeId) => !allowedStoreIds.includes(storeId));
    if (invalidStoreIds.length) {
      res.status(400).json({ error: "Uma ou mais lojas selecionadas não pertencem aos supervisores escolhidos." });
      return;
    }
  }
  if (!requestedStoreIds.length) {
    res.status(400).json({ error: "Selecione pelo menos uma loja." });
    return;
  }
  if (!(await canCreateTask(req, requestedStoreIds))) {
    res.status(403).json({ error: "Você só pode criar tarefas para as lojas vinculadas ao seu perfil." });
    return;
  }
  if (actor(req).role === "supervisor" && parsed.data.assigneeRole !== "manager") {
    res.status(400).json({ error: "Tarefas criadas pela supervisão devem ser atribuídas a um gerente." });
    return;
  }
  if (parsed.data.modelObjectPath && !isNormalizedPrivateObjectPath(parsed.data.modelObjectPath)) {
    res.status(400).json({ error: "Caminho do modelo visual inválido." });
    return;
  }
  const selectedSupervisorMembers = parsed.data.assigneeRole === "supervisor"
    ? selectedSupervisorIds.length
      ? await resolveActiveMembersByIds(selectedSupervisorIds, "supervisor")
      : [await resolveActiveMember(parsed.data.assignee ?? "", "supervisor")].filter(isPresent)
    : [];
  if (parsed.data.assigneeRole === "supervisor" && (
    !selectedSupervisorMembers.length
    || selectedSupervisorMembers.length !== (selectedSupervisorIds.length || 1)
  )) {
    res.status(400).json({ error: "Selecione pelo menos um supervisor ativo." });
    return;
  }
  const stores = await db
    .select()
    .from(storesTable)
    .where(inArray(storesTable.id, requestedStoreIds));
  if (stores.length !== requestedStoreIds.length) {
    res.status(400).json({ error: "Uma ou mais lojas não foram encontradas." });
    return;
  }
  const batchGroupId = `batch-${crypto.randomUUID()}`;
  const dueDate = parsed.data.dueDate.toISOString().slice(0, 10);
  const tasks = stores.map((store) => ({
    id: `task-${crypto.randomUUID()}`,
    title: parsed.data.title,
    description: parsed.data.description,
    storeId: store.id,
    storeName: store.name,
    assignee: parsed.data.assigneeRole === "supervisor"
      ? selectedSupervisorMembers.map((member) => member.name.trim()).join(", ")
      : store.manager || "Gerente não definido",
    assigneeMemberId: null as string | null,
    assigneeMemberIds: parsed.data.assigneeRole === "supervisor" ? selectedSupervisorMembers.map((member) => member.id) : [],
    assigneeRole: parsed.data.assigneeRole,
    batchGroupId,
    category: parsed.data.category,
    priority: parsed.data.priority,
    dueDate,
    dueTime: parsed.data.dueTime,
    evidenceRequired: parsed.data.evidenceRequired,
    evidenceTypes: parsed.data.evidenceTypes ?? [],
    modelObjectPath: parsed.data.modelObjectPath ?? null,
    instructions: parsed.data.instructions,
    status: "pending",
  }));
  for (const task of tasks) {
    const store = stores.find((item) => item.id === task.storeId);
    const assigneeMembers = task.assigneeRole === "manager" && store
      ? [await resolveManagerForStore(store)].filter(isPresent)
      : selectedSupervisorMembers;
    if (!assigneeMembers.length) {
      res.status(400).json({ error: "Responsável não encontrado." });
      return;
    }
    const assigneeMember = assigneeMembers[0];
    if (task.assigneeRole === "manager" && assigneeMember.storeId && assigneeMember.storeId !== task.storeId) {
      res.status(400).json({ error: `A loja ${task.storeName} não possui um gerente ativo vinculado.` });
      return;
    }
    task.assignee = assigneeMembers.map((member) => member.name.trim()).join(", ");
    task.assigneeMemberId = assigneeMember.id;
    task.assigneeMemberIds = assigneeMembers.map((member) => member.id);
  }
  const inserted = await db.transaction(async (tx) => {
    const assigneeIds = [...new Set(tasks.flatMap((task) => task.assigneeMemberIds))].sort();
    for (const assigneeId of assigneeIds) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"team-member:" + assigneeId}))`);
    }
    const available = await tx
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(and(inArray(teamMembersTable.id, assigneeIds), eq(teamMembersTable.active, true)));
    if (available.length !== assigneeIds.length) return false;
    await tx.insert(tasksTable).values(tasks);
    await tx.insert(taskOriginsTable).values(tasks.map((task) => ({
      taskId: task.id,
      createdByMemberId: actor(req).id,
      createdByRole: actor(req).role,
    })));
    return true;
  });
  if (!inserted) {
    res.status(409).json({ error: "Um dos responsáveis não está mais disponível. Atualize a página e tente novamente." });
    return;
  }
  const created = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
  await notifyTaskAssignees(tasks.flatMap((task) => task.assigneeMemberIds.map((assigneeMemberId) => ({
    id: task.id,
    title: task.title,
    assigneeMemberId,
  }))));
  res.status(201).json(created.filter(Boolean));
});

router.post("/tasks/recurring", async (req, res) => {
  await seedPromise;
  const parsed = CreateRecurringTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da repetição inválidos." });
    return;
  }
  const input = parsed.data;
  if (actor(req).role === "admin" && input.assigneeRole !== "manager" && input.assigneeRole !== "supervisor") {
    res.status(400).json({ error: "Administradores devem selecionar supervisores para delimitar as lojas." });
    return;
  }
  const selectedSupervisorIds = [...new Set(input.assigneeMemberIds ?? [])];
  if (actor(req).role === "admin" && !selectedSupervisorIds.length) {
    res.status(400).json({ error: "Selecione pelo menos um supervisor responsável." });
    return;
  }
  if (actor(req).role === "admin") {
    const activeSupervisors = await resolveActiveMembersByIds(selectedSupervisorIds, "supervisor");
    if (activeSupervisors.length !== selectedSupervisorIds.length) {
      res.status(400).json({ error: "Selecione apenas supervisores ativos." });
      return;
    }
  }
  const requestedStoreIds = [...new Set(input.storeIds)];
  if (actor(req).role === "admin") {
    const allowedStoreIds = await storeIdsForSupervisors(selectedSupervisorIds);
    const invalidStoreIds = requestedStoreIds.filter((storeId) => !allowedStoreIds.includes(storeId));
    if (invalidStoreIds.length) {
      res.status(400).json({ error: "Uma ou mais lojas selecionadas não pertencem aos supervisores escolhidos." });
      return;
    }
  }
  if (!requestedStoreIds.length) {
    res.status(400).json({ error: "Selecione pelo menos uma loja." });
    return;
  }
  if (!(await canCreateTask(req, requestedStoreIds))) {
    res.status(403).json({ error: "Você só pode criar tarefas para as lojas vinculadas ao seu perfil." });
    return;
  }
  if (actor(req).role === "supervisor" && input.assigneeRole !== "manager") {
    res.status(400).json({ error: "Tarefas criadas pela supervisão devem ser atribuídas a um gerente." });
    return;
  }
  if (input.modelObjectPath && !isNormalizedPrivateObjectPath(input.modelObjectPath)) {
    res.status(400).json({ error: "Caminho do modelo visual inválido." });
    return;
  }
  const selectedSupervisorMembers = input.assigneeRole === "supervisor"
    ? selectedSupervisorIds.length
      ? await resolveActiveMembersByIds(selectedSupervisorIds, "supervisor")
      : [await resolveActiveMember(input.assignee ?? "", "supervisor")].filter(isPresent)
    : [];
  if (input.assigneeRole === "supervisor" && (
    !selectedSupervisorMembers.length
    || selectedSupervisorMembers.length !== (selectedSupervisorIds.length || 1)
  )) {
    res.status(400).json({ error: "Selecione pelo menos um supervisor ativo." });
    return;
  }
  const stores = await db
    .select()
    .from(storesTable)
    .where(inArray(storesTable.id, requestedStoreIds));
  if (stores.length !== requestedStoreIds.length) {
    res.status(400).json({ error: "Uma ou mais lojas não foram encontradas." });
    return;
  }

  const startDate = new Date(input.dueDate);
  const occurrenceDates: Date[] = [];
  if (input.recurrenceMode === "daily_count") {
    if (!input.occurrenceCount) {
      res.status(400).json({ error: "Informe a quantidade de dias." });
      return;
    }
    for (let index = 0; index < input.occurrenceCount; index += 1) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + index);
      occurrenceDates.push(date);
    }
  } else {
    if (!input.endDate || !input.weekdays?.length) {
      res.status(400).json({ error: "Escolha os dias da semana e a data final." });
      return;
    }
    const endDate = new Date(input.endDate);
    if (endDate < startDate) {
      res.status(400).json({ error: "A data final deve ser posterior à data inicial." });
      return;
    }
    const weekdays = new Set(input.weekdays);
    const cursor = new Date(startDate);
    while (cursor <= endDate && occurrenceDates.length <= 365) {
      if (weekdays.has(cursor.getUTCDay())) occurrenceDates.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (!occurrenceDates.length) {
      res.status(400).json({ error: "Nenhuma ocorrência corresponde aos dias escolhidos." });
      return;
    }
  }

  if (occurrenceDates.length * stores.length > 10000) {
    res.status(400).json({ error: "A repetição ultrapassa o limite de 10.000 tarefas." });
    return;
  }
  const tasks = occurrenceDates.flatMap((date) => {
    const batchGroupId = stores.length > 1 ? `batch-${crypto.randomUUID()}` : null;
    const dueDate = date.toISOString().slice(0, 10);
    return stores.map((store) => ({
      id: `task-${crypto.randomUUID()}`,
      title: input.title,
      description: input.description,
      storeId: store.id,
      storeName: store.name,
      assignee: input.assigneeRole === "supervisor"
        ? selectedSupervisorMembers.map((member) => member.name.trim()).join(", ")
        : store.manager || "Gerente não definido",
      assigneeMemberId: null as string | null,
      assigneeMemberIds: input.assigneeRole === "supervisor" ? selectedSupervisorMembers.map((member) => member.id) : [],
      assigneeRole: input.assigneeRole,
      batchGroupId,
      category: input.category,
      priority: input.priority,
      dueDate,
      dueTime: input.dueTime,
      evidenceRequired: input.evidenceRequired,
      evidenceTypes: input.evidenceTypes ?? [],
      modelObjectPath: input.modelObjectPath ?? null,
      instructions: input.instructions,
      status: "pending",
    }));
  });
  for (const task of tasks) {
    const store = stores.find((item) => item.id === task.storeId);
    const assigneeMembers = task.assigneeRole === "manager" && store
      ? [await resolveManagerForStore(store)].filter(isPresent)
      : selectedSupervisorMembers;
    if (!assigneeMembers.length) {
      res.status(400).json({ error: "Responsável não encontrado." });
      return;
    }
    const assigneeMember = assigneeMembers[0];
    if (task.assigneeRole === "manager" && assigneeMember.storeId !== task.storeId) {
      res.status(400).json({ error: `A loja ${task.storeName} não possui um gerente ativo vinculado.` });
      return;
    }
    task.assignee = assigneeMembers.map((member) => member.name.trim()).join(", ");
    task.assigneeMemberId = assigneeMember.id;
    task.assigneeMemberIds = assigneeMembers.map((member) => member.id);
  }
  const inserted = await db.transaction(async (tx) => {
    const assigneeIds = [...new Set(tasks.flatMap((task) => task.assigneeMemberIds))].sort();
    for (const assigneeId of assigneeIds) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"team-member:" + assigneeId}))`);
    }
    const available = await tx
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(and(inArray(teamMembersTable.id, assigneeIds), eq(teamMembersTable.active, true)));
    if (available.length !== assigneeIds.length) return false;
    await tx.insert(tasksTable).values(tasks);
    await tx.insert(taskOriginsTable).values(tasks.map((task) => ({
      taskId: task.id,
      createdByMemberId: actor(req).id,
      createdByRole: actor(req).role,
    })));
    return true;
  });
  if (!inserted) {
    res.status(409).json({ error: "Um dos responsáveis não está mais disponível. Atualize a página e tente novamente." });
    return;
  }
  const created = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
  await notifyTaskAssignees(tasks.flatMap((task) => task.assigneeMemberIds.map((assigneeMemberId) => ({
    id: task.id,
    title: task.title,
    assigneeMemberId,
  }))));
  res.status(201).json(created.filter(Boolean));
});

router.get("/tasks/:id", async (req, res) => {
  const parsed = GetTaskParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Identificador inválido." });
    return;
  }
  const task = await getTaskWithEvidence(parsed.data.id);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (!(await canAccessTask(req, task)) || !(await isVisibleToAdmin(req, task))) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  res.json(task);
});

router.patch("/tasks/:id", async (req, res) => {
  await seedPromise;
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Atualização inválida." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task || !(await canAccessTask(req, task)) || !(await isVisibleToAdmin(req, task))) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (actor(req).role !== "admin" && (!canExecuteTask(req, task) || Object.keys(body.data).some((key) => key !== "status") || !body.data.status || !["pending", "in_progress", "rejected"].includes(body.data.status))) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  await db
    .update(tasksTable)
    .set(body.data)
    .where(eq(tasksTable.id, params.data.id));
  const updatedTask = await getTaskWithEvidence(params.data.id);
  if (!updatedTask) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  res.json(updatedTask);
});

router.delete("/tasks/:id", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador inválido." });
    return;
  }
  const [task] = await db
    .select({ id: tasksTable.id, modelObjectPath: tasksTable.modelObjectPath })
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id));
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  await deleteTaskData([params.data.id]);
  res.status(204).send();
});

router.delete("/tasks", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const body = DeleteAllTasksBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Selecione pelo menos uma tarefa para excluir." });
    return;
  }
  await deleteTaskData(body.data.taskIds);
  res.status(204).send();
});

router.post("/tasks/:id/evidence", async (req, res) => {
  await seedPromise;
  const params = AddTaskEvidenceParams.safeParse(req.params);
  const body = AddTaskEvidenceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Evidência inválida." });
    return;
  }
  if (!isNormalizedPrivateObjectPath(body.data.objectPath)) {
    res.status(400).json({ error: "Caminho de evidência inválido." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (!(await canAccessTask(req, task)) || !canExecuteTask(req, task)) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (task.status === "pending_review") {
    res.status(409).json({ error: "Esta tarefa aguarda a conferência do supervisor." });
    return;
  }
  const evidence = {
    id: `evidence-${crypto.randomUUID()}`,
    taskId: params.data.id,
    type: body.data.type,
    fileName: body.data.fileName,
    objectPath: body.data.objectPath,
    userName: actor(req).name,
    location: body.data.location ?? null,
  };
  await db.insert(evidencesTable).values(evidence);
  await db
    .update(tasksTable)
    .set({ status: "in_progress" })
    .where(eq(tasksTable.id, params.data.id));
  res.status(201).json({
    ...evidence,
    createdAt: new Date().toISOString(),
  });
});

router.delete("/tasks/:id/evidence/:evidenceId", async (req, res) => {
  await seedPromise;
  const params = DeleteTaskEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador da evidência inválido." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task || !(await canAccessTask(req, task)) || !canExecuteTask(req, task)) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (task.status === "completed" || task.status === "pending_review") {
    res.status(409).json({ error: "Evidências não podem ser apagadas depois que a execução foi finalizada." });
    return;
  }
  const [evidence] = await db
    .select({ id: evidencesTable.id, objectPath: evidencesTable.objectPath })
    .from(evidencesTable)
    .where(and(
      eq(evidencesTable.id, params.data.evidenceId),
      eq(evidencesTable.taskId, params.data.id),
    ));
  if (!evidence) {
    res.status(404).json({ error: "Evidência não encontrada." });
    return;
  }
  await db.delete(evidencesTable).where(eq(evidencesTable.id, evidence.id));
  if (evidence.objectPath) {
    await Promise.allSettled([objectStorageService.deleteObjectEntity(evidence.objectPath)]);
  }
  res.status(204).send();
});

router.post("/tasks/:id/complete", async (req, res) => {
  await seedPromise;
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador inválido." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (!(await canAccessTask(req, task)) || !canExecuteTask(req, task)) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (task.status === "pending_review") {
    res.status(409).json({ error: "Esta tarefa aguarda a conferência do supervisor." });
    return;
  }
  if (task.evidenceRequired && task.evidence.length === 0) {
    res.status(400).json({
      error: "Sem evidência = não concluído. Adicione a comprovação obrigatória.",
    });
    return;
  }
  const requiresSupervisorReview = task.assigneeRole === "manager";
  await db
    .update(tasksTable)
    .set({
      status: requiresSupervisorReview ? "pending_review" : "completed",
      completedAt: new Date(),
      completedBy: actor(req).name,
    })
    .where(eq(tasksTable.id, params.data.id));
  const completed = await getTaskWithEvidence(params.data.id);
  res.json(completed);
});

router.post("/tasks/:id/review", async (req, res) => {
  await seedPromise;
  const params = ReviewTaskParams.safeParse(req.params);
  const body = ReviewTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Conferência inválida." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task || !(await canAccessTask(req, task)) || !(await canReviewTask(req, task))) {
    res.status(403).json({ error: "Somente o supervisor vinculado à loja pode conferir esta tarefa." });
    return;
  }
  if (task.status !== "pending_review") {
    res.status(400).json({ error: "Esta tarefa não está aguardando conferência." });
    return;
  }
  const comment = body.data.comment?.trim() ?? "";
  if (comment) {
    await db.insert(taskCommentsTable).values({
      id: `comment-${crypto.randomUUID()}`,
      taskId: task.id,
      userId: actor(req).id,
      message: comment,
      type: body.data.decision === "reject" ? "supervisor_rejection" : "supervisor_note",
    });
  }
  await db
    .update(tasksTable)
    .set(body.data.decision === "approve"
      ? { status: "completed", completedAt: new Date() }
      : { status: "rejected", completedAt: null, completedBy: null })
    .where(eq(tasksTable.id, task.id));
  const reviewed = await getTaskWithEvidence(task.id);
  res.json(reviewed);
});

router.post("/tasks/:id/comments", async (req, res) => {
  await seedPromise;
  const params = AddTaskCommentParams.safeParse(req.params);
  const body = AddTaskCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Comentário inválido." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task || !(await canAccessTask(req, task)) || !(await isVisibleToAdmin(req, task))) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  const comment = {
    id: `comment-${crypto.randomUUID()}`,
    taskId: task.id,
    userId: actor(req).id,
    message: body.data.message.trim(),
    type: actor(req).role === "manager" ? "manager_note" : actor(req).role === "supervisor" ? "supervisor_note" : "admin_note",
  };
  await db.insert(taskCommentsTable).values(comment);
  res.status(201).json({
    ...comment,
    createdAt: new Date().toISOString(),
    userName: actor(req).name,
  });
});

router.get("/stores", async (req, res) => {
  await seedPromise;
  const ids = await scopedStoreIds(req);
  res.json(await db.select().from(storesTable).where(ids === null ? undefined : inArray(storesTable.id, ids)).orderBy(desc(storesTable.execution)));
});

router.post("/stores", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da loja inválidos." });
    return;
  }
  const manager = await resolveActiveMember(parsed.data.manager ?? "", "manager");
  const supervisor = await resolveActiveMember(parsed.data.supervisor ?? "", "supervisor");
  if (manager === undefined || supervisor === undefined) {
    res.status(400).json({ error: "Gerente ou supervisor inválido, inativo ou ambíguo." });
    return;
  }
  const store = {
    id: `store-${crypto.randomUUID()}`,
    name: parsed.data.name,
    city: parsed.data.city,
    region: parsed.data.region,
    manager: parsed.data.manager?.trim() ?? "",
    managerMemberId: manager?.id ?? null,
    supervisor: parsed.data.supervisor?.trim() ?? "",
    supervisorMemberId: supervisor?.id ?? null,
    execution: 0,
  };
  await db.insert(storesTable).values(store);
  if (manager) await applyMemberStoreAssignment(manager, store.id);
  res.status(201).json(store);
});

router.patch("/stores/:id", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = UpdateStoreParams.safeParse(req.params);
  const body = UpdateStoreBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Atualização da loja inválida." });
    return;
  }
  const [existing] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Loja não encontrada." });
    return;
  }
  const managerName = body.data.manager === undefined ? existing.manager : body.data.manager.trim();
  const supervisorName = body.data.supervisor === undefined ? existing.supervisor : body.data.supervisor.trim();
  const manager = await resolveActiveMember(managerName, "manager");
  const supervisor = await resolveActiveMember(supervisorName, "supervisor");
  if (manager === undefined || supervisor === undefined) {
    res.status(400).json({ error: "Gerente ou supervisor inválido, inativo ou ambíguo." });
    return;
  }
  if (existing.managerMemberId && existing.managerMemberId !== manager?.id) {
    await db.update(teamMembersTable).set({ storeId: null }).where(eq(teamMembersTable.id, existing.managerMemberId));
  }
  await db
    .update(storesTable)
    .set({ ...body.data, manager: managerName, managerMemberId: manager?.id ?? null, supervisor: supervisorName, supervisorMemberId: supervisor?.id ?? null })
    .where(eq(storesTable.id, params.data.id));
  if (manager) await applyMemberStoreAssignment(manager, params.data.id);
  const [updated] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.id, params.data.id));
  res.json(updated);
});

router.delete("/stores/:id", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = DeleteStoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador da loja inválido." });
    return;
  }
  const [existing] = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Loja não encontrada." });
    return;
  }
  const linkedTasks = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(eq(tasksTable.storeId, params.data.id));
  const taskIds = linkedTasks.map((task) => task.id);
  const taskModels = taskIds.length
    ? await db.select({ modelObjectPath: tasksTable.modelObjectPath }).from(tasksTable).where(inArray(tasksTable.id, taskIds))
    : [];
  const evidence = taskIds.length
    ? await db.select({ objectPath: evidencesTable.objectPath }).from(evidencesTable).where(inArray(evidencesTable.taskId, taskIds))
    : [];
  await db.transaction(async (tx) => {
    if (taskIds.length) {
      await tx.delete(evidencesTable).where(inArray(evidencesTable.taskId, taskIds));
      await tx.delete(taskCommentsTable).where(inArray(taskCommentsTable.taskId, taskIds));
      await tx.delete(taskOriginsTable).where(inArray(taskOriginsTable.taskId, taskIds));
      await tx.delete(tasksTable).where(eq(tasksTable.storeId, params.data.id));
    }
    await tx.update(teamMembersTable).set({ storeId: null }).where(eq(teamMembersTable.storeId, params.data.id));
    await tx.delete(storesTable).where(eq(storesTable.id, params.data.id));
  });
  await Promise.all([
    ...evidence.filter((item) => item.objectPath).map((item) => objectStorageService.deleteObjectEntity(item.objectPath!)),
    ...taskModels.filter((item) => item.modelObjectPath).map((item) => objectStorageService.deleteObjectEntity(item.modelObjectPath!)),
  ]);
  res.status(204).send();
});

router.get("/team-members", async (req, res) => {
  await seedPromise;
  const parsed = ListTeamMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtro de equipe inválido." });
    return;
  }
  const currentMember = actor(req);
  if (currentMember.role !== "admin" && currentMember.role !== "supervisor") {
    res.status(403).json({ error: "Você não pode consultar a equipe." });
    return;
  }
  const filters = [];
  if (currentMember.role === "admin" && parsed.data.role) {
    filters.push(eq(teamMembersTable.role, parsed.data.role));
  } else if (currentMember.role === "supervisor") {
    const visibleStoreIds = await scopedStoreIds(req);
    if (!visibleStoreIds || !visibleStoreIds.length) {
      res.json([]);
      return;
    }
    const visibleStores = await db
      .select({
        manager: storesTable.manager,
        managerMemberId: storesTable.managerMemberId,
      })
      .from(storesTable)
      .where(inArray(storesTable.id, visibleStoreIds));
    const managerIds = visibleStores
      .map((store) => store.managerMemberId)
      .filter((id): id is string => Boolean(id));
    const managerNames = visibleStores
      .map((store) => store.manager.trim().toLowerCase())
      .filter(Boolean);
    const managerScope = [
      inArray(teamMembersTable.storeId, visibleStoreIds),
      ...(managerIds.length ? [inArray(teamMembersTable.id, managerIds)] : []),
      ...managerNames.map((name) => sql`lower(trim(${teamMembersTable.name})) = ${name}`),
    ];
    filters.push(
      and(
        eq(teamMembersTable.role, "manager"),
        eq(teamMembersTable.active, true),
        or(...managerScope),
      ),
    );
  }
  const members = await db
    .select()
    .from(teamMembersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(teamMembersTable.name);
  res.json(members.map((member) => ({
    ...member,
    createdAt: member.createdAt.toISOString(),
  })));
});

router.post("/team-members", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = CreateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do colaborador inválidos." });
    return;
  }
  const [duplicate] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.email, parsed.data.email.trim().toLowerCase()));
  if (duplicate) {
    res.status(409).json({ error: "Já existe um colaborador com este e-mail." });
    return;
  }
  if (parsed.data.email.trim().toLowerCase() === "david@drogariasminasmais.com.br") {
    res.status(403).json({ error: "A conta administrativa exclusiva não pode ser criada por esta API." });
    return;
  }
  const member = {
    id: `member-${crypto.randomUUID()}`,
    name: parsed.data.name.trim(),
    email: parsed.data.email.trim().toLowerCase(),
    phone: parsed.data.phone ?? "",
    role: parsed.data.role,
    storeId: parsed.data.role === "manager" ? parsed.data.storeId ?? null : null,
    active: true,
  };
  if (member.storeId) {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, member.storeId));
    if (!store) {
      res.status(400).json({ error: "Loja não encontrada." });
      return;
    }
    if (member.role === "manager" && store.managerMemberId) {
      res.status(409).json({ error: "A loja já possui um gerente atribuído." });
      return;
    }
  }
  await db.insert(teamMembersTable).values(member);
  if (member.storeId) {
    await db
      .update(storesTable)
      .set(member.role === "manager" ? { manager: member.name, managerMemberId: member.id } : { supervisor: member.name, supervisorMemberId: member.id })
      .where(eq(storesTable.id, member.storeId));
  }
  res.status(201).json({ ...member, createdAt: new Date().toISOString() });
});

router.patch("/team-members/:id", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = UpdateTeamMemberParams.safeParse(req.params);
  const body = UpdateTeamMemberBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Atualização do colaborador inválida." });
    return;
  }
  const [existing] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  const isOriginalAdmin = existing.email.trim().toLowerCase() === "david@drogariasminasmais.com.br";
  const changingOriginalEmail = body.data.email !== undefined
    && body.data.email.trim().toLowerCase() !== existing.email.trim().toLowerCase();
  if (isOriginalAdmin && (
    (body.data.role !== undefined && body.data.role !== "admin")
    || body.data.active === false
    || changingOriginalEmail
  )) {
    res.status(403).json({ error: "A conta administrativa original não pode ser rebaixada, desativada ou removida." });
    return;
  }
  if (body.data.email?.trim().toLowerCase() === "david@drogariasminasmais.com.br") {
    res.status(403).json({ error: "A conta administrativa exclusiva não pode ser atribuída." });
    return;
  }
  if (body.data.email && body.data.email.trim().toLowerCase() !== existing.email.trim().toLowerCase()) {
    const [duplicate] = await db
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
    .where(eq(teamMembersTable.email, body.data.email.trim().toLowerCase()));
    if (duplicate) {
      res.status(409).json({ error: "Já existe um colaborador com este e-mail." });
      return;
    }
  }
  const nextRole = body.data.role ?? existing.role;
  const nextStoreId = nextRole === "manager"
    ? body.data.storeId === undefined ? existing.storeId : body.data.storeId
    : null;
  if (nextStoreId) {
    const [store] = await db.select().from(storesTable).where(eq(storesTable.id, nextStoreId));
    if (!store) {
      res.status(400).json({ error: "Loja não encontrada." });
      return;
    }
    if (nextRole === "manager" && store.managerMemberId && store.managerMemberId !== existing.id) {
      res.status(409).json({ error: "A loja já possui um gerente atribuído." });
      return;
    }
  }
  if (existing.role === "manager" && existing.storeId && (nextRole !== "manager" || nextStoreId !== existing.storeId)) {
    await db.update(storesTable).set({ manager: "", managerMemberId: null }).where(eq(storesTable.managerMemberId, existing.id));
  }
  if (existing.role === "supervisor" && (nextRole !== "supervisor" || nextStoreId !== existing.storeId)) {
    await db.update(storesTable).set({ supervisor: "", supervisorMemberId: null }).where(eq(storesTable.supervisorMemberId, existing.id));
  }
  await db
    .update(teamMembersTable)
    .set({
      ...body.data,
      role: nextRole,
      storeId: nextStoreId,
      ...(body.data.name ? { name: body.data.name.trim() } : {}),
      ...(body.data.email ? { email: body.data.email.trim().toLowerCase() } : {}),
    })
    .where(eq(teamMembersTable.id, params.data.id));
  const [updated] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));
  if (updated?.storeId) {
    await db
      .update(storesTable)
      .set(updated.role === "manager" ? { manager: updated.name, managerMemberId: updated.id } : { supervisor: updated.name, supervisorMemberId: updated.id })
      .where(eq(storesTable.id, updated.storeId));
  }
  if (updated?.role === "supervisor") {
    await db.update(storesTable)
      .set({ supervisor: updated.name })
      .where(eq(storesTable.supervisorMemberId, updated.id));
  }
  res.json(updated ? { ...updated, createdAt: updated.createdAt.toISOString() } : updated);
});

router.delete("/team-members/:id", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador do colaborador inválido." });
    return;
  }
  const [existing] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  if (existing.email.trim().toLowerCase() === "david@drogariasminasmais.com.br") {
    res.status(403).json({ error: "A conta administrativa original não pode ser desativada." });
    return;
  }
  if (existing.role === "manager") {
    await db.update(storesTable).set({ manager: "", managerMemberId: null }).where(eq(storesTable.managerMemberId, existing.id));
  } else if (existing.role === "supervisor") {
    await db.update(storesTable).set({ supervisor: "", supervisorMemberId: null }).where(eq(storesTable.supervisorMemberId, existing.id));
  }
  await db
    .update(teamMembersTable)
    .set({ active: false, storeId: null })
    .where(eq(teamMembersTable.id, params.data.id));
  res.status(204).send();
});

router.delete("/team-members/:id/permanent", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador do colaborador inválido." });
    return;
  }
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"team-member:" + params.data.id}))`);
    const [existing] = await tx
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, params.data.id));
    if (!existing) return "missing" as const;
    if (existing.email.trim().toLowerCase() === "david@drogariasminasmais.com.br") {
      return "protected" as const;
    }
    const linkedTasks = await tx
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(or(
        eq(tasksTable.assigneeMemberId, existing.id),
        and(
          isNull(tasksTable.assigneeMemberId),
          sql`lower(trim(${tasksTable.assignee})) = ${existing.name.trim().toLowerCase()}`,
        ),
      ))
      .limit(1);
    if (linkedTasks.length) return "history" as const;
    await tx.update(storesTable)
      .set({ manager: "", managerMemberId: null })
      .where(eq(storesTable.managerMemberId, existing.id));
    await tx.update(storesTable)
      .set({ supervisor: "", supervisorMemberId: null })
      .where(eq(storesTable.supervisorMemberId, existing.id));
    await tx.delete(teamMembersTable).where(eq(teamMembersTable.id, existing.id));
    return "deleted" as const;
  });
  if (outcome === "missing") {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  if (outcome === "protected") {
    res.status(403).json({ error: "A conta administrativa original não pode ser excluída." });
    return;
  }
  if (outcome === "history") {
    res.status(409).json({
      error: "Este colaborador possui histórico de tarefas. Desative-o para preservar a auditoria.",
    });
    return;
  }
  res.status(204).send();
});

router.get("/rankings", async (req, res) => {
  await seedPromise;
  const ids = await scopedStoreIds(req);
  const requestedDays = Number(req.query.days);
  const days = requestedDays === 7 || requestedDays === 90 ? requestedDays : 30;
  const region = typeof req.query.region === "string" ? req.query.region.trim() : "";
  const currentCycle = currentRankingCycle(days);
  const previousCycle = previousRankingCycle(currentCycle, days);
  const storeFilters = [
    ids === null ? undefined : inArray(storesTable.id, ids),
    region ? eq(storesTable.region, region) : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  const stores = await db
    .select()
    .from(storesTable)
    .where(storeFilters.length ? and(...storeFilters) : undefined);
  const storeIds = stores.map((store) => store.id);
  const taskFilters = [
    gte(tasksTable.dueDate, previousCycle.start),
    lte(tasksTable.dueDate, currentCycle.end),
    storeIds.length ? inArray(tasksTable.storeId, storeIds) : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);
  const tasks = storeIds.length
    ? await db
      .select({
        storeId: tasksTable.storeId,
        dueDate: tasksTable.dueDate,
        status: tasksTable.status,
        completedAt: tasksTable.completedAt,
        createdAt: tasksTable.createdAt,
      })
      .from(tasksTable)
      .where(and(...taskFilters))
    : [];

  const rankedStores = stores
    .map((store) => {
      const currentTasks = tasks.filter(
        (task) => task.storeId === store.id && task.dueDate >= currentCycle.start && task.dueDate <= currentCycle.end,
      );
      const previousTasks = tasks.filter(
        (task) => task.storeId === store.id && task.dueDate >= previousCycle.start && task.dueDate <= previousCycle.end,
      );
      const currentMetrics = rankingMetrics(currentTasks);
      const previousMetrics = rankingMetrics(previousTasks);
      const trend = currentMetrics.points > previousMetrics.points
        ? "up"
        : currentMetrics.points < previousMetrics.points
          ? "down"
          : "stable";

      return {
        storeName: store.name,
        manager: store.manager,
        execution: currentMetrics.execution,
        points: currentMetrics.points,
        averageExecutionMinutes: currentMetrics.averageExecutionMinutes,
        trend,
        groupName: rankingGroupForStore(store.name),
        supervisorName: store.supervisor || "Sem supervisor",
      };
    })
    .sort((left, right) => right.points - left.points || left.storeName.localeCompare(right.storeName));

  const groupPositions = new Map<string, number>();
  res.json(
    rankedStores.map((entry, index) => {
      const position = groupPositions.set(entry.groupName, (groupPositions.get(entry.groupName) ?? 0) + 1).get(entry.groupName)!;
      return {
        position,
        ...entry,
      };
    }),
  );
});

export default router;
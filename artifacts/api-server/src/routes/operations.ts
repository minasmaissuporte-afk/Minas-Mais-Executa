import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  AddTaskEvidenceBody,
  AddTaskEvidenceParams,
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
  UpdateTaskBody,
  UpdateTaskParams,
} from "@workspace/api-zod";
import {
  activityTable,
  db,
  evidencesTable,
  teamMembersTable,
  storesTable,
  tasksTable,
} from "@workspace/db";
import { actor, requireAdmin } from "../middlewares/authorization";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

const now = new Date();
const today = now.toISOString().slice(0, 10);
const objectStorageService = new ObjectStorageService();

function isNormalizedPrivateObjectPath(path: string): boolean {
  return path.startsWith("/objects/")
    && path.length > "/objects/".length
    && !path.includes("\\")
    && !path.split("/").some((segment) => segment === "." || segment === "..")
    && objectStorageService.normalizeObjectEntityPath(path) === path;
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

function canExecuteTask(req: import("express").Request, task: { assignee: string; assigneeMemberId: string | null }): boolean {
  const member = actor(req);
  return member.role === "admin" || task.assigneeMemberId === member.id;
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

  const existingTasks = await db.select({ id: tasksTable.id }).from(tasksTable);
  if (existingTasks.length === 0) {
    await db
      .insert(tasksTable)
      .values([
        {
          id: "task-opening",
          title: "Checklist de abertura",
          description: "Garanta que a loja esteja pronta para receber os clientes.",
          storeId: "store-centro",
          storeName: "Loja Centro",
          assignee: "João Mendes",
          category: "Rotina",
          priority: "high",
          dueDate: today,
          dueTime: "07:30",
          status: "completed",
          evidenceRequired: true,
          evidenceTypes: ["photo"],
          instructions: "Confira fachada, balcões, computadores e limpeza.",
          completedAt: new Date(),
          completedBy: "João Mendes",
        },
        {
          id: "task-merchandising",
          title: "Organização da ponta de gôndola",
          description: "Atualize a exposição da campanha de inverno conforme o padrão.",
          storeId: "store-centro",
          storeName: "Loja Centro",
          assignee: "João Mendes",
          category: "Merchandising",
          priority: "high",
          dueDate: today,
          dueTime: "10:00",
          status: "in_progress",
          evidenceRequired: true,
          evidenceTypes: ["photo", "video"],
          instructions: "Use a foto modelo da campanha e registre o antes e depois.",
        },
        {
          id: "task-prices",
          title: "Verificação de preços",
          description: "Confira os preços dos produtos estratégicos da semana.",
          storeId: "store-centro",
          storeName: "Loja Centro",
          assignee: "João Mendes",
          category: "Comercial",
          priority: "medium",
          dueDate: today,
          dueTime: "12:00",
          status: "pending",
          evidenceRequired: false,
          evidenceTypes: [],
          instructions: "Compare etiquetas, sistema e tabloide vigente.",
        },
        {
          id: "task-campaign",
          title: "Ação comercial de inverno",
          description: "Ative a comunicação da campanha nos pontos definidos.",
          storeId: "store-savassi",
          storeName: "Loja Savassi",
          assignee: "Mariana Alves",
          category: "Marketing",
          priority: "medium",
          dueDate: today,
          dueTime: "14:00",
          status: "pending",
          evidenceRequired: true,
          evidenceTypes: ["photo"],
          instructions: "Fotografe a fachada e a ponta promocional após a montagem.",
        },
        {
          id: "task-result",
          title: "Registrar resultado de vendas",
          description: "Informe o resultado da ação comercial do dia.",
          storeId: "store-contagem",
          storeName: "Loja Contagem",
          assignee: "Carlos Eduardo",
          category: "Resultados",
          priority: "low",
          dueDate: today,
          dueTime: "17:00",
          status: "overdue",
          evidenceRequired: false,
          evidenceTypes: [],
          instructions: "Registre faturamento, clientes e ticket médio.",
        },
      ])
      .onConflictDoNothing();
  }

  const existingActivity = await db
    .select({ id: activityTable.id })
    .from(activityTable);
  if (existingActivity.length === 0) {
    await db
      .insert(activityTable)
      .values([
        {
          id: "activity-1",
          title: "Tarefa concluída",
          detail: "João Mendes enviou uma foto para Checklist de abertura.",
          tone: "success",
          createdAt: new Date(Date.now() - 1000 * 60 * 18),
        },
        {
          id: "activity-2",
          title: "Atenção necessária",
          detail: "Registrar resultado de vendas está atrasada na Loja Contagem.",
          tone: "warning",
          createdAt: new Date(Date.now() - 1000 * 60 * 42),
        },
        {
          id: "activity-3",
          title: "Nova tarefa recebida",
          detail: "Ação comercial de inverno foi atribuída à Loja Savassi.",
          tone: "info",
          createdAt: new Date(Date.now() - 1000 * 60 * 75),
        },
      ])
      .onConflictDoNothing();
  }

  const existingEvidence = await db
    .select({ id: evidencesTable.id })
    .from(evidencesTable);
  if (existingEvidence.length === 0) {
    await db
      .insert(evidencesTable)
      .values({
        id: "evidence-opening",
        taskId: "task-opening",
        type: "photo",
        fileName: "checklist-abertura.jpg",
        userName: "João Mendes",
        location: "Loja Centro",
        createdAt: new Date(Date.now() - 1000 * 60 * 25),
      })
      .onConflictDoNothing();
  }

  const storesNeedingLinks = await db.select().from(storesTable);
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
    const assignee = await resolveActiveMember(task.assignee, task.assigneeRole);
    if (assignee && (task.assigneeRole !== "manager" || assignee.storeId === task.storeId)) {
      await db.update(tasksTable)
        .set({ assigneeMemberId: assignee.id, assignee: assignee.name.trim() })
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
  return {
    ...task,
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
    completedAt: task.completedAt?.toISOString() ?? null,
    completedBy: task.completedBy ?? null,
  };
}

router.get("/dashboard/summary", async (req, res) => {
  await seedPromise;
  const [tasks, stores] = await Promise.all([
    db.select().from(tasksTable),
    db.select().from(storesTable),
  ]);
  const visibleStoreIds = await scopedStoreIds(req);
  const visibleTasks = visibleStoreIds === null ? tasks : tasks.filter((task) => visibleStoreIds.includes(task.storeId));
  const visibleStores = visibleStoreIds === null ? stores : stores.filter((store) => visibleStoreIds.includes(store.id));
  const todaysTasks = visibleTasks.filter((task) => task.dueDate === today);
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
  const parsed = ListTasksQueryParams.safeParse(req.query);
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
  res.json(payload.filter(Boolean));
});

router.post("/tasks", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da tarefa inválidos." });
    return;
  }
  const [selectedStore] = await db.select().from(storesTable).where(eq(storesTable.id, parsed.data.storeId));
  if (!selectedStore) {
    res.status(400).json({ error: "Loja não encontrada." });
    return;
  }
  const task = {
    id: `task-${crypto.randomUUID()}`,
    ...parsed.data,
    storeName: selectedStore.name,
    assigneeRole: parsed.data.assigneeRole ?? "manager",
    dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
    evidenceTypes: parsed.data.evidenceTypes ?? [],
    status: "pending",
  };
  const assigneeMember = await resolveActiveMember(task.assignee, task.assigneeRole);
  if (!assigneeMember || !assigneeMember.active || assigneeMember.role !== task.assigneeRole) {
    res.status(400).json({ error: "Responsável não encontrado." });
    return;
  }
  if (task.assigneeRole === "manager" && assigneeMember.storeId !== selectedStore.id) {
    res.status(400).json({ error: "O gerente responsável não está vinculado à loja selecionada." });
    return;
  }
  (task as typeof task & { assigneeMemberId: string }).assigneeMemberId = assigneeMember.id;
  await db.insert(tasksTable).values(task);
  const result = await getTaskWithEvidence(task.id);
  res.status(201).json(result);
});

router.post("/tasks/bulk", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = CreateBulkTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da tarefa em massa inválidos." });
    return;
  }
  if (parsed.data.assigneeRole === "supervisor" && !parsed.data.assignee?.trim()) {
    res.status(400).json({ error: "Selecione o supervisor responsável." });
    return;
  }
  const requestedStoreIds = [...new Set(parsed.data.storeIds)];
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
      ? parsed.data.assignee!.trim()
      : store.manager || "Gerente não definido",
    assigneeRole: parsed.data.assigneeRole,
    batchGroupId,
    category: parsed.data.category,
    priority: parsed.data.priority,
    dueDate,
    dueTime: parsed.data.dueTime,
    evidenceRequired: parsed.data.evidenceRequired,
    evidenceTypes: parsed.data.evidenceTypes ?? [],
    instructions: parsed.data.instructions,
    status: "pending",
  }));
  for (const task of tasks) {
    const assigneeMember = await resolveActiveMember(task.assignee, task.assigneeRole);
    if (!assigneeMember || !assigneeMember.active || assigneeMember.role !== task.assigneeRole) {
      res.status(400).json({ error: "Responsável não encontrado." });
      return;
    }
    if (task.assigneeRole === "manager" && assigneeMember.storeId !== task.storeId) {
      res.status(400).json({ error: `A loja ${task.storeName} não possui um gerente ativo vinculado.` });
      return;
    }
    (task as typeof task & { assigneeMemberId: string }).assigneeMemberId = assigneeMember.id;
  }
  await db.transaction(async (tx) => {
    await tx.insert(tasksTable).values(tasks);
  });
  const created = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
  res.status(201).json(created.filter(Boolean));
});

router.post("/tasks/recurring", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = CreateRecurringTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da repetição inválidos." });
    return;
  }
  const input = parsed.data;
  if (input.assigneeRole === "supervisor" && !input.assignee?.trim()) {
    res.status(400).json({ error: "Selecione o supervisor responsável." });
    return;
  }
  const requestedStoreIds = [...new Set(input.storeIds)];
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
        ? input.assignee!.trim()
        : store.manager || "Gerente não definido",
      assigneeRole: input.assigneeRole,
      batchGroupId,
      category: input.category,
      priority: input.priority,
      dueDate,
      dueTime: input.dueTime,
      evidenceRequired: input.evidenceRequired,
      evidenceTypes: input.evidenceTypes ?? [],
      instructions: input.instructions,
      status: "pending",
    }));
  });
  for (const task of tasks) {
    const assigneeMember = await resolveActiveMember(task.assignee, task.assigneeRole);
    if (!assigneeMember || !assigneeMember.active || assigneeMember.role !== task.assigneeRole) {
      res.status(400).json({ error: "Responsável não encontrado." });
      return;
    }
    if (task.assigneeRole === "manager" && assigneeMember.storeId !== task.storeId) {
      res.status(400).json({ error: `A loja ${task.storeName} não possui um gerente ativo vinculado.` });
      return;
    }
    (task as typeof task & { assigneeMemberId: string }).assigneeMemberId = assigneeMember.id;
  }
  await db.transaction(async (tx) => {
    await tx.insert(tasksTable).values(tasks);
  });
  const created = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
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
  if (!(await canAccessTask(req, task))) {
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
  if (!task || !(await canAccessTask(req, task))) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  if (actor(req).role !== "admin" && (!canExecuteTask(req, task) || Object.keys(body.data).some((key) => key !== "status") || !body.data.status || !["pending", "in_progress"].includes(body.data.status))) {
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
  if (task.evidenceRequired && task.evidence.length === 0) {
    res.status(400).json({
      error: "Sem evidência = não concluído. Adicione a comprovação obrigatória.",
    });
    return;
  }
  await db
    .update(tasksTable)
    .set({
      status: "completed",
      completedAt: new Date(),
       completedBy: actor(req).name,
    })
    .where(eq(tasksTable.id, params.data.id));
  const completed = await getTaskWithEvidence(params.data.id);
  res.json(completed);
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
    .where(eq(tasksTable.storeId, params.data.id))
    .limit(1);
  if (linkedTasks.length > 0) {
    res.status(409).json({ error: "A loja possui tarefas vinculadas e não pode ser excluída." });
    return;
  }
  await db.delete(storesTable).where(eq(storesTable.id, params.data.id));
  res.status(204).send();
});

router.get("/team-members", async (req, res) => {
  await seedPromise;
  if (!requireAdmin(req, res)) return;
  const parsed = ListTeamMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtro de equipe inválido." });
    return;
  }
  const members = await db
    .select()
    .from(teamMembersTable)
    .where(parsed.data.role ? eq(teamMembersTable.role, parsed.data.role) : undefined)
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
    storeId: parsed.data.storeId ?? null,
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
  if (existing.email.trim().toLowerCase() === "david@drogariasminasmais.com.br" || existing.role === "admin") {
    res.status(403).json({ error: "A conta administrativa exclusiva não pode ser alterada." });
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
  const nextStoreId = body.data.storeId === undefined ? existing.storeId : body.data.storeId;
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
  if (existing.email.trim().toLowerCase() === "david@drogariasminasmais.com.br" || existing.role === "admin") {
    res.status(403).json({ error: "A conta administrativa exclusiva não pode ser desativada." });
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

router.get("/rankings", async (req, res) => {
  await seedPromise;
  const ids = await scopedStoreIds(req);
  const stores = await db
    .select()
    .from(storesTable)
    .where(ids === null ? undefined : inArray(storesTable.id, ids))
    .orderBy(desc(storesTable.execution));
  res.json(
    stores.map((store, index) => ({
      position: index + 1,
      storeName: store.name,
      manager: store.manager,
      execution: store.execution,
      trend: index === 0 ? "up" : index === 3 ? "down" : "stable",
    })),
  );
});

export default router;
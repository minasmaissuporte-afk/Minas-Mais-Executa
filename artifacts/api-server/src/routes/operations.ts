import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
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

const router: IRouter = Router();

const now = new Date();
const today = now.toISOString().slice(0, 10);

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
}

const seedPromise = ensureSeedData().catch((error) => {
  console.error("Failed to seed operational data", error);
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
      createdAt: item.createdAt.toISOString(),
      userName: item.userName,
      location: item.location,
    })),
    completedAt: task.completedAt?.toISOString() ?? null,
    completedBy: task.completedBy ?? null,
  };
}

router.get("/dashboard/summary", async (_req, res) => {
  await seedPromise;
  const [tasks, stores] = await Promise.all([
    db.select().from(tasksTable),
    db.select().from(storesTable),
  ]);
  const todaysTasks = tasks.filter((task) => task.dueDate === today);
  const completed = todaysTasks.filter((task) => task.status === "completed").length;
  const overdue = tasks.filter((task) => task.status === "overdue").length;
  const execution = todaysTasks.length
    ? Math.round((completed / todaysTasks.length) * 100)
    : 0;
  res.json({
    role: "manager",
    storeName: "Loja Centro",
    tasksToday: todaysTasks.length,
    completed,
    pending: todaysTasks.filter((task) => task.status !== "completed").length,
    overdue,
    execution,
    storesCount: stores.length,
    campaignsActive: 2,
    actionPlans: 3,
  });
});

router.get("/activity", async (_req, res) => {
  await seedPromise;
  const rows = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.createdAt))
    .limit(10);
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
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da tarefa inválidos." });
    return;
  }
  const task = {
    id: `task-${crypto.randomUUID()}`,
    ...parsed.data,
    assigneeRole: parsed.data.assigneeRole ?? "manager",
    dueDate: parsed.data.dueDate.toISOString().slice(0, 10),
    evidenceTypes: parsed.data.evidenceTypes ?? [],
    status: "pending",
  };
  await db.insert(tasksTable).values(task);
  const result = await getTaskWithEvidence(task.id);
  res.status(201).json(result);
});

router.post("/tasks/bulk", async (req, res) => {
  await seedPromise;
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
  await db.transaction(async (tx) => {
    await tx.insert(tasksTable).values(tasks);
  });
  const created = await Promise.all(tasks.map((task) => getTaskWithEvidence(task.id)));
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
  await db
    .update(tasksTable)
    .set(body.data)
    .where(eq(tasksTable.id, params.data.id));
  const task = await getTaskWithEvidence(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  res.json(task);
});

router.post("/tasks/:id/evidence", async (req, res) => {
  await seedPromise;
  const params = AddTaskEvidenceParams.safeParse(req.params);
  const body = AddTaskEvidenceBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Evidência inválida." });
    return;
  }
  const task = await getTaskWithEvidence(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }
  const evidence = {
    id: `evidence-${crypto.randomUUID()}`,
    taskId: params.data.id,
    type: body.data.type,
    fileName: body.data.fileName,
    userName: "João Mendes",
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
      completedBy: "João Mendes",
    })
    .where(eq(tasksTable.id, params.data.id));
  const completed = await getTaskWithEvidence(params.data.id);
  res.json(completed);
});

router.get("/stores", async (_req, res) => {
  await seedPromise;
  res.json(await db.select().from(storesTable).orderBy(desc(storesTable.execution)));
});

router.post("/stores", async (req, res) => {
  await seedPromise;
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados da loja inválidos." });
    return;
  }
  const store = {
    id: `store-${crypto.randomUUID()}`,
    name: parsed.data.name,
    city: parsed.data.city,
    region: parsed.data.region,
    manager: parsed.data.manager ?? "",
    supervisor: parsed.data.supervisor ?? "",
    execution: 0,
  };
  await db.insert(storesTable).values(store);
  res.status(201).json(store);
});

router.patch("/stores/:id", async (req, res) => {
  await seedPromise;
  const params = UpdateStoreParams.safeParse(req.params);
  const body = UpdateStoreBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Atualização da loja inválida." });
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
  await db
    .update(storesTable)
    .set(body.data)
    .where(eq(storesTable.id, params.data.id));
  const [updated] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.id, params.data.id));
  res.json(updated);
});

router.delete("/stores/:id", async (req, res) => {
  await seedPromise;
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
  const parsed = CreateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados do colaborador inválidos." });
    return;
  }
  const [duplicate] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.email, parsed.data.email));
  if (duplicate) {
    res.status(409).json({ error: "Já existe um colaborador com este e-mail." });
    return;
  }
  const member = {
    id: `member-${crypto.randomUUID()}`,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? "",
    role: parsed.data.role,
    storeId: parsed.data.storeId ?? null,
    active: true,
  };
  await db.insert(teamMembersTable).values(member);
  if (member.storeId) {
    await db
      .update(storesTable)
      .set(member.role === "manager" ? { manager: member.name } : { supervisor: member.name })
      .where(eq(storesTable.id, member.storeId));
  }
  res.status(201).json({ ...member, createdAt: new Date().toISOString() });
});

router.patch("/team-members/:id", async (req, res) => {
  await seedPromise;
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
  if (body.data.email && body.data.email !== existing.email) {
    const [duplicate] = await db
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.email, body.data.email));
    if (duplicate) {
      res.status(409).json({ error: "Já existe um colaborador com este e-mail." });
      return;
    }
  }
  await db
    .update(teamMembersTable)
    .set(body.data)
    .where(eq(teamMembersTable.id, params.data.id));
  const [updated] = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));
  if (updated?.storeId) {
    await db
      .update(storesTable)
      .set(updated.role === "manager" ? { manager: updated.name } : { supervisor: updated.name })
      .where(eq(storesTable.id, updated.storeId));
  }
  res.json(updated ? { ...updated, createdAt: updated.createdAt.toISOString() } : updated);
});

router.delete("/team-members/:id", async (req, res) => {
  await seedPromise;
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identificador do colaborador inválido." });
    return;
  }
  const [existing] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Colaborador não encontrado." });
    return;
  }
  await db
    .update(teamMembersTable)
    .set({ active: false, storeId: null })
    .where(eq(teamMembersTable.id, params.data.id));
  res.status(204).send();
});

router.get("/rankings", async (_req, res) => {
  await seedPromise;
  const stores = await db
    .select()
    .from(storesTable)
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
import type { Activity, DashboardSummary, RankingEntry, Store, Task } from '@workspace/api-client-react';

export const todayInput = new Date().toISOString().slice(0, 10);

export const fallbackSummary: DashboardSummary = {
  role: 'manager', storeName: 'Savassi 01', tasksToday: 12, completed: 7, pending: 4,
  overdue: 1, execution: 82.4, storesCount: 38, campaignsActive: 4, actionPlans: 3,
};

export const fallbackTasks: Task[] = [
  { id: 'task-204', title: 'Conferir exposição da campanha de inverno', description: 'Validar se os materiais e a comunicação de preço estão corretos na área de destaque.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Marina Alves', category: 'Campanhas', priority: 'high', dueDate: todayInput, dueTime: '11:00', status: 'in_progress', evidenceRequired: true, evidenceTypes: ['photo'], evidence: [], instructions: 'Fotografe a ponta de gôndola completa, incluindo a etiqueta de preço.', completedAt: null, completedBy: null },
  { id: 'task-198', title: 'Repor itens de alto giro', description: 'Garantir disponibilidade dos SKUs destacados no relatório de ruptura.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Marina Alves', category: 'Abastecimento', priority: 'high', dueDate: todayInput, dueTime: '14:30', status: 'pending', evidenceRequired: true, evidenceTypes: ['photo'], evidence: [], instructions: 'Faça a checagem no salão e no estoque antes de registrar a evidência.', completedAt: null, completedBy: null },
  { id: 'task-193', title: 'Atualizar checklist de temperatura', description: 'Registrar a leitura dos equipamentos de armazenamento conforme rotina.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Carlos Mendes', category: 'Qualidade', priority: 'medium', dueDate: todayInput, dueTime: '16:00', status: 'completed', evidenceRequired: false, evidenceTypes: [], evidence: [], instructions: 'Anote a leitura de cada equipamento no checklist físico.', completedAt: `${todayInput}T09:42:00`, completedBy: 'Carlos Mendes' },
  { id: 'task-187', title: 'Revisar planograma de dermocosméticos', description: 'Comparar o mobiliário com a última versão aprovada.', storeId: 'store-02', storeName: 'Centro 03', assignee: 'João Silva', category: 'Operação', priority: 'low', dueDate: todayInput, dueTime: '17:30', status: 'overdue', evidenceRequired: false, evidenceTypes: [], evidence: [], instructions: 'Sinalize qualquer divergência na observação da tarefa.', completedAt: null, completedBy: null },
];

export const fallbackActivities: Activity[] = [
  { id: 'a1', title: 'Tarefa concluída', detail: 'Atualizar checklist de temperatura · Savassi 01', createdAt: `${todayInput}T09:42:00`, tone: 'success' },
  { id: 'a2', title: 'Evidência adicionada', detail: 'Campanha de inverno · Centro 03', createdAt: `${todayInput}T09:16:00`, tone: 'info' },
  { id: 'a3', title: 'Prazo ultrapassado', detail: 'Revisar planograma · Centro 03', createdAt: `${todayInput}T08:50:00`, tone: 'warning' },
];

export const fallbackStores: Store[] = [
  { id: 'store-01', name: 'Savassi 01', city: 'Belo Horizonte', region: 'Centro-Sul', manager: 'Marina Alves', execution: 94.8 },
  { id: 'store-02', name: 'Centro 03', city: 'Belo Horizonte', region: 'Centro', manager: 'João Silva', execution: 88.1 },
  { id: 'store-03', name: 'Uberlândia 02', city: 'Uberlândia', region: 'Triângulo', manager: 'Letícia Rocha', execution: 84.6 },
  { id: 'store-04', name: 'Juiz de Fora 01', city: 'Juiz de Fora', region: 'Zona da Mata', manager: 'Rafael Costa', execution: 79.3 },
];

export const fallbackRankings: RankingEntry[] = fallbackStores.map((store, index) => ({
  position: index + 1, storeName: store.name, manager: store.manager, execution: store.execution,
  trend: index === 0 ? 'up' : index === 1 ? 'stable' : 'down',
}));
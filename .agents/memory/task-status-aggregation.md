---
name: Status de tarefas agrupadas
description: Regra visual para resumir tarefas em massa com unidades em estados diferentes.
---

Quando tarefas de uma mesma criação em massa têm estados diferentes, o resumo do grupo deve preservar o estado mais importante para acompanhamento: reprovação primeiro, depois aguardando conferência, depois atrasada, em execução e pendente; somente um grupo totalmente concluído pode ser verde.

**Why:** Um resumo genérico como `in_progress` ocultava que uma unidade aguardava conferência do supervisor, impedindo o admin de identificar o card amarelo.

**How to apply:** Ao alterar status, filtros ou agrupamentos de tarefas, mantenha a prioridade de `rejected` e `pending_review` no card do grupo e nos indicadores visuais.
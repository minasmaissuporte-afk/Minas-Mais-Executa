---
name: Status de tarefas agrupadas
description: Regra visual para resumir tarefas em massa com unidades em estados diferentes.
---

Quando tarefas de uma mesma criação em massa têm estados diferentes, o resumo do grupo deve preservar o estado mais importante para acompanhamento: reprovação primeiro, depois aguardando conferência, depois atrasada, em execução e pendente; somente um grupo totalmente concluído pode ser verde.

Na fila de execução da tela inicial, só ficam grupos incompletos: qualquer loja ainda em execução, pendente, atrasada ou reprovada deixa o grupo vermelho; ele fica amarelo somente quando o que falta é conferência. Remova o grupo quando todas as lojas concluírem.

**Why:** Um resumo genérico como `in_progress` ocultava que uma unidade aguardava conferência do supervisor, impedindo o admin de identificar o card amarelo.

**How to apply:** Mantenha a prioridade geral de `rejected` e `pending_review` nos resumos de grupos. A fila inicial aplica a regra própria acima para destacar execução que ainda falta antes da conferência.
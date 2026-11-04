---
name: Datas locais das tarefas
description: Regra de fuso horário para datas de vencimento e filtros de “hoje” no Minas Mais Executa.
---

Datas de tarefa sem horário devem ser interpretadas no fuso de negócio `America/Sao_Paulo`. Evite derivar o dia do calendário usando UTC.

**Why:** A virada da data UTC acontece às 21h em São Paulo; comparar datas calculadas em fusos diferentes pode zerar a fila e os indicadores do dia.

**How to apply:** Use a mesma data de calendário em filtros do dashboard, resumos da API e valores padrão de vencimento; calcule-a dinamicamente no servidor em vez de guardar “hoje” ao carregar o módulo.

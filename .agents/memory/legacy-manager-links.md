---
name: Vínculos antigos de gerentes
description: Compatibilidade entre lojas e cadastros de gerentes criados antes da sincronização por storeId.
---

Ao criar ou recuperar tarefas para um gerente, considerar o vínculo salvo na loja por `managerMemberId` ou pelo nome do gerente, além de `teamMembers.storeId`; nunca tratar o texto “Gerente de cada loja” como nome real. Cadastros antigos podem ter o gerente correto na loja, mas o `storeId` do colaborador vazio.

**Why:** Supervisores não conseguiam carregar ou criar tarefas para gerentes de lojas antigas porque a interface e a API dependiam exclusivamente de `teamMembers.storeId`.

**How to apply:** Consultas de gerentes para supervisores devem ser limitadas às lojas supervisionadas, mas incluir vínculos por identificador e nome; validações de criação devem aceitar esses vínculos legados sem liberar gerentes de outra loja.
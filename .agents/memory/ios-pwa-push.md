---
name: Push no iOS
description: Restrições de Web Push em PWAs instalados no iPhone e no preview HTTPS.
---

Em iOS/iPadOS, a permissão de notificações Web Push deve ser solicitada durante uma ação explícita do usuário, como tocar em um botão. O Service Worker e a subscription também precisam estar ativos em uma origem segura HTTPS; o app pode ser usado em um preview HTTPS, não apenas em uma build publicada.

**Why:** Solicitar a permissão automaticamente durante o carregamento pode não abrir o diálogo do Safari. Além disso, um app instalado a partir do preview fica sem push se o frontend só executar o registro quando `import.meta.env.PROD` for verdadeiro.

**How to apply:** Manter um botão visível para ativar notificações, tratar estados `default`, `granted` e `denied`, registrar o Service Worker em origens seguras de preview e produção e confirmar no backend que `POST /api/notifications/subscription` foi recebido antes de testar a entrega de uma nova tarefa. Para APNs, o `subject` do VAPID deve ser uma URL ou um `mailto:` com domínio válido; domínios locais como `.local` podem retornar `403 BadJwtToken`.

## Destinatários das tarefas

Ao criar uma tarefa, notifique por push os responsáveis atribuídos e o supervisor ativo vinculado à loja. Se o supervisor já estiver entre os responsáveis, envie apenas um aviso por tarefa.

**Why:** Supervisores precisam acompanhar novas tarefas das lojas, mesmo quando a execução foi atribuída ao gerente.

**How to apply:** Aplicar a regra nas criações individuais, em lote e recorrentes, usando o vínculo ativo da loja e as assinaturas de push já registradas.
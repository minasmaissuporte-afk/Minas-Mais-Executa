---
name: Push no iOS
description: Restrições de Web Push em PWAs instalados no iPhone e no preview HTTPS.
---

Em iOS/iPadOS, a permissão de notificações Web Push deve ser solicitada durante uma ação explícita do usuário, como tocar em um botão. O Service Worker e a subscription também precisam estar ativos em uma origem segura HTTPS; o app pode ser usado em um preview HTTPS, não apenas em uma build publicada.

**Why:** Solicitar a permissão automaticamente durante o carregamento pode não abrir o diálogo do Safari. Além disso, um app instalado a partir do preview fica sem push se o frontend só executar o registro quando `import.meta.env.PROD` for verdadeiro.

**How to apply:** Manter um botão visível para ativar notificações, tratar estados `default`, `granted` e `denied`, registrar o Service Worker em origens seguras de preview e produção e confirmar no backend que `POST /api/notifications/subscription` foi recebido antes de testar a entrega de uma nova tarefa.
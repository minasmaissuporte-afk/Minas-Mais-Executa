---
name: Migrações aditivas no desenvolvimento
description: Como preservar dados existentes quando o schema Drizzle diverge por constraints antigas.
---

Quando uma mudança de schema é aditiva e o `drizzle-kit push` pede truncar uma tabela por causa de uma constraint antiga, não aceite o truncamento apenas para concluir o push. Aplique somente `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` e `CREATE TABLE IF NOT EXISTS` necessários, preservando as linhas existentes.

**Why:** O ambiente pode conter dados operacionais e diferenças históricas de constraints; truncar para satisfazer o diff do Drizzle viola a exigência de não apagar dados.

**How to apply:** Primeiro consulte `information_schema` no banco de desenvolvimento, depois faça uma migração SQL aditiva e valide o typecheck/build. Não altere a constraint antiga sem necessidade funcional.
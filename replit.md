# Minas Mais Executa

Responsive operational execution platform for Minas Mais stores, connecting task assignment, evidence capture, and network performance follow-up.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/minas-mais-executa` — primary React/Vite web app and responsive manager/supervisor/admin surfaces.
- `artifacts/api-server` — Express API for dashboard data, tasks, evidence metadata, rankings, and storage routes.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks.
- `lib/db/src/schema/index.ts` — Drizzle schema for stores, tasks, evidence, and activity.
- `lib/object-storage-web` — browser upload helpers prepared for evidence files.

## Architecture decisions

- The first delivery is a responsive web MVP so the manager flow works on a phone without requiring a native binary.
- API contracts are defined in OpenAPI and regenerated into typed React Query hooks and Zod schemas.
- Task completion is enforced server-side: a task with required evidence cannot transition to completed until evidence exists.
- Evidence metadata is stored in PostgreSQL and binary uploads are prepared for Replit App Storage through presigned URLs.
- Clerk is provisioned for secure sign-in, and operational routes are gated behind authentication.

## Product

The MVP supports a role-aware dashboard, task queue and creation, task execution detail, photo/video evidence metadata capture, overdue status, store directory, ranking, reports, activity feed, Clerk sign-in/sign-up routes, and responsive mobile navigation. The interface is split into focused shell, page, UI-kit, and demo-data modules.

## User preferences

The user selected a responsive web MVP as the first delivery path; native mobile work should be continued from replit.com.

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Restart the managed API and web workflows after backend, package, or routing changes.
- The app uses the managed `/api` proxy path; do not hardcode service ports in frontend code.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

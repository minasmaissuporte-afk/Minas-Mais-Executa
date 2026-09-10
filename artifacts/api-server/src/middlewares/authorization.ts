import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { db, teamMembersTable, type TeamMember } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export const ADMIN_EMAIL = "david@drogariasminasmais.com.br";

export type AuthenticatedRequest = Request & { actor: TeamMember };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function verifiedPrimaryEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  if (!primary || primary.verification?.status !== "verified") return null;
  return normalizeEmail(primary.emailAddress);
}

async function ensureAdmin(): Promise<void> {
  const existing = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.email, ADMIN_EMAIL));
  if (!existing.length) {
    await db.insert(teamMembersTable).values({
      id: "member-admin-david",
      name: "David",
      email: ADMIN_EMAIL,
      role: "admin",
      active: true,
    }).onConflictDoNothing();
  }
}

export async function requireActiveMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticação obrigatória." });
    return;
  }
  let email: string | null;
  try {
    email = await verifiedPrimaryEmail(userId);
  } catch (error) {
    req.log.error({ err: error }, "Unable to resolve Clerk user");
    res.status(503).json({ error: "Não foi possível validar sua identidade." });
    return;
  }
  if (!email) {
    res.status(403).json({ error: "Seu e-mail principal precisa estar verificado para solicitar acesso.", code: "ACCESS_PENDING" });
    return;
  }
  await ensureAdmin();
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.email, email));
  if (!member || !member.active) {
    res.status(403).json({ error: "Acesso pendente de liberação ou conta inativa.", code: "ACCESS_PENDING" });
    return;
  }
  if (email === ADMIN_EMAIL && member.role !== "admin") {
    res.status(403).json({ error: "A conta administrativa está configurada incorretamente.", code: "ACCESS_PENDING" });
    return;
  }
  if (!member.clerkUserId) {
    await db.update(teamMembersTable)
      .set({ clerkUserId: userId })
      .where(and(eq(teamMembersTable.id, member.id), isNull(teamMembersTable.clerkUserId)))
      .returning({ id: teamMembersTable.id });
  }
  const [linkedMember] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, member.id));
  if (!linkedMember || linkedMember.clerkUserId !== userId) {
    res.status(403).json({ error: "Esta conta já está vinculada a outra identidade.", code: "ACCESS_PENDING" });
    return;
  }
  (req as AuthenticatedRequest).actor = linkedMember;
  next();
}

export function actor(req: Request): TeamMember {
  return (req as AuthenticatedRequest).actor;
}

export function requireAdmin(req: Request, res: Response): boolean {
  if (actor(req).role === "admin") return true;
  res.status(403).json({ error: "Apenas a administração pode executar esta ação." });
  return false;
}
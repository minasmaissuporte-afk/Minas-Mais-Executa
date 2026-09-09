import { createECDH, createHash } from "node:crypto";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db, pushSubscriptionsTable } from "@workspace/db";

type PushTask = {
  id: string;
  title: string;
  assigneeMemberId: string | null;
};

let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;

function getVapidKeys() {
  if (cachedVapidKeys) return cachedVapidKeys;
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required to configure Web Push.");
  }
  const privateKeyBytes = createHash("sha256")
    .update(process.env.SESSION_SECRET)
    .digest();
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKeyBytes);
  cachedVapidKeys = {
    privateKey: privateKeyBytes.toString("base64url"),
    publicKey: ecdh.getPublicKey().toString("base64url"),
  };
  webpush.setVapidDetails(
    "mailto:admin@minasmaisexecuta.local",
    cachedVapidKeys.publicKey,
    cachedVapidKeys.privateKey,
  );
  return cachedVapidKeys;
}

export function getPushPublicKey() {
  return getVapidKeys().publicKey;
}

export async function notifyTaskAssignees(tasks: PushTask[]) {
  const grouped = new Map<string, PushTask[]>();
  for (const task of tasks) {
    if (!task.assigneeMemberId) continue;
    const memberTasks = grouped.get(task.assigneeMemberId) ?? [];
    memberTasks.push(task);
    grouped.set(task.assigneeMemberId, memberTasks);
  }
  if (!grouped.size) return;

  getVapidKeys();
  const memberIds = [...grouped.keys()];
  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(inArray(pushSubscriptionsTable.memberId, memberIds));

  await Promise.all(subscriptions.flatMap((subscription) => {
    const tasksForMember = grouped.get(subscription.memberId) ?? [];
    return tasksForMember.map(async (task) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: "Nova tarefa prioritária",
            body: task.title,
            tag: `task-${task.id}`,
            data: { url: `/tasks/${task.id}` },
            requireInteraction: true,
            silent: false,
            vibrate: [300, 100, 300, 100, 500],
          }),
          { TTL: 60, urgency: "high" },
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(and(eq(pushSubscriptionsTable.id, subscription.id), eq(pushSubscriptionsTable.endpoint, subscription.endpoint)));
          return;
        }
        console.error("Falha ao enviar push de nova tarefa.", error);
      }
    });
  }));
}
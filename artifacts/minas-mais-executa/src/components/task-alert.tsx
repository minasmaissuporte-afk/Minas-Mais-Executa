import { useEffect } from 'react';
import { getGetPushPublicKeyQueryKey, getListTasksQueryKey, getPushPublicKey, savePushSubscription, useGetPushPublicKey, useListTasks } from '@workspace/api-client-react';
import type { CurrentMember } from '@workspace/api-client-react';

export function TaskAlert({ member, onUnreadChange }: { member: CurrentMember; onUnreadChange: (count: number) => void }) {
  const tasksQuery = useListTasks(undefined, {
    query: { queryKey: getListTasksQueryKey(), refetchInterval: 30000 },
  });
  const publicKeyQuery = useGetPushPublicKey({
    query: { queryKey: getGetPushPublicKeyQueryKey(), staleTime: Infinity, enabled: import.meta.env.PROD },
  });

  useEffect(() => {
    if (!import.meta.env.PROD || !publicKeyQuery.data?.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    let cancelled = false;
    const registerPushSubscription = async () => {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (cancelled || permission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKeyQuery.data!.publicKey),
        });
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
    };
    void registerPushSubscription().catch((error) => {
      console.error('Não foi possível ativar as notificações push.', error);
    });
    return () => {
      cancelled = true;
    };
  }, [member.id, publicKeyQuery.data?.publicKey]);

  useEffect(() => {
    if (!tasksQuery.data) return;
    const storageKey = `minas-mais-known-tasks-${member.id}`;
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as string[] | null;
    const currentIds = tasksQuery.data.map((task) => task.id);
    if (!saved) {
      window.localStorage.setItem(storageKey, JSON.stringify(currentIds));
      return;
    }
    const newTasks = tasksQuery.data.filter((task) => !saved.includes(task.id) && task.assigneeMemberId === member.id);
    if (newTasks.length) {
      onUnreadChange(newTasks.length);
    }
    const nextKnown = [...new Set([...saved, ...currentIds])].slice(-300);
    window.localStorage.setItem(storageKey, JSON.stringify(nextKnown));
  }, [member.id, onUnreadChange, tasksQuery.data]);

  return null;
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
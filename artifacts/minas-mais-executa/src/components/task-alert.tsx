import { useCallback, useEffect, useState } from 'react';
import { getGetPushPublicKeyQueryKey, getListTaskNotificationsQueryKey, getPushPublicKey, savePushSubscription, useGetPushPublicKey, useListTaskNotifications } from '@workspace/api-client-react';
import type { CurrentMember } from '@workspace/api-client-react';

export type PushStatus = 'checking' | 'registered' | 'permission-required' | 'blocked' | 'unsupported' | 'error';
const pushEnabled = import.meta.env.PROD || (typeof window !== 'undefined' && window.isSecureContext);

export function TaskAlert({ member, onUnreadChange, onPushStatusChange }: { member: CurrentMember; onUnreadChange: (count: number) => void; onPushStatusChange: (status: PushStatus, activate: () => void) => void }) {
  const tasksQuery = useListTaskNotifications({
    query: { queryKey: getListTaskNotificationsQueryKey(), refetchInterval: 30000 },
  });
  const publicKeyQuery = useGetPushPublicKey({
    query: { queryKey: getGetPushPublicKeyQueryKey(), staleTime: Infinity, enabled: pushEnabled },
  });
  const [pushStatus, setPushStatus] = useState<PushStatus>('checking');
  const [pushError, setPushError] = useState('');
  const [activatingPush, setActivatingPush] = useState(false);

  useEffect(() => {
    if (!pushEnabled) {
      setPushStatus('unsupported');
      return;
    }
    let cancelled = false;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      setPushStatus('unsupported');
      return () => {
        cancelled = true;
      };
    }
    if (publicKeyQuery.isError) {
      setPushError('Não foi possível preparar as notificações neste momento.');
      setPushStatus('error');
      return () => {
        cancelled = true;
      };
    }
    if (!publicKeyQuery.data?.publicKey) return;
    if (Notification.permission === 'denied') {
      setPushStatus('blocked');
      return () => {
        cancelled = true;
      };
    }
    if (Notification.permission === 'default') {
      setPushStatus('permission-required');
      return () => {
        cancelled = true;
      };
    }
    void registerPushSubscription(publicKeyQuery.data.publicKey)
      .then(() => {
        if (!cancelled) setPushStatus('registered');
      })
      .catch((error) => {
        console.error('Não foi possível ativar as notificações push.', error);
        if (!cancelled) {
          setPushError('Não foi possível registrar este aparelho. Toque em tentar novamente.');
          setPushStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicKeyQuery.data?.publicKey, publicKeyQuery.isError]);

  const enablePush = useCallback(async () => {
    if (!publicKeyQuery.data?.publicKey || activatingPush) return;
    setActivatingPush(true);
    setPushError('');
    try {
      let permission = Notification.permission;
      if (permission === 'default') permission = await Notification.requestPermission();
      if (permission === 'denied') {
        setPushStatus('blocked');
        return;
      }
      if (permission !== 'granted') {
        setPushStatus('permission-required');
        return;
      }
      await registerPushSubscription(publicKeyQuery.data.publicKey);
      setPushStatus('registered');
    } catch (error) {
      console.error('Não foi possível ativar as notificações push.', error);
      setPushError('Não foi possível registrar este aparelho. Verifique a conexão e tente novamente.');
      setPushStatus('error');
    } finally {
      setActivatingPush(false);
    }
  }, [activatingPush, publicKeyQuery.data?.publicKey]);

  useEffect(() => {
    onPushStatusChange(pushStatus, () => { void enablePush(); });
  }, [enablePush, onPushStatusChange, pushStatus]);

  useEffect(() => {
    if (!tasksQuery.data) return;
    const storageKey = `minas-mais-known-tasks-${member.id}`;
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as string[] | null;
    const currentIds = tasksQuery.data.map((task) => task.id);
    if (!saved) {
      window.localStorage.setItem(storageKey, JSON.stringify(currentIds));
      return;
    }
    const newTasks = tasksQuery.data.filter((task) => !saved.includes(task.id) && (task.assigneeMemberId === member.id || task.assigneeMemberIds?.includes(member.id) === true));
    if (newTasks.length) {
      onUnreadChange(newTasks.length);
    }
    const nextKnown = [...new Set([...saved, ...currentIds])].slice(-300);
    window.localStorage.setItem(storageKey, JSON.stringify(nextKnown));
  }, [member.id, onUnreadChange, tasksQuery.data]);

  if (!pushEnabled || pushStatus === 'checking' || pushStatus === 'registered') return null;

  if (pushStatus === 'unsupported') {
    return (
      <div className="push-notification-notice" role="status">
        <div>
          <strong>Notificações indisponíveis neste navegador</strong>
          <p>No iPhone, adicione o app à Tela de Início e abra por lá. Em outros aparelhos, tente um navegador compatível.</p>
        </div>
      </div>
    );
  }

  if (pushStatus === 'blocked') {
    return (
      <div className="push-notification-notice" role="status">
        <div>
          <strong>Notificações bloqueadas</strong>
          <p>Abra Ajustes &gt; Notificações &gt; Minas Mais Executa e permita as notificações. Depois volte ao app.</p>
        </div>
        <button className="button button-ghost" type="button" onClick={() => window.location.reload()}>Verificar</button>
      </div>
    );
  }

  return (
    <div className="push-notification-notice" role="status">
      <div>
        <strong>Ative as notificações</strong>
        <p>{pushError || 'Receba um aviso neste aparelho quando uma nova tarefa for atribuída a você.'}</p>
      </div>
      <button className="button button-primary" type="button" onClick={() => void enablePush()} disabled={activatingPush || !publicKeyQuery.data?.publicKey}>
        {activatingPush ? 'Ativando...' : pushStatus === 'error' ? 'Tentar novamente' : 'Ativar'}
      </button>
    </div>
  );
}

async function registerPushSubscription(publicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !hasMatchingApplicationServerKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('A subscription de push retornou dados incompletos.');
  }
  await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

function hasMatchingApplicationServerKey(subscription: PushSubscription, expectedKey: Uint8Array) {
  const configuredKey = subscription.options.applicationServerKey;
  if (!configuredKey) return true;
  const actualKey = new Uint8Array(configuredKey);
  return actualKey.length === expectedKey.length && actualKey.every((value, index) => value === expectedKey[index]);
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
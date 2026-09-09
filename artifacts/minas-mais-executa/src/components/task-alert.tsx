import { useEffect } from 'react';
import { getListTasksQueryKey, useListTasks } from '@workspace/api-client-react';
import type { CurrentMember } from '@workspace/api-client-react';

export function TaskAlert({ member, onUnreadChange }: { member: CurrentMember; onUnreadChange: (count: number) => void }) {
  const tasksQuery = useListTasks(undefined, {
    query: { queryKey: getListTasksQueryKey(), refetchInterval: 30000 },
  });
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
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nova tarefa atribuída', { body: newTasks[0]?.title || 'Você recebeu uma nova tarefa.' });
      }
    }
    const nextKnown = [...new Set([...saved, ...currentIds])].slice(-300);
    window.localStorage.setItem(storageKey, JSON.stringify(nextKnown));
  }, [member.id, onUnreadChange, tasksQuery.data]);

  return null;
}
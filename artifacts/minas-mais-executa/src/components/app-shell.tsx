import { BarChart3, Bell, ClipboardCheck, LayoutDashboard, LogOut, Settings2, Store as StoreIcon, UserRound } from 'lucide-react';
import { type ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import type { CurrentMember } from '@workspace/api-client-react';
import { initials, roleLabel } from '@/components/ui-kit';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { TaskAlert, type PushStatus } from '@/components/task-alert';

export type Role = 'manager' | 'supervisor' | 'admin';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function NavItem({ href, label, icon: Icon, testId }: { href: string; label: string; icon: typeof LayoutDashboard; testId: string }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} className={`nav-item ${active ? 'active' : ''}`} data-testid={testId}><Icon size={16} strokeWidth={active ? 2.5 : 1.8} /><span>{label}</span></Link>;
}

export function AppShell({ children, member }: { children: ReactNode; member: CurrentMember }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const [unreadTasks, setUnreadTasks] = useState(0);
  const [pushStatus, setPushStatus] = useState<PushStatus>('checking');
  const [activatePush, setActivatePush] = useState<() => void>(() => () => undefined);
  const onUnreadChange = useCallback((count: number) => setUnreadTasks((current) => current + count), []);
  const onPushStatusChange = useCallback((status: PushStatus, activate: () => void) => {
    setPushStatus(status);
    setActivatePush(() => activate);
  }, []);
  const userName = member.name;
  const segment = location.split('/')[1];
  const pageName = location === '/' ? 'Visão geral' : segment === 'tasks' ? 'Tarefas' : segment === 'stores' ? 'Lojas' : segment === 'cadastros' ? 'Cadastros' : segment === 'account' ? 'Minha conta' : 'Relatórios';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></Link>
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <NavItem href="/" label="Visão geral" icon={LayoutDashboard} testId="link-nav-visao-geral" />
        <NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-nav-tarefas" />
        <NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-nav-lojas" />
        <NavItem href="/reports" label="Relatórios" icon={BarChart3} testId="link-nav-relatorios" />
        {member.role === 'admin' && <NavItem href="/cadastros" label="Cadastros" icon={Settings2} testId="link-nav-cadastros" />}
      </nav>
       <div className="sidebar-spacer" />
       <div className="sidebar-footer"><Link href="/account" className="user-row user-row-link" data-testid="link-sidebar-account"><span className="avatar">{initials(userName)}</span><span><span className="user-name">{userName}</span><span className="user-role">{roleLabel(member.role)}</span></span></Link></div>
    </aside>
    <main className="main-area">
       <header className="topbar"><div className="breadcrumb">Minas Mais <span>/</span> <strong>{pageName}</strong></div><div className="top-actions"><button className={`icon-button notification-button ${member.role !== 'admin' ? `push-${pushStatus}` : ''}`} aria-label={member.role !== 'admin' ? pushStatus === 'registered' ? 'Notificações ativadas' : pushStatus === 'blocked' ? 'Notificações bloqueadas' : 'Ativar notificações' : 'Notificações'} title={member.role !== 'admin' ? pushStatus === 'registered' ? 'Notificações ativadas neste aparelho' : pushStatus === 'blocked' ? 'Permita notificações nas configurações do navegador' : 'Toque para ativar notificações' : 'Notificações'} onClick={() => { setUnreadTasks(0); if (member.role !== 'admin' && pushStatus !== 'registered') activatePush(); }} data-testid="button-notifications"><Bell size={16} />{unreadTasks > 0 && <span className="notification-badge">{unreadTasks > 9 ? '9+' : unreadTasks}</span>}{member.role !== 'admin' && <span className="push-status-dot" aria-hidden="true" />}</button><button className="icon-button" aria-label="Sair" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={16} /></button></div></header>
      {children}
    </main>
    {member.role !== 'admin' && <TaskAlert member={member} onUnreadChange={onUnreadChange} onPushStatusChange={onPushStatusChange} />}
     <nav className="mobile-nav" aria-label="Navegação móvel"><NavItem href="/" label="Início" icon={LayoutDashboard} testId="link-mobile-home" /><NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-mobile-tasks" /><NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-mobile-stores" />{member.role === 'admin' && <NavItem href="/cadastros" label="Cadastros" icon={Settings2} testId="link-mobile-cadastros" />}<NavItem href="/account" label="Conta" icon={UserRound} testId="link-mobile-account" /></nav>
    <PwaInstallPrompt />
  </div>;
}
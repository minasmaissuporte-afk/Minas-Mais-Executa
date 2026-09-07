import { BarChart3, Bell, ClipboardCheck, LayoutDashboard, LogOut, Store as StoreIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import { initials, roleLabel } from '@/components/ui-kit';

export type Role = 'manager' | 'supervisor' | 'admin';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function NavItem({ href, label, icon: Icon, testId }: { href: string; label: string; icon: typeof LayoutDashboard; testId: string }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} className={`nav-item ${active ? 'active' : ''}`} data-testid={testId}><Icon size={16} strokeWidth={active ? 2.5 : 1.8} /><span>{label}</span></Link>;
}

export function AppShell({ children, role, onRoleChange }: { children: ReactNode; role: Role; onRoleChange: (role: Role) => void }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const segment = location.split('/')[1];
  const pageName = location === '/' ? 'Visão geral' : segment === 'tasks' ? 'Tarefas' : segment === 'stores' ? 'Lojas' : 'Relatórios';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></Link>
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <NavItem href="/" label="Visão geral" icon={LayoutDashboard} testId="link-nav-visao-geral" />
        <NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-nav-tarefas" />
        <NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-nav-lojas" />
        <NavItem href="/reports" label="Relatórios" icon={BarChart3} testId="link-nav-relatorios" />
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer"><div className="user-row"><span className="avatar">{initials('Marina Alves')}</span><span><div className="user-name">Marina Alves</div><div className="user-role">{roleLabel(role)}</div></span></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Minas Mais <span>/</span> <strong>{pageName}</strong></div><div className="top-actions"><select className="role-switch" value={role} onChange={(event) => onRoleChange(event.target.value as Role)} aria-label="Selecionar papel de demonstração" data-testid="select-role"><option value="manager">Gerente de loja</option><option value="supervisor">Supervisão</option><option value="admin">Administração</option></select><button className="icon-button" aria-label="Notificações" data-testid="button-notifications"><Bell size={16} /></button><button className="icon-button" aria-label="Sair" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={16} /></button></div></header>
      {children}
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel"><NavItem href="/" label="Início" icon={LayoutDashboard} testId="link-mobile-home" /><NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-mobile-tasks" /><NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-mobile-stores" /><NavItem href="/reports" label="Dados" icon={BarChart3} testId="link-mobile-reports" /></nav>
  </div>;
}
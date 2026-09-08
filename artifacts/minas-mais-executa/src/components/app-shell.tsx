import { BarChart3, Bell, ClipboardCheck, LayoutDashboard, LogOut, Settings2, Store as StoreIcon } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
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
  const { user, isLoaded } = useUser();
  const [showNameForm, setShowNameForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState('');
  const profileNameKey = user ? `minas-profile-name:${user.id}` : '';
  const userName = savedName || user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Usuário';
  useEffect(() => {
    if (!isLoaded || !user) return;
    const localName = window.localStorage.getItem(`minas-profile-name:${user.id}`) ?? '';
    setSavedName(localName);
    if (!localName && !user.firstName && !user.fullName) setShowNameForm(true);
  }, [isLoaded, user]);
  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) {
      setNameError('Informe pelo menos o primeiro nome.');
      return;
    }
    setSavingName(true);
    setNameError('');
    const completedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    try {
      if (profileNameKey) window.localStorage.setItem(profileNameKey, completedName);
      setSavedName(completedName);
      window.dispatchEvent(new CustomEvent('minas-profile-name-updated', { detail: completedName }));
      try {
        await user?.update({ firstName: firstName.trim(), lastName: lastName.trim() || undefined });
      } catch {
        // O perfil local mantém a identificação quando o tenant não permite editar o nome.
      }
      setShowNameForm(false);
    } finally {
      setSavingName(false);
    }
  };
  const segment = location.split('/')[1];
  const pageName = location === '/' ? 'Visão geral' : segment === 'tasks' ? 'Tarefas' : segment === 'stores' ? 'Lojas' : segment === 'cadastros' ? 'Cadastros' : 'Relatórios';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></Link>
      <div className="nav-label">Operação</div>
      <nav className="nav-list" aria-label="Navegação principal">
        <NavItem href="/" label="Visão geral" icon={LayoutDashboard} testId="link-nav-visao-geral" />
        <NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-nav-tarefas" />
        <NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-nav-lojas" />
        <NavItem href="/reports" label="Relatórios" icon={BarChart3} testId="link-nav-relatorios" />
        <NavItem href="/cadastros" label="Cadastros" icon={Settings2} testId="link-nav-cadastros" />
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer"><button type="button" className="user-row user-profile-button" onClick={() => setShowNameForm(true)} data-testid="button-edit-profile-name"><span className="avatar">{initials(userName)}</span><span><span className="user-name">{userName}</span><span className="user-role">{roleLabel(role)}</span></span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Minas Mais <span>/</span> <strong>{pageName}</strong></div><div className="top-actions"><select className="role-switch" value={role} onChange={(event) => onRoleChange(event.target.value as Role)} aria-label="Selecionar papel de demonstração" data-testid="select-role"><option value="manager">Gerente de loja</option><option value="supervisor">Supervisão</option><option value="admin">Administração</option></select><button className="icon-button" aria-label="Notificações" data-testid="button-notifications"><Bell size={16} /></button><button className="icon-button" aria-label="Sair" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={16} /></button></div></header>
      {children}
    </main>
    <nav className="mobile-nav" aria-label="Navegação móvel"><NavItem href="/" label="Início" icon={LayoutDashboard} testId="link-mobile-home" /><NavItem href="/tasks" label="Tarefas" icon={ClipboardCheck} testId="link-mobile-tasks" /><NavItem href="/stores" label="Lojas" icon={StoreIcon} testId="link-mobile-stores" /><NavItem href="/cadastros" label="Cadastros" icon={Settings2} testId="link-mobile-cadastros" /></nav>
    {showNameForm && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-name-title">
      <div className="modal profile-modal">
        <div className="eyebrow">Seu perfil</div>
        <div className="modal-title" id="profile-name-title">Como devemos chamar você?</div>
        <p className="page-intro">Esse nome aparecerá no painel e nos registros de execução.</p>
        <form onSubmit={saveName}>
          <div className="form-grid profile-form-grid">
            <div className="field"><label htmlFor="profile-first-name">Primeiro nome</label><input id="profile-first-name" className="input" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoFocus placeholder="David" data-testid="input-profile-first-name" /></div>
            <div className="field"><label htmlFor="profile-last-name">Sobrenome</label><input id="profile-last-name" className="input" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Opcional" data-testid="input-profile-last-name" /></div>
          </div>
          {nameError && <div className="form-notice error">{nameError}</div>}
          <div className="form-actions"><button type="submit" className="button button-primary" disabled={savingName} data-testid="button-save-profile-name">{savingName ? 'Salvando...' : 'Salvar meu nome'}</button></div>
        </form>
      </div>
    </div>}
  </div>;
}
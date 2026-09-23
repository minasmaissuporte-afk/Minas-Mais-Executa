import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app-shell';
import { useGetMe } from '@workspace/api-client-react';
import DashboardPage from '@/pages/dashboard';
import TasksPage from '@/pages/tasks';
import TaskDetailPage from '@/pages/task-detail';
import StoresPage from '@/pages/stores';
import ReportsPage from '@/pages/reports';
import AdministrationPage from '@/pages/administration';
import AccountPage from '@/pages/account';
import NotFound from '@/pages/not-found';
import { SignInPage, SignUpPage } from '@/pages/auth';
import logoImage from '@assets/af933122-6827-4305-a122-3f7713fe10e8_1789128021073.png';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment.');

function AuthRoutes() {
  const [location] = useLocation();
  if (location.startsWith('/sign-up')) return <SignUpPage />;
  if (location.startsWith('/sign-in')) return <SignInPage />;
  return <Redirect to="/sign-in" />;
}

function AuthenticatedRoutes() {
  const me = useGetMe();
  const { signOut } = useClerk();
  if (me.isLoading) return <div className="access-screen access-loading-screen"><div className="access-card access-loading-card"><img className="access-brand-image" src={logoImage} alt="Minas Executa" /><h1>Preparando sua operação</h1><p>Estamos validando seu acesso com segurança.</p><div className="access-loader" /></div></div>;
  if (me.isError || !me.data) {
    const status = (me.error as { status?: number } | undefined)?.status;
    const pending = status === 403;
    return <div className="access-screen"><div className="access-card"><div className="brand-mark">M</div><h1>{pending ? 'Acesso pendente' : 'Não foi possível validar seu acesso'}</h1><p>{pending ? 'Sua conta está autenticada, mas ainda não foi liberada para Minas Mais Executa. Peça ao administrador para cadastrar seu e-mail verificado.' : 'Sua sessão não pôde ser autorizada. Entre novamente e, se o problema continuar, contate a administração.'}</p><button className="button button-primary" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-access-logout">Sair</button></div></div>;
  }
  const member = me.data;
  return <AppShell member={member}><Switch>
    <Route path="/" component={() => <DashboardPage member={member} />} />
    <Route path="/tasks" component={TasksPage} />
    <Route path="/tasks/:id" component={TaskDetailPage} />
    <Route path="/stores" component={StoresPage} />
    <Route path="/reports" component={ReportsPage} />
    <Route path="/account/*?" component={AccountPage} />
    <Route path="/cadastros" component={() => member.role === 'admin' ? <AdministrationPage /> : <Redirect to="/" />} />
    <Route component={NotFound} />
  </Switch></AppShell>;
}

function AuthGate() {
  return <><Show when="signed-in"><AuthenticatedRoutes /></Show><Show when="signed-out"><AuthRoutes /></Show></>;
}

function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} afterSignOutUrl={basePath || '/'}><WouterRouter base={basePath || undefined}><TooltipProvider><AuthGate /></TooltipProvider></WouterRouter><Toaster /></ClerkProvider></QueryClientProvider></ErrorBoundary>;
}

export default App;
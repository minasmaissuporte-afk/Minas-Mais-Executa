import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, Show } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell, type Role } from '@/components/app-shell';
import DashboardPage from '@/pages/dashboard';
import TasksPage from '@/pages/tasks';
import TaskDetailPage from '@/pages/task-detail';
import StoresPage from '@/pages/stores';
import ReportsPage from '@/pages/reports';
import NotFound from '@/pages/not-found';
import { SignInPage, SignUpPage } from '@/pages/auth';
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
  const [role, setRole] = useState<Role>('manager');
  return <AppShell role={role} onRoleChange={setRole}><Switch>
    <Route path="/" component={() => <DashboardPage role={role} />} />
    <Route path="/tasks" component={TasksPage} />
    <Route path="/tasks/:id" component={TaskDetailPage} />
    <Route path="/stores" component={StoresPage} />
    <Route path="/reports" component={ReportsPage} />
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
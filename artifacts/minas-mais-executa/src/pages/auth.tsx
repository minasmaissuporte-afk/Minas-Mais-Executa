import { SignIn, SignUp } from '@clerk/react';
import type { ReactNode } from 'react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appearance = {
  variables: {
    colorPrimary: 'hsl(1 73% 47%)', colorForeground: 'hsl(0 0% 15%)', colorMutedForeground: 'hsl(0 0% 42%)',
    colorBackground: 'hsl(0 0% 95%)', colorInput: 'hsl(0 0% 100%)', borderRadius: '0.72rem', fontFamily: 'DM Sans, sans-serif',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-transparent w-full max-w-[440px]', card: '!shadow-none !border-0 !bg-transparent',
    footer: '!shadow-none !border-0 !bg-transparent', formButtonPrimary: 'bg-[hsl(1_73%_47%)] hover:bg-[hsl(1_73%_40%)]',
    footerActionLink: 'text-[hsl(1_73%_47%)]', formFieldInput: 'border-[hsl(0_0%_82%)]',
  },
};

function AuthFrame({ children, mode }: { children: ReactNode; mode: 'signin' | 'signup' }) {
  return <div className="login-page"><section className="login-brand"><a className="brand" href={basePath || '/'} data-testid="link-auth-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></a><div className="login-statement"><div className="login-kicker">Operação em primeiro lugar</div><h1>Faça a rotina acontecer.</h1><p>Um lugar calmo para enxergar o que precisa ser feito, comprovar a execução e cuidar melhor de cada loja.</p></div><div className="login-footer">Minas Mais Executa · rede em movimento</div></section><section className="login-form-side"><div className="clerk-wrap" data-testid={`auth-${mode}`}>{children}</div></section></div>;
}
export function SignInPage() {
  return <AuthFrame mode="signin"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" appearance={appearance} /></AuthFrame>;
}
export function SignUpPage() {
  return <AuthFrame mode="signup"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" appearance={appearance} /></AuthFrame>;
}
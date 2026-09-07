import { SignIn, SignUp } from '@clerk/react';
import type { ReactNode } from 'react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appearance = {
  variables: {
    colorPrimary: 'hsl(166 53% 33%)', colorForeground: 'hsl(210 35% 16%)', colorMutedForeground: 'hsl(211 13% 45%)',
    colorBackground: 'hsl(43 32% 95%)', colorInput: 'hsl(43 38% 99%)', borderRadius: '0.72rem', fontFamily: 'DM Sans, sans-serif',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-transparent w-full max-w-[440px]', card: '!shadow-none !border-0 !bg-transparent',
    footer: '!shadow-none !border-0 !bg-transparent', formButtonPrimary: 'bg-[hsl(166_53%_33%)] hover:bg-[hsl(166_53%_28%)]',
    footerActionLink: 'text-[hsl(166_53%_33%)]', formFieldInput: 'border-[hsl(39_23%_84%)]',
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
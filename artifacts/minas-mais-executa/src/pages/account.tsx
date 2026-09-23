import { UserProfile } from '@clerk/react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const appearance = {
  variables: {
    colorPrimary: 'hsl(166 53% 28%)',
    colorForeground: 'hsl(0 0% 15%)',
    colorMutedForeground: 'hsl(0 0% 42%)',
    colorBackground: 'hsl(0 0% 100%)',
    colorInput: 'hsl(0 0% 100%)',
    borderRadius: '0.72rem',
    fontFamily: 'DM Sans, sans-serif',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'w-full max-w-[760px] !shadow-none',
    card: '!shadow-none !border-0',
    footer: '!shadow-none !border-0',
    navbar: 'border-[hsl(0_0%_88%)]',
    pageScrollBox: 'bg-transparent',
    headerTitle: 'text-[hsl(0_0%_15%)]',
    headerSubtitle: 'text-[hsl(0_0%_42%)]',
    formFieldLabel: 'text-[hsl(0_0%_42%)]',
    formFieldInput: 'border-[hsl(0_0%_82%)]',
    formButtonPrimary: 'bg-[hsl(166_53%_28%)] hover:bg-[hsl(166_53%_23%)]',
  },
};

export default function AccountPage() {
  return (
    <div className="content account-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Conta</div>
          <h1 className="page-title">Minha conta</h1>
          <p className="page-intro">Atualize seus dados e altere sua senha na área de segurança.</p>
        </div>
      </div>
      <div className="account-profile-card">
        <UserProfile routing="path" path={`${basePath}/account`} appearance={appearance} />
      </div>
    </div>
  );
}
import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'minas-pwa-install-dismissed-v2';

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone || window.localStorage.getItem(DISMISSED_KEY)) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', capturePrompt);
    if (isIos) setVisible(true);
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!installPrompt) {
      setShowIosHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallPrompt(null);
  };

  if (!visible) return null;

  return (
    <aside className="pwa-install" aria-label="Instalar aplicativo">
      <div className="pwa-install-mark">M</div>
      <div className="pwa-install-copy">
        <strong>Instale o Minas Mais Executa</strong>
        <span>{showIosHelp ? 'No iPhone, toque em Compartilhar e depois em “Adicionar à Tela de Início”.' : 'Acesse as tarefas rapidamente pela tela inicial do celular.'}</span>
      </div>
      <button type="button" className="button pwa-install-button" onClick={install}>
        {showIosHelp ? <Share size={15} /> : <Download size={15} />}
        {showIosHelp ? 'Como instalar' : 'Instalar'}
      </button>
      <button type="button" className="pwa-install-close" onClick={dismiss} aria-label="Fechar aviso de instalação"><X size={16} /></button>
    </aside>
  );
}
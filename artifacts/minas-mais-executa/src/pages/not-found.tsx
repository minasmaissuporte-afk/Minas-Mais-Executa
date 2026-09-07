import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <main className="content" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><div className="card card-pad" style={{ width: 'min(460px, 100%)', textAlign: 'center' }}><Compass size={34} color="hsl(var(--primary))" style={{ margin: '0 auto 15px' }} /><div className="eyebrow">Rota não encontrada</div><h1 className="page-title" style={{ fontSize: 34 }}>Essa página saiu do mapa.</h1><p className="page-intro" style={{ margin: '0 auto 20px' }}>Volte para a visão geral e continue acompanhando a operação.</p><Link href="/" className="button button-primary" data-testid="link-not-found-home"><ArrowLeft size={15} /> Voltar ao início</Link></div></main>;
}
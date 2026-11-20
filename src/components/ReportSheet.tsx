import { useEffect } from 'react';
import { report } from '../domain/stats';
import { whatsappLink } from '../domain/content';
import { PremiumTag } from './PremiumTag';
import { useStore } from '../state/store';

export function ReportSheet({ onClose }: { onClose: () => void }) {
  const { S, toast } = useStore();
  const text = report(S);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const share = async () => {
    try {
      await navigator.share({ title: 'Relatório NEFESH Life', text });
    } catch {
      /* partilha cancelada */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Relatório copiado.');
    } catch {
      toast('Selecione o texto e copie.');
    }
  };

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Relatório para o profissional">
        <div className="row"><h2 style={{ margin: 0 }}>Relatório para o profissional</h2><PremiumTag f="relatorioCompleto" /></div>
        <p className="small mute">Só é partilhado com quem escolher.</p>
        <pre>{text}</pre>
        <div className="row">
          <div className="row" style={{ gap: 8 }}>
            <a className="btn" href={whatsappLink(`Olá NEFESH! Envio o meu relatório:\n\n${text}`)} target="_blank" rel="noopener">Enviar à NEFESH</a>
            {'share' in navigator && <button className="btn ghost" onClick={share}>Partilhar</button>}
            <button className="btn ghost" onClick={copy}>Copiar</button>
          </div>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

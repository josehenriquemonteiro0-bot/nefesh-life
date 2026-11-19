import { useState } from 'react';
import { todayKey } from '../domain/dates';
import { useStore } from '../state/store';

/** Texto de privacidade (rascunho a validar pelo responsável de proteção de dados). */
export function PrivacyText() {
  return (
    <div className="small privacy">
      <p><b>O que guardamos:</b> as suas respostas à avaliação (incluindo informação de saúde como sono, peso ou gravidez), as tomas, a água, os check-ins e os passos e o sono que registar.</p>
      <p><b>Onde:</b> apenas neste telemóvel. Nesta versão, nada é enviado para servidores da NEFESH.</p>
      <p><b>Partilha:</b> só quando escolher enviar o relatório ou falar connosco pelo WhatsApp.</p>
      <p><b>Os seus direitos:</b> pode guardar uma cópia, ou apagar tudo a qualquer momento em "Os meus dados", no ecrã Início.</p>
      <p><b>Importante:</b> a NEFESH Life é uma ferramenta de bem-estar. Não faz diagnósticos nem substitui um profissional de saúde.</p>
    </div>
  );
}

/** Aceitação do aviso de privacidade antes da primeira avaliação. */
export function Consent({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  const { update } = useStore();
  const [ok, setOk] = useState(false);
  return (
    <>
      <h1>Antes de começar</h1>
      <p className="mute">A avaliação pede alguma informação de saúde. Queremos que saiba exatamente o que acontece com ela.</p>
      <section className="card"><PrivacyText /></section>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Li e aceito que a NEFESH Life guarde estes dados neste telemóvel para criar o meu plano.</span>
      </label>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onCancel}>Agora não</button>
        <button
          className="btn"
          disabled={!ok}
          onClick={() => {
            update((d) => { d.consent = todayKey(); });
            onAccept();
          }}
        >
          Continuar
        </button>
      </div>
    </>
  );
}

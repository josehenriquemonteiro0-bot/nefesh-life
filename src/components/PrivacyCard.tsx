import { useState } from 'react';
import { CONSENT_TEXT, marketingOn, rdOn } from '../domain/consents';
import { useAuth } from '../domain/account';
import { useStore } from '../state/store';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Perfil → Privacidade e consentimentos: cada autorização em separado, com a data. */
export function PrivacyCard() {
  const { S, update, toast } = useStore();
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const set = (k: 'rd' | 'marketing', on: boolean) => {
    update((d) => { d.consents = { ...(d.consents ?? {}), [k]: { on, at: new Date().toISOString() } }; });
    toast(on ? 'Autorização dada. Obrigado!' : 'Autorização retirada.');
  };
  return (
    <section className="card" data-tour="privacidade">
      <h2 style={{ marginTop: 0 }}>Privacidade e consentimentos</h2>
      <p className="small mute" style={{ marginTop: 0 }}>Cada autorização é separada e pode mudá-la quando quiser. Retirar uma autorização não afeta o resto da app.</p>

      <div className="consent-row">
        <span className="consent-state on">✓</span>
        <span className="small">
          <b>Personalizar a app</b> · necessário<br />
          <span className="mute">{CONSENT_TEXT.personal} {S.consent ? `Aceite a ${S.consent.split('-').reverse().join('/')}.` : ''} Para o retirar, apague os seus dados (em baixo).</span>
        </span>
      </div>

      <label className="consent-row">
        <input type="checkbox" checked={rdOn(S)} onChange={(e) => set('rd', e.target.checked)} />
        <span className="small">
          <b>Investigação e desenvolvimento</b> · opcional<br />
          <span className="mute">{CONSENT_TEXT.rd} {S.consents?.rd ? `${rdOn(S) ? 'Autorizado' : 'Recusado'} a ${fmt(S.consents.rd.at)}.` : ''}</span>
        </span>
      </label>

      <label className={`consent-row ${auth ? '' : 'disabled'}`}>
        <input type="checkbox" checked={marketingOn(S)} disabled={!auth} onChange={(e) => set('marketing', e.target.checked)} />
        <span className="small">
          <b>Comunicações de marketing</b> · opcional<br />
          <span className="mute">
            {CONSENT_TEXT.marketing} {auth ? `Para ${auth.email}.` : 'Precisa de uma conta (o e-mail é o da conta).'} {S.consents?.marketing ? `${marketingOn(S) ? 'Autorizado' : 'Recusado'} a ${fmt(S.consents.marketing.at)}.` : ''}
          </span>
        </span>
      </label>

      <label className="consent-row">
        <input type="checkbox" checked={S.stats !== false} onChange={(e) => update((d) => { d.stats = e.target.checked; })} />
        <span className="small">
          <b>Estatísticas anónimas de utilização</b> · opcional<br />
          <span className="mute">Sem cookies, sem nome, sem e-mail e sem dados de saúde: só contamos, uma vez por dia, que partes da app foram usadas.</span>
        </span>
      </label>

      <button className="link small inline" onClick={() => setOpen(!open)}>{open ? 'Fechar' : 'O que acontece com os dados de investigação?'}</button>
      {open && (
        <p className="small mute" style={{ margin: '6px 0 0' }}>
          Com esta autorização, a app envia uma vez por dia médias arredondadas (objetivo, energia e sono no início e agora, Índice NEFESH e regularidade da Spirulina), sem nome, e-mail, datas ou texto. A equipa NEFESH só vê totais de grupo, e grupos com menos de 3 pessoas não mostram médias. Nunca são vendidos nem partilhados com terceiros. As recomendações da app não dependem desta escolha nem de compras.
        </p>
      )}
    </section>
  );
}

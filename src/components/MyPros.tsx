import { useState } from 'react';
import type { Nav, Tab } from '../App';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { applyProPlan, codeLooksValid, normCode, proApi } from '../domain/pro';
import { isNutriKind } from '../domain/proNutriClient';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';

/**
 * Os meus profissionais (em Cuidados): um só sítio para o código de qualquer profissional da NEFESH
 * (personal, nutricionista, médico ou terapeuta de práticas integrativas). A app reconhece a área
 * pelo código e liga-o ao lugar certo; aqui ficam todos, com a conversa e o atalho para o plano.
 */
export function MyProsCard({ go }: { go: Nav }) {
  const { S, update, toast } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [chat, setChat] = useState<{ code: string; pro: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const links: { code: string; pro: string; area: string; plan: string; tab: Tab; has: boolean }[] = [];
  if (S.nutriLink) links.push({ ...S.nutriLink, area: 'Nutricionista ou médico(a)', plan: 'Plano alimentar', tab: 'nutri', has: !!S.nutriPlan });
  if (S.wellLink) links.push({ ...S.wellLink, area: 'Práticas integrativas', plan: 'Plano de bem-estar', tab: 'mente', has: !!S.wellPlan });
  if (S.proLink) links.push({ ...S.proLink, area: 'Personal', plan: 'Treino', tab: 'treino', has: !!S.trainPlan });

  const use = async () => {
    setErr('');
    if (!codeLooksValid(code)) return setErr('O código tem este formato: NP-XXXX-XXXX.');
    setBusy(true);
    try {
      const r = await proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      update((d) => applyProPlan(d, r));
      const where = isNutriKind(r.kind) ? 'o plano alimentar fica em Saúde → Nutrição' : r.kind === 'integrativo' ? 'o plano de bem-estar fica em Saúde → Mente' : 'o treino fica em Saúde → Treino';
      toast(`Ligado a ${r.pro}: ${where}.`);
      setCode('');
      setAdding(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Os meus profissionais</h2>
      {links.length === 0 && <p className="small mute" style={{ marginTop: 0 }}>O seu médico, nutricionista, terapeuta ou personal acompanha-o pelo NEFESH Life Pro e envia-lhe um código. Escreva-o aqui: a app reconhece a área e põe o plano no sítio certo.</p>}
      {links.map((l) => (
        <div key={l.code} className="pro-ask" style={{ marginTop: 8 }}>
          <p className="small" style={{ margin: 0 }}><b data-raw>{l.pro}</b> · <span className="mute">{l.area}</span></p>
          <p className="small mute" style={{ margin: '2px 0 6px' }}>{l.has ? `${l.plan} na app.` : `${l.plan} ainda não enviado: aparece sozinho.`}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => go(l.tab)}>Abrir {l.plan.toLowerCase()}</button>
            <button className="btn ghost sm" onClick={() => setChat({ code: l.code, pro: l.pro })}>💬 Conversa</button>
          </div>
        </div>
      ))}
      {chat && <ChatThread code={chat.code} me="aluno" other={chat.pro} asSheet onClose={() => setChat(null)} />}
      {links.length > 0 && !adding ? (
        <button className="link small inline" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ Usar o código de outro profissional</button>
      ) : (
        <>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap', marginTop: 10 }}>
            <input className="field sm" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="NP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do profissional" autoCapitalize="characters" />
            <button className="btn sm" disabled={busy || !code.trim()} onClick={use}>{busy ? 'A ligar…' : 'Usar'}</button>
          </div>
          {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
        </>
      )}
    </section>
  );
}

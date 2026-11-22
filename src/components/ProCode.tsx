import { useEffect, useState } from 'react';
import { applyProPlan, checkProPlan, clearProPlan, codeLooksValid, flushWorkouts, normCode, proApi } from '../domain/pro';
import { shortDate } from '../domain/dates';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';

/** Aluno: o código do personal (NEFESH Life Pro) carrega o treino; com o código ligado, mostra quem é e permite desligar. */
export function ProCodeCard() {
  const { S, update, toast } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const link = S.proLink;
  const [unread, setUnread] = useState(0);
  const [chat, setChat] = useState(false);

  // ao abrir: plano novo do personal? e treinos por enviar
  useEffect(() => {
    if (!link) return;
    flushWorkouts();
    checkProPlan(link.code)
      .then((r) => {
        setUnread(r.unread ?? 0);
        if (r.version > link.version) {
          update((d) => applyProPlan(d, r));
          toast(`${r.pro} atualizou o seu treino. 💪`);
        }
      })
      .catch(() => undefined);
  }, [link?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (link)
    return (
      <section className="card pro-link">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>NEFESH Life Pro</p>
        <p style={{ margin: '4px 0 2px' }}>Treino de <b>{link.pro}</b></p>
        <p className="small mute" style={{ margin: 0 }}>Código {link.code} · atualizado a {shortDate(link.at)}. Quando concluir um treino, {link.pro} recebe um aviso com o que fez.</p>
        {!S.trainPlan && <p className="small warn" style={{ margin: '6px 0 0' }}>{link.pro} ainda não montou o seu treino. Aparece aqui assim que estiver pronto.</p>}
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { setChat(true); setUnread(0); }}>💬 Falar com {link.pro}{unread ? <span className="badge">{unread}</span> : null}</button>
        {chat && <ChatThread code={link.code} me="aluno" other={link.pro} asSheet onClose={() => setChat(false)} />}
        <br />
        <button
          className="link small inline"
          style={{ marginTop: 6 }}
          onClick={async () => {
            if (!confirm(`Deixar de seguir o treino de ${link.pro}? O seu histórico fica na app.`)) return;
            await proApi('aluno/sair', { code: link.code }).catch(() => undefined);
            update((d) => clearProPlan(d));
          }}
        >
          Desligar do personal
        </button>
      </section>
    );

  const go = async () => {
    setErr('');
    if (!codeLooksValid(code)) return setErr('O código tem este formato: NP-XXXX-XXXX.');
    setBusy(true);
    try {
      const r = await proApi<{ code: string; pro: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      update((d) => applyProPlan(d, r));
      toast(r.plan ? `Treino de ${r.pro} carregado: ${r.plan.workouts.length} ${r.plan.workouts.length === 1 ? 'treino' : 'treinos'}.` : `Ligado a ${r.pro}. O treino aparece assim que estiver pronto.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Tem um código do seu personal?</h2>
      <p className="small mute" style={{ marginTop: 0 }}>O seu personal monta o treino no NEFESH Life Pro e envia-lhe um código. O treino carrega aqui com tudo, e ele vê quando o concluir.</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <input className="field sm" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="NP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do personal" autoCapitalize="characters" />
        <button className="btn sm" disabled={busy || !code.trim()} onClick={go}>{busy ? 'A ligar…' : 'Usar'}</button>
      </div>
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}

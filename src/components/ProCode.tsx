import { useEffect, useState } from 'react';
import { applyProPlan, checkProPlan, clearProPlan, codeLooksValid, flushWorkouts, normCode, proApi, syncShare } from '../domain/pro';
import { todayKey } from '../domain/dates';
import { shortDate } from '../domain/dates';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { isNutriKind } from '../domain/proNutriClient';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';
import { TeamToggle } from './TeamToggle';

/** Aluno: o código do personal (NEFESH Life Pro) carrega o treino; com o código ligado, mostra quem é e permite desligar. */
export function ProCodeCard() {
  const { S, update, toast } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const link = S.proLink;
  const [unread, setUnread] = useState(0);
  const [chat, setChat] = useState(false);

  // ao abrir, ao voltar à app e (sem treino ainda) de 30 em 30 s: plano novo do personal? e treinos por enviar
  const [checking, setChecking] = useState(false);
  const check = (manual = false) => {
    if (!link) return Promise.resolve();
    if (manual) setChecking(true);
    return checkProPlan(link.code)
      .then((r) => {
        setUnread(r.unread ?? 0);
        // relatório partilhado: atualiza uma vez por dia
        if (S.proShare?.on && S.proShare.at !== todayKey()) syncShare(S, true).then(() => update((d) => { d.proShare = { ...d.proShare, on: true, at: todayKey() }; })).catch(() => undefined);
        if (r.version > link.version || (r.plan?.workouts.length && !S.trainPlan)) {
          update((d) => applyProPlan(d, r));
          toast(!r.plan?.workouts.length ? `${r.pro} enviou-lhe uma indicação de jejum: veja em Nutrição. 🌙` : link.version === 0 || !S.trainPlan ? `O treino de ${r.pro} chegou. 💪` : `${r.pro} atualizou o seu treino. 💪`);
        } else if (manual) toast(r.plan ? 'O seu treino está em dia.' : `${r.pro} ainda não enviou o treino.`);
      })
      .catch(() => manual && toast('Sem ligação. Tente outra vez.'))
      .finally(() => manual && setChecking(false));
  };
  useEffect(() => {
    if (!link) return;
    flushWorkouts();
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    const id = S.trainPlan ? 0 : window.setInterval(() => check(), 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); if (id) window.clearInterval(id); };
  }, [link?.code, link?.version, !!S.trainPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (link)
    return (
      <section className="card pro-link">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>NEFESH Life Pro</p>
        <p style={{ margin: '4px 0 2px' }}>Treino de <b>{link.pro}</b></p>
        <p className="small mute" style={{ margin: 0 }}>Código {link.code} · atualizado a {shortDate(link.at)}. Quando concluir um treino, {link.pro} recebe um aviso com o que fez.</p>
        {!S.trainPlan && (
          <p className="small warn" style={{ margin: '6px 0 0' }}>
            {link.pro} ainda não enviou o seu treino. Aparece aqui sozinho assim que for enviado.{' '}
            <button className="link small inline" disabled={checking} onClick={() => check(true)}>{checking ? 'A ver…' : 'Ver se já chegou'}</button>
          </p>
        )}
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { setChat(true); setUnread(0); }}>💬 Falar com {link.pro}{unread ? <span className="badge">{unread}</span> : null}</button>
        {chat && <ChatThread code={link.code} me="aluno" other={link.pro} asSheet onClose={() => setChat(false)} />}
        <TeamToggle />
        <div className="pro-share">
          <label className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!S.proShare?.on} style={{ marginTop: 2, width: 22, height: 22, flex: "0 0 22px", accentColor: "var(--neon)" }} aria-label="Partilhar o resumo de bem-estar" onChange={async (e) => {
              const on = e.target.checked;
              try {
                await syncShare(S, on);
                update((d) => { d.proShare = on ? { on: true, at: todayKey() } : { on: false }; });
                toast(on ? `${link.pro} passa a ver o seu resumo de bem-estar.` : `Deixou de partilhar. ${link.pro} já não vê o resumo.`);
              } catch (err) { toast((err as Error).message); }
            }} />
            <span className="small"><b>Partilhar o meu resumo de bem-estar com {link.pro}</b><br />
              <span className="mute">Últimos 14 dias, só números: energia, sono, stress, passos, água, alimentação (calorias e proteína), treino, peso e dias de Spirulina. Nunca o diário, notas, ciclo ou medicação. Pode desligar quando quiser e o que estava partilhado é apagado.</span>
            </span>
          </label>
          {S.proShare?.on && (
            <label className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start', cursor: 'pointer', marginTop: 10 }}>
              <input type="checkbox" checked={!!S.proShare.body} style={{ marginTop: 2, width: 22, height: 22, flex: '0 0 22px', accentColor: 'var(--neon)' }} aria-label="Incluir as medidas do corpo" onChange={async (e) => {
                const body = e.target.checked;
                try {
                  await syncShare({ ...S, proShare: { ...S.proShare!, body } }, true);
                  update((d) => { d.proShare = { on: true, at: todayKey(), body }; });
                  toast(body ? `${link.pro} passa a ver as suas medidas e avaliações.` : `${link.pro} deixou de ver as suas medidas.`);
                } catch (err) { toast((err as Error).message); }
              }} />
              <span className="small"><b>Incluir as medidas e avaliações do corpo</b><br />
                <span className="mute">% de gordura, massa magra, perímetros e os dados dos relatórios que anexou (dobras, RCQ…), da primeira à última medição.</span>
              </span>
            </label>
          )}
        </div>
        <br />
        <button
          className="link small inline"
          style={{ marginTop: 6 }}
          onClick={async () => {
            if (!confirm(`Deixar de seguir o treino de ${link.pro}? O seu histórico fica na app.`)) return;
            await proApi('aluno/sair', { code: link.code }).catch(() => undefined);
            update((d) => { clearProPlan(d); delete d.proShare; });
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
      const r = await proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      update((d) => applyProPlan(d, r));
      if (isNutriKind(r.kind)) { toast(`Ligado a ${r.pro} (nutrição): o plano alimentar fica em Saúde → Nutrição.`); return; }
      if (r.kind === 'integrativo') { toast(`Ligado a ${r.pro} (práticas integrativas): o plano de bem-estar fica em Saúde → Mente.`); return; }
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

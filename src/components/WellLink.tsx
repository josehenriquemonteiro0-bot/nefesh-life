import { useEffect, useState } from 'react';
import { shortDate, todayKey } from '../domain/dates';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { checkProPlan, codeLooksValid, normCode, proApi } from '../domain/pro';
import { WHEN_LABEL, applyWellPlan, clearWellPlan, isWellKind, practiceOf, sendWellDays, symptomsDue, syncWellShare, wellWeek, type WellPlan } from '../domain/proWell';
import { IntakeForm, SymptomCheck } from './WellIntake';
import { isNutriKind } from '../domain/proNutriClient';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';
import { usePractice } from './sleep/usePractice';

/**
 * Paciente de um terapeuta de práticas integrativas (NEFESH Life Pro): o código liga o plano de bem-estar,
 * com os hábitos do dia para marcar, as práticas guiadas da app e a conversa com o terapeuta.
 */
export function WellLinkCard() {
  const { S, update, updateToday, toast, todayLog } = useStore();
  const link = S.wellLink;
  const plan = S.wellPlan;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [chat, setChat] = useState(false);
  const [unread, setUnread] = useState(0);
  const [visit, setVisit] = useState<{ day: string; time: string; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [intakeAt, setIntakeAt] = useState<string | null>(null);
  const [intake, setIntake] = useState(false);
  const [symOpen, setSymOpen] = useState(false);
  const [symDone, setSymDone] = useState(false);
  const { start, node } = usePractice((m) => m >= 1 && toast(`Prática feita: ${m >= 2 ? Math.round(m) : m} min. 🌿`));

  const check = (manual = false) => {
    if (!link) return Promise.resolve();
    return checkProPlan(link.code)
      .then((r) => {
        setUnread(r.unread ?? 0);
        setVisit(r.nextVisit ?? null);
        setIntakeAt(r.intakeAt ?? null);
        if (S.wellShare?.on && S.wellShare.at !== todayKey()) syncWellShare(S, true).then(() => update((d) => { d.wellShare = { ...(d.wellShare ?? { on: true }), on: true, at: todayKey() }; })).catch(() => undefined);
        if (r.version > link.version || (r.plan?.bemestar && !plan)) {
          update((d) => applyWellPlan(d, r as never));
          toast(!plan ? `O plano de bem-estar de ${r.pro} chegou. 🌿` : `${r.pro} atualizou o seu plano de bem-estar. 🌿`);
        } else if (manual) toast(r.plan?.bemestar ? 'O seu plano está em dia.' : `${r.pro} ainda não enviou o plano.`);
      })
      .catch(() => manual && toast('Sem ligação. Tente outra vez.'));
  };
  useEffect(() => {
    if (!link) return;
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    const id = plan ? 0 : window.setInterval(() => check(), 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); if (id) window.clearInterval(id); };
  }, [link?.code, link?.version, !!plan]); // eslint-disable-line react-hooks/exhaustive-deps
  // os hábitos marcados seguem para o terapeuta (com um pequeno atraso, para juntar vários toques)
  const doneKey = (todayLog.wellDone ?? []).join(',');
  useEffect(() => {
    if (!link || !plan) return;
    const t = window.setTimeout(() => sendWellDays(S).catch(() => undefined), 1500);
    return () => window.clearTimeout(t);
  }, [doneKey, link?.code, plan?.habits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async (patch: Partial<NonNullable<typeof S.wellShare>>, msg: string) => {
    const next = { ...(S.wellShare ?? { on: false }), ...patch };
    try {
      await syncWellShare({ ...S, wellShare: next }, next.on);
      update((d) => { d.wellShare = next.on ? { ...next, at: todayKey() } : { on: false }; });
      toast(msg);
    } catch (er) { toast((er as Error).message); }
  };

  if (link) {
    const done = new Set(todayLog.wellDone ?? []);
    const wk = wellWeek(plan);
    const order: WellPlan['habits'][number]['when'][] = ['manha', 'tarde', 'noite', 'dia'];
    const practices = (plan?.practices ?? []).map(practiceOf).filter((x): x is NonNullable<ReturnType<typeof practiceOf>> => !!x);
    return (
      <section className="card pro-link">
        {node}
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>NEFESH Life Pro · plano de bem-estar</p>
        <p style={{ margin: '4px 0 2px' }}>Plano de <b data-raw>{link.pro}</b></p>
        {!plan && <p className="small mute" style={{ margin: 0 }}>{link.pro} ainda não enviou o plano. Aparece aqui sozinho.</p>}
        {plan && (
          <>
            {plan.goals && <p className="small" style={{ margin: '6px 0 0' }}>🎯 {plan.goals}</p>}
            {wk && <p className="small" style={{ margin: '6px 0 0' }}>🗓️ Plano de {wk.of} semanas · {wk.ended ? `terminou: fale com ${link.pro} para o renovar` : `semana ${wk.week} de ${wk.of}`}</p>}
            {plan.habits.length > 0 && (
              <>
                <p className="small" style={{ margin: '10px 0 4px' }}><b>Hábitos de hoje</b> · {done.size} de {plan.habits.length}</p>
                {order.filter((w) => plan.habits.some((h) => h.when === w)).map((w) => (
                  <div key={w} style={{ margin: '4px 0' }}>
                    <p className="small mute" style={{ margin: '4px 0 2px' }}>{WHEN_LABEL[w]}</p>
                    {plan.habits.map((h, i) => h.when !== w ? null : (
                      <label key={i} className="check" style={{ margin: '4px 0' }}>
                        <input type="checkbox" checked={done.has(i)} onChange={() => updateToday((d) => { const s = new Set(d.wellDone ?? []); if (s.has(i)) s.delete(i); else s.add(i); d.wellDone = [...s].sort((a, b) => a - b); })} />
                        <span className="small">{h.text}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </>
            )}
            {practices.length > 0 && (
              <>
                <p className="small" style={{ margin: '10px 0 4px' }}><b>Práticas indicadas</b></p>
                <div className="chips">
                  {practices.map((p) => (
                    <button key={p.id} className="chip sm" onClick={() => start(p.kind === 'respiracao' ? { kind: 'respiracao', id: p.id as never, minutes: 5 } : { kind: 'meditacao', id: p.id })}>▶ {p.name} · {p.minutes} min</button>
                  ))}
                </div>
              </>
            )}
            {plan.notes && <p className="small" style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>📝 {plan.notes}</p>}
          </>
        )}
        {plan?.track?.length && !symDone && symptomsDue(S) ? (
          symOpen ? <SymptomCheck track={plan.track} pro={link.pro} onDone={() => { setSymOpen(false); setSymDone(true); }} />
            : <div className="pro-ask" style={{ marginTop: 10 }}><p className="small" style={{ margin: '0 0 6px' }}>📊 <b>{link.pro}</b> quer saber como estiveram os sintomas nesta semana. Leva 30 segundos.</p><button className="btn sm" onClick={() => setSymOpen(true)}>Responder</button></div>
        ) : null}
        {intake ? <IntakeForm code={link.code} pro={link.pro} sentAt={intakeAt} onSent={(at) => { setIntakeAt(at); setIntake(false); }} onClose={() => setIntake(false)} />
          : !intakeAt && <div className="pro-ask" style={{ marginTop: 10 }}><p className="small" style={{ margin: '0 0 6px' }}>📝 Preencha a sua <b>ficha de saúde</b> para {link.pro} antes da consulta: a sessão rende mais.</p><button className="btn sm" onClick={() => setIntake(true)}>Preencher ficha</button></div>}
        {visit && <p className="small" style={{ margin: '8px 0 0' }}>📅 Próxima sessão: <b>{shortDate(visit.day)}{visit.time ? ` às ${visit.time}` : ''}</b>{visit.text ? ` · ${visit.text}` : ''}</p>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
          <button className="btn sm" onClick={() => { setChat(true); setUnread(0); }}>💬 Falar com {link.pro}{unread ? <span className="badge">{unread}</span> : null}</button>
          {!plan && <button className="btn ghost sm" onClick={() => check(true)}>Ver se já chegou</button>}
          <button className="btn ghost sm" onClick={() => setOpen(!open)} aria-expanded={open}>Partilha</button>
          {intakeAt && !intake && <button className="btn ghost sm" onClick={() => setIntake(true)}>📝 Ficha de saúde</button>}
        </div>
        {chat && <ChatThread code={link.code} me="aluno" other={link.pro} asSheet onClose={() => setChat(false)} />}
        {open && (
          <div className="pro-share">
            <label className="check"><input type="checkbox" checked={!!S.wellShare?.on} onChange={(e) => share({ on: e.target.checked }, e.target.checked ? `${link.pro} passa a ver o seu resumo.` : `Deixou de partilhar. ${link.pro} já não vê o resumo.`)} />
              <span className="small"><b>Partilhar o meu resumo com {link.pro}</b><br /><span className="mute">Últimos 14 dias, só números: sono, energia, stress, água, treino e passos. Nunca o diário escrito, notas, ciclo ou medicação. Pode desligar quando quiser e o que estava partilhado é apagado.</span></span>
            </label>
            {S.wellShare?.on && (
              <>
                <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!S.wellShare.sleep} onChange={(e) => share({ sleep: e.target.checked }, e.target.checked ? 'Diário do sono incluído no resumo.' : 'Diário do sono retirado do resumo.')} />
                  <span className="small"><b>Incluir o diário do sono</b> <span className="mute">(só números: horários, tempo até adormecer, despertares, qualidade)</span></span></label>
                <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!S.wellShare.labs} onChange={(e) => share({ labs: e.target.checked }, e.target.checked ? 'Análises incluídas no resumo.' : 'Análises retiradas do resumo.')} />
                  <span className="small"><b>Incluir as análises clínicas</b> <span className="mute">(as que registou em Cuidados)</span></span></label>
              </>
            )}
          </div>
        )}
        <p className="small mute" style={{ margin: '10px 0 0' }}>As práticas integrativas complementam o acompanhamento médico, não o substituem. Não deixe nenhum tratamento sem falar com o seu médico.</p>
        <button className="link small inline" style={{ marginTop: 10 }} onClick={() => {
          if (!confirm(`Desligar de ${link.pro}? O plano sai da app e a partilha é apagada.`)) return;
          proApi('aluno/sair', { code: link.code }).catch(() => undefined);
          update((d) => clearWellPlan(d));
          toast(`Desligado de ${link.pro}.`);
        }}>Desligar do terapeuta</button>
      </section>
    );
  }

  const go = async () => {
    setErr('');
    if (!codeLooksValid(code)) return setErr('O código tem este formato: NP-XXXX-XXXX.');
    setBusy(true);
    try {
      const r = await proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      if (!isWellKind(r.kind)) { setErr(isNutriKind(r.kind) ? `Este código é de ${r.pro}, nutricionista ou médico(a): use-o em Saúde → Nutrição.` : `Este código é de ${r.pro}, personal: use-o em Saúde → Treino → Com personal.`); return; }
      update((d) => applyWellPlan(d, r as never));
      toast(r.plan?.bemestar ? `Plano de bem-estar de ${r.pro} carregado. 🌿` : `Ligado a ${r.pro}. O plano aparece assim que estiver pronto.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Tem terapeuta de práticas integrativas na NEFESH?</h2>
      <p className="small mute" style={{ marginTop: 0 }}>O seu terapeuta (naturopatia e outras práticas integrativas) monta um plano de bem-estar no NEFESH Life Pro e envia-lhe um código. Os hábitos e as práticas aparecem aqui, e ele acompanha como está a correr.</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <input className="field sm" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="NP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do terapeuta" autoCapitalize="characters" />
        <button className="btn sm" disabled={busy || !code.trim()} onClick={go}>{busy ? 'A ligar…' : 'Usar'}</button>
      </div>
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}

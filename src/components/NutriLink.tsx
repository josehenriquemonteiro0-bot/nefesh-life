import { useEffect, useState } from 'react';
import { shortDate, todayKey } from '../domain/dates';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { applyNutriPlan, checkProPlan, clearNutriPlan, codeLooksValid, normCode, proApi, sendNutriDays, syncNutriShare } from '../domain/pro';
import { isNutriKind } from '../domain/proNutriClient';
import { useStore } from '../state/store';
import { ChatThread } from './ProChat';

/** Paciente: o código do nutricionista (NEFESH Life Pro) põe o plano alimentar no diário; conversa e partilha do resumo. */
export function NutriLinkCard() {
  const { S, update, toast } = useStore();
  const link = S.nutriLink;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [chat, setChat] = useState(false);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const check = (manual = false) => {
    if (!link) return Promise.resolve();
    return checkProPlan(link.code)
      .then((r) => {
        setUnread(r.unread ?? 0);
        if (S.nutriShare?.on && S.nutriShare.at !== todayKey()) syncNutriShare(S, true).then(() => update((d) => { d.nutriShare = { ...d.nutriShare!, on: true, at: todayKey() }; })).catch(() => undefined);
        if (r.version > link.version || (r.plan?.nutri && !S.proNutriRx)) {
          update((d) => applyNutriPlan(d, r));
          toast(link.version === 0 || !S.proNutriRx ? `O plano alimentar de ${r.pro} chegou. 🥗` : `${r.pro} atualizou o seu plano alimentar. 🥗`);
        } else if (manual) toast(r.plan?.nutri ? 'O seu plano está em dia.' : `${r.pro} ainda não enviou o plano.`);
      })
      .catch(() => manual && toast('Sem ligação. Tente outra vez.'));
  };
  useEffect(() => {
    if (!link) return;
    sendNutriDays(S);
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    const id = S.proNutriRx ? 0 : window.setInterval(() => check(), 30000);
    return () => { document.removeEventListener('visibilitychange', onVis); if (id) window.clearInterval(id); };
  }, [link?.code, link?.version, !!S.proNutriRx]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async (patch: Partial<NonNullable<typeof S.nutriShare>>, msg: string) => {
    const next = { ...(S.nutriShare ?? { on: false }), ...patch };
    try {
      await syncNutriShare({ ...S, nutriShare: next }, next.on);
      update((d) => { d.nutriShare = next.on ? { ...next, at: todayKey() } : { on: false }; });
      toast(msg);
    } catch (e) { toast((e as Error).message); }
  };

  if (link)
    return (
      <section className="card pro-link">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>NEFESH Life Pro · acompanhamento nutricional</p>
        <p style={{ margin: '4px 0 2px' }}>Plano de <b>{link.pro}</b></p>
        <p className="small mute" style={{ margin: 0 }}>
          {S.proNutriRx ? `${S.nutriPlan?.meals.length ?? 0} refeições hoje${S.proNutriRx.days.length > 1 && S.nutriPlan && 'day' in S.nutriPlan ? ` (${(S.nutriPlan as { day?: string }).day})` : ''} · atualizado a ${shortDate(link.at)}. Marque as refeições no plano: ${link.pro} vê a sua adesão.` : `${link.pro} ainda não enviou o plano. Aparece aqui sozinho.`}
        </p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 10 }}>
          <button className="btn sm" onClick={() => { setChat(true); setUnread(0); }}>💬 Falar com {link.pro}{unread ? <span className="badge">{unread}</span> : null}</button>
          {!S.proNutriRx && <button className="btn ghost sm" onClick={() => check(true)}>Ver se já chegou</button>}
          <button className="btn ghost sm" onClick={() => setOpen(!open)} aria-expanded={open}>Partilha</button>
        </div>
        {chat && <ChatThread code={link.code} me="aluno" other={link.pro} asSheet onClose={() => setChat(false)} />}
        {open && (
          <div className="pro-share">
            <label className="check"><input type="checkbox" checked={!!S.nutriShare?.on} onChange={(e) => share({ on: e.target.checked }, e.target.checked ? `${link.pro} passa a ver o seu resumo.` : `Deixou de partilhar. ${link.pro} já não vê o resumo.`)} />
              <span className="small"><b>Partilhar o meu resumo com {link.pro}</b><br /><span className="mute">Últimos 14 dias, só números: adesão ao plano e alterações, calorias e proteína, água, fome, jejum, sono, energia, treino e peso. Nunca o diário escrito, notas, ciclo ou medicação. Pode desligar quando quiser e o que estava partilhado é apagado.</span></span>
            </label>
            {S.nutriShare?.on && (
              <>
                <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!S.nutriShare.body} onChange={(e) => share({ body: e.target.checked }, e.target.checked ? 'Medidas incluídas no resumo.' : 'Medidas retiradas do resumo.')} />
                  <span className="small"><b>Incluir as medidas e avaliações do corpo</b></span></label>
                <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={!!S.nutriShare.labs} onChange={(e) => share({ labs: e.target.checked }, e.target.checked ? 'Análises incluídas no resumo.' : 'Análises retiradas do resumo.')} />
                  <span className="small"><b>Incluir as análises clínicas</b> <span className="mute">(glicemia, colesterol, ferritina… as que registou em Cuidados)</span></span></label>
              </>
            )}
          </div>
        )}
        <button className="link small inline" style={{ marginTop: 10 }} onClick={() => {
          if (!confirm(`Desligar de ${link.pro}? O plano sai do diário e a partilha é apagada.`)) return;
          proApi('aluno/sair', { code: link.code }).catch(() => undefined);
          update((d) => clearNutriPlan(d));
          toast('Desligado do nutricionista.');
        }}>Desligar do nutricionista</button>
      </section>
    );

  const go = async () => {
    setErr('');
    if (!codeLooksValid(code)) return setErr('O código tem este formato: NP-XXXX-XXXX.');
    setBusy(true);
    try {
      const r = await proApi<{ code: string; pro: string; kind?: string; plan: ParsedWorkoutPlan | null; version: number }>('aluno/ligar', { code: normCode(code) });
      if (!isNutriKind(r.kind)) { setErr(`Este código é de ${r.pro}, que é personal: use-o em Saúde → Treino → Com personal.`); return; }
      update((d) => applyNutriPlan(d, r));
      toast(r.plan?.nutri ? `Plano alimentar de ${r.pro} carregado. 🥗` : `Ligado a ${r.pro}. O plano aparece assim que estiver pronto.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Tem nutricionista na NEFESH?</h2>
      <p className="small mute" style={{ marginTop: 0 }}>O seu nutricionista monta o plano no NEFESH Life Pro e envia-lhe um código. O plano entra no diário, refeição a refeição, e ele acompanha como está a correr.</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <input className="field sm" style={{ flex: 1, textTransform: 'uppercase' }} placeholder="NP-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do nutricionista" autoCapitalize="characters" />
        <button className="btn sm" disabled={busy || !code.trim()} onClick={go}>{busy ? 'A ligar…' : 'Usar'}</button>
      </div>
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}

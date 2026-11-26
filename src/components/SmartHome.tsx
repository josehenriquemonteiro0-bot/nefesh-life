import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { planFor } from '../domain/plan';
import {
  MAX_FAV, SHORTCUTS, discoverOfWeek, insightOfDay, markDiscover, markInsightShown, moveFav, noteUse, rateInsight, shortcutOf, smartShortcuts, toggleFav,
  type ShortcutId,
} from '../domain/smart';
import { useDoseToggle } from '../state/doses';
import { useStore } from '../state/store';
import { premiumGate } from './Paywall';
import { requestPhoto } from './PhotoMeal';
import { usePractice } from './sleep/usePractice';

/** Executa um atalho: as ações simples fazem-se aqui mesmo; as outras abrem o ecrã certo. */
function useRunShortcut(go: Nav) {
  const { S, todayLog: l, update, updateToday, toast } = useStore();
  const { slots, doses, toggle } = useDoseToggle();
  const { start, node } = usePractice((m) => m >= 1 && toast(`Feito: ${Math.round(m)} min de respiração. 😮‍💨`));
  const run = (id: ShortcutId) => {
    update((d) => noteUse(d, id));
    const goal = planFor(S).water;
    switch (id) {
      case 'agua':
        updateToday((t) => { t.water = (t.water ?? 0) + 1; });
        toast((l.water ?? 0) + 1 >= goal ? `Meta de água cumprida. 💧 (${(l.water ?? 0) + 1} copos)` : `+1 copo · ${(l.water ?? 0) + 1} de ${goal} 💧`);
        return;
      case 'dose': {
        const i = slots.findIndex((_, j) => !doses[j]);
        if (i < 0) { toast('As tomas de hoje já estão todas marcadas. 🌿'); return; }
        toggle(i);
        toast(`Toma marcada (${slots[i].l.toLowerCase()}). 🌿`);
        return;
      }
      case 'respirar': start({ kind: 'respiracao', id: new Date().getHours() >= 21 ? '478' : 'coerencia', minutes: 5 }); return;
      case 'foto': if (premiumGate(S, 'fotoPrato')) { requestPhoto(); go('nutri'); } return;
      case 'meditar': go('mente'); return;
      case 'treino': go('treino'); return;
      case 'checkin': go('check'); return;
      case 'diario': go('sono'); return;
      case 'jejum': case 'rotulo': go('nutri'); return;
      case 'med': case 'pros': go('cuidados'); return;
      case 'coach': go('coach'); return;
      case 'receitas': go('recipes'); return;
      case 'corpo': go('corpo'); return;
      case 'ciclo': go('ciclo'); return;
      case 'evolucao': go('evo'); return;
      case 'comunidade': go('social'); return;
    }
  };
  return { run, node };
}

/** Atalhos do Início: os favoritos e os que a pessoa mais usa a esta hora, com ações diretas. */
export function SmartShortcuts({ go }: { go: Nav }) {
  const { S } = useStore();
  const { run, node } = useRunShortcut(go);
  const [edit, setEdit] = useState(false);
  const list = smartShortcuts(S);
  return (
    <section className="card smart-sc" aria-label="Atalhos">
      {node}
      <div className="row" style={{ marginBottom: 8 }}>
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Atalhos</p>
        <button className="link small inline" onClick={() => setEdit(!edit)} aria-expanded={edit}>{edit ? 'Fechar' : '✏️ Editar'}</button>
      </div>
      <div className="sc-grid">
        {list.map(({ id, fav }) => { const s = shortcutOf(id)!; return (
          <button key={id} className="sc-btn" onClick={() => run(id)}>
            <span className="sc-emo" aria-hidden>{s.icon}</span>
            <span className="small">{s.label}</span>
            {fav && <span className="sc-fav" aria-label="favorito">★</span>}
          </button>
        ); })}
      </div>
      {!S.smart?.fav?.length && !edit && <p className="small mute" style={{ margin: '8px 0 0' }}>Mudam com a hora e com o que mais usa. Toque em ✏️ Editar para fixar os seus favoritos.</p>}
      {edit && <ShortcutEditor />}
    </section>
  );
}

function ShortcutEditor() {
  const { S, update } = useStore();
  const fav = (S.smart?.fav ?? []) as ShortcutId[];
  return (
    <div className="pro-share" style={{ marginTop: 10 }}>
      <p className="small" style={{ margin: '0 0 6px' }}><b>Favoritos</b> · até {MAX_FAV}, ficam sempre à frente. Os outros lugares mudam sozinhos com o que mais usa a cada hora.</p>
      {fav.map((id, i) => (
        <div key={id} className="row" style={{ gap: 6, margin: '4px 0', flexWrap: 'nowrap' }}>
          <span className="small" style={{ flex: 1 }}>{shortcutOf(id)!.icon} {shortcutOf(id)!.label}</span>
          <button className="btn ghost sm" disabled={i === 0} onClick={() => update((d) => moveFav(d, id, -1))} aria-label={`Subir ${shortcutOf(id)!.label}`}>↑</button>
          <button className="btn ghost sm" disabled={i === fav.length - 1} onClick={() => update((d) => moveFav(d, id, 1))} aria-label={`Descer ${shortcutOf(id)!.label}`}>↓</button>
          <button className="btn ghost sm" onClick={() => update((d) => toggleFav(d, id))} aria-label={`Tirar ${shortcutOf(id)!.label} dos favoritos`}>✕</button>
        </div>
      ))}
      <div className="chips" style={{ marginTop: 8 }}>
        {SHORTCUTS.filter((s) => !fav.includes(s.id)).map((s) => (
          <button key={s.id} className="chip sm" disabled={fav.length >= MAX_FAV} onClick={() => update((d) => toggleFav(d, s.id))}>☆ {s.icon} {s.label}</button>
        ))}
      </div>
    </div>
  );
}

/** Um padrão por dia, descoberto nos dados da própria pessoa, com 👍/👎. */
export function InsightCard() {
  const { S, update, toast } = useStore();
  const ins = insightOfDay(S);
  const [rated, setRated] = useState<1 | -1 | null>(null);
  useEffect(() => { if (ins && S.smart?.ins?.id !== ins.id) update((d) => markInsightShown(d, ins.id)); }, [ins?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ins) return null;
  const rate = (v: 1 | -1) => { update((d) => rateInsight(d, ins.id, v)); setRated(v); toast(v === 1 ? 'Obrigado: vou mostrar mais deste tipo. 💡' : 'Combinado: não volto a mostrar este durante um mês.'); };
  return (
    <section className="card smart-insight">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>💡 O seu padrão de hoje</p>
      <p style={{ margin: '6px 0 4px' }}><span aria-hidden>{ins.icon} </span>{ins.text}</p>
      <p className="small mute" style={{ margin: 0 }}>Calculado só com os seus registos, neste telemóvel. É uma tendência, não uma regra.</p>
      {rated === null ? (
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
          <span className="small mute">Útil?</span>
          <button className="btn ghost sm" onClick={() => rate(1)} aria-label="Útil">👍</button>
          <button className="btn ghost sm" onClick={() => rate(-1)} aria-label="Não é útil">👎</button>
        </div>
      ) : null}
    </section>
  );
}

/** Uma vez por semana: uma função que ainda não experimentou. */
export function DiscoverCard({ go }: { go: Nav }) {
  const { S, update } = useStore();
  const { run, node } = useRunShortcut(go);
  const d = discoverOfWeek(S);
  useEffect(() => { if (d && S.smart?.disc?.id !== d.id) update((x) => markDiscover(x, d.id, false)); }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  return (
    <section className="card smart-disc">
      {node}
      <div className="row"><p className="small gold" style={{ margin: 0, fontWeight: 700 }}>✨ Descobrir esta semana</p><button className="link small inline" onClick={() => update((x) => markDiscover(x, d.id, true))} aria-label="Fechar">✕</button></div>
      <p style={{ margin: '6px 0 2px' }}><b>{d.icon} {d.title}</b></p>
      <p className="small mute" style={{ margin: 0 }}>{d.text}</p>
      <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { update((x) => markDiscover(x, d.id, true)); run(d.go); }}>Experimentar</button>
    </section>
  );
}

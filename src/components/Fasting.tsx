import { useEffect, useState } from 'react';
import { targetsFor } from '../domain/body';
import { todayKey } from '../domain/dates';
import {
  PROTOCOLS, canActivate, endFast, fastState, fastSummary, fastingSafety, isDaily, lowDayToday, mealPlan, protocolOf, proteinPerMeal, setFastStart, startFast, windowOn,
  type FastProtocol, type FastingSettings,
} from '../domain/fasting';
import { useStore } from '../state/store';

const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MEAL_NAME = { pa: 'Pequeno-almoço', almoco: 'Almoço', lanche: 'Lanche', jantar: 'Jantar' } as const;
const hm = (h: number) => `${Math.floor(h)} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')} min`;
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Atualiza a cada 30 s (contador do jejum). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(t); }, []);
  return now;
}

/** Anel do jejum: horas feitas sobre a meta. */
function FastRing({ hours, target }: { hours: number; target: number }) {
  const p = Math.min(1, hours / Math.max(1, target)), R = 44, C = 2 * Math.PI * R;
  return (
    <svg className="r" viewBox="0 0 104 104" role="img" aria-label={`${hm(hours)} de ${target} horas`}>
      <circle cx={52} cy={52} r={R} stroke="rgba(255,255,255,.1)" strokeWidth={9} fill="none" />
      <circle cx={52} cy={52} r={R} stroke={p >= 1 ? 'var(--neon)' : '#C9A85C'} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 52 52)" />
      <text x={52} y={52} textAnchor="middle" fill="#eef3f0" fontFamily="Sora" fontWeight={700} fontSize={19}>{Math.floor(hours)}h{String(Math.floor((hours % 1) * 60)).padStart(2, '0')}</text>
      <text x={52} y={69} textAnchor="middle" fill="#97a69f" fontSize={11}>de {target} h</text>
    </svg>
  );
}

/** Configurar (ou alterar) o jejum: protocolo, janela, perguntas de segurança. */
function FastingSetup({ initial, onClose }: { initial?: FastingSettings | null; onClose: () => void }) {
  const { S, update, toast } = useStore();
  const [f, setF] = useState<FastingSettings>(initial ?? { on: true, protocol: '14:10', open: '10:00', since: todayKey(), spirulinaInWindow: true, reminders: true, lowDays: [1, 4] });
  const [weekend, setWeekend] = useState(!!initial?.weekendOpen);
  const safety = fastingSafety(S, f);
  const ok = canActivate(safety) && (f.protocol !== '5:2' || (f.lowDays ?? []).length === 2);
  const daily = f.protocol !== '5:2';
  const w = windowOn({ ...f, weekendOpen: undefined }, new Date());
  const consecutive = f.protocol === '5:2' && (f.lowDays ?? []).length === 2 && [1, 6].includes(Math.abs(f.lowDays![0] - f.lowDays![1]));
  const save = () => {
    const nf: FastingSettings = { ...f, on: true, weekendOpen: weekend && daily ? f.weekendOpen ?? f.open : undefined, since: initial?.since ?? todayKey() };
    update((d) => {
      d.fasting = nf;
      if (!initial) d.fastSessions = [];
      // a toma diária da Spirulina passa para a abertura da janela
      if (daily && nf.spirulinaInWindow) {
        const r = d.reminder;
        const win = windowOn(nf, new Date());
        if (r && (r < win.openText || r >= win.closeText)) d.reminder = win.openText;
      }
    });
    toast(initial ? 'Jejum atualizado.' : `Jejum ${nf.protocol} ativado. 🌙`);
    onClose();
  };
  return (
    <div className="fast-setup">
      <h3 style={{ margin: '0 0 6px' }}>Protocolo</h3>
      <div className="chips" role="group" aria-label="Protocolo">
        {PROTOCOLS.map((p) => (
          <button key={p.id} className={`chip sm ${f.protocol === p.id ? 'on' : ''}`} aria-pressed={f.protocol === p.id} onClick={() => setF({ ...f, protocol: p.id as FastProtocol })}>{p.label}</button>
        ))}
      </div>
      <p className="small mute" style={{ margin: '6px 0 0' }}>{protocolOf(f.protocol).note}</p>

      {daily ? (
        <>
          <h3 style={{ margin: '14px 0 6px' }}>Janela de alimentação</h3>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <label className="hin" style={{ width: 130 }}>
              <span>Abre às</span>
              <input type="time" value={f.open} onChange={(e) => e.target.value && setF({ ...f, open: e.target.value })} aria-label="A janela abre às" />
            </label>
            <p className="small" style={{ margin: 0 }}>e fecha às <b>{w.closeText}</b><br /><span className="mute">{24 - protocolOf(f.protocol).fast} horas para comer</span></p>
          </div>
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} />
            <span className="small">Ao fim de semana a janela abre a outra hora</span>
          </label>
          {weekend && (
            <label className="hin" style={{ width: 130, marginTop: 6 }}>
              <span>Sáb. e dom. às</span>
              <input type="time" value={f.weekendOpen ?? f.open} onChange={(e) => e.target.value && setF({ ...f, weekendOpen: e.target.value })} aria-label="Ao fim de semana abre às" />
            </label>
          )}
        </>
      ) : (
        <>
          <h3 style={{ margin: '14px 0 6px' }}>Os 2 dias de poucas calorias</h3>
          <div className="chips" role="group" aria-label="Dias de poucas calorias">
            {WD_SHORT.map((d, i) => {
              const on = (f.lowDays ?? []).includes(i);
              return <button key={d} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, lowDays: on ? (f.lowDays ?? []).filter((x) => x !== i) : [...(f.lowDays ?? []), i].slice(-2) })}>{d}</button>;
            })}
          </div>
          <p className="small mute" style={{ margin: '6px 0 0' }}>Nesses dias: cerca de {S.ans?.sexo === 'm' ? 600 : 500} kcal, com proteína e legumes. {consecutive && <span className="warn-t">Melhor que não sejam seguidos.</span>}</p>
        </>
      )}

      <h3 style={{ margin: '14px 0 6px' }}>Antes de começar</h3>
      <label className="check"><input type="checkbox" checked={!!f.diabetesMeds} onChange={(e) => setF({ ...f, diabetesMeds: e.target.checked })} /><span className="small">Tomo insulina ou medicamentos para baixar o açúcar no sangue</span></label>
      <label className="check"><input type="checkbox" checked={!!f.eatingDisorder} onChange={(e) => setF({ ...f, eatingDisorder: e.target.checked })} /><span className="small">Já tive um distúrbio alimentar (anorexia, bulimia, compulsão alimentar)</span></label>
      {safety.block.map((t) => <p key={t} className="small warn-t" style={{ margin: '8px 0 0' }}>⛔ {t}</p>)}
      {!safety.block.length && (safety.needsPro.length > 0 || f.supervised) && (
        <>
          {safety.needsPro.map((t) => <p key={t} className="small warn-t" style={{ margin: '8px 0 0' }}>⚠️ {t}</p>)}
          <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={!!f.supervised} onChange={(e) => setF({ ...f, supervised: e.target.checked })} /><span className="small">O meu médico ou nutricionista acompanha este jejum</span></label>
        </>
      )}
      {!safety.block.length && safety.warn.map((t) => <p key={t} className="small mute" style={{ margin: '6px 0 0' }}>• {t}</p>)}

      {daily && <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={f.spirulinaInWindow !== false} onChange={(e) => setF({ ...f, spirulinaInWindow: e.target.checked })} /><span className="small">Tomar a Spirulina na primeira refeição da janela</span></label>}
      {daily && <label className="check"><input type="checkbox" checked={f.reminders !== false} onChange={(e) => setF({ ...f, reminders: e.target.checked })} /><span className="small">Avisar quando a janela abre e 30 min antes de fechar{!S.notifications ? ' (ligue as notificações no Perfil)' : ''}</span></label>}

      <p className="small mute" style={{ margin: '10px 0 0' }}>
        Durante o jejum pode beber água, chá e café sem açúcar. Para perder peso, o jejum intermitente funciona tão bem como reduzir um pouco as calorias todos os dias: ajuda sobretudo porque facilita comer menos. Se sentir tonturas, fraqueza ou mal-estar, coma e fale com um profissional.
      </p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost sm" onClick={onClose}>Cancelar</button>
        <button className="btn sm" disabled={!ok} onClick={save}>{initial ? 'Guardar' : 'Ativar jejum'}</button>
      </div>
    </div>
  );
}

/** Jejum intermitente na Nutrição: configurar, contador, refeições da janela e 5:2. */
export function FastingCard() {
  const { S, update, toast } = useStore();
  const now = useNow();
  const [setup, setSetup] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const f = S.fasting;
  const rx = S.fastingRx;

  if (setup) return <section className="card"><h2 style={{ marginTop: 0 }}>🌙 Jejum intermitente</h2><FastingSetup initial={f?.on ? f : null} onClose={() => setSetup(false)} /></section>;

  if (!f?.on) {
    if (rx)
      return (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>🌙 Jejum prescrito por {rx.by}</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Protocolo <b>{rx.protocol}</b>{rx.protocol === '5:2' ? ` · dias de poucas calorias: ${(rx.lowDays ?? []).map((d) => WD[d]).join(' e ')}` : ` · janela das ${rx.open} às ${windowOn({ on: true, protocol: rx.protocol, open: rx.open, since: '' }, now).closeText}`}.
          </p>
          {rx.notes && <p className="small" style={{ marginTop: 0 }}>“{rx.notes}”</p>}
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button className="btn sm" onClick={() => {
              update((d) => { d.fasting = { on: true, protocol: rx.protocol, open: rx.open, lowDays: rx.lowDays, by: rx.by, supervised: true, spirulinaInWindow: true, reminders: true, since: todayKey() }; d.fastSessions = []; d.fastingRx = null; });
              toast(`Jejum ${rx.protocol} ativado, como indicado por ${rx.by}.`);
            }}>Ativar</button>
            <button className="btn ghost sm" onClick={() => update((d) => { d.fastingRx = null; })}>Agora não</button>
          </div>
        </section>
      );
    return (
      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>🌙 Faz jejum intermitente?</h2></div>
        <p className="small mute" style={{ margin: '6px 0 10px' }}>Escolha o protocolo (12:12, 14:10, 16:8, 18:6 ou 5:2) e a sua janela de alimentação. A app conta as horas, organiza as refeições e a Spirulina dentro da janela e avisa quando abre e fecha.</p>
        <button className="btn ghost sm" onClick={() => setSetup(true)}>Configurar o jejum</button>
      </section>
    );
  }

  // 5:2
  if (f.protocol === '5:2') {
    const low = lowDayToday(S, now);
    const next = [1, 2, 3, 4, 5, 6, 7].map((i) => (now.getDay() + i) % 7).find((d) => (f.lowDays ?? []).includes(d));
    return (
      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>🌙 Jejum 5:2</h2><button className="link small inline" onClick={() => setSetup(true)}>Alterar</button></div>
        {low ? (
          <>
            <p style={{ margin: '8px 0 2px', font: '600 20px Sora' }}>Hoje é dia de {low} kcal</p>
            <p className="small mute" style={{ margin: 0 }}>Prefira proteína magra, ovos, legumes e sopa; beba bem ao longo do dia. A meta do diário de hoje já está ajustada.</p>
          </>
        ) : (
          <p className="small" style={{ margin: '8px 0 0' }}>Hoje come normalmente. Próximo dia de poucas calorias: <b>{next !== undefined ? WD[next] : '—'}</b>.</p>
        )}
        {f.by && <p className="small mute" style={{ margin: '6px 0 0' }}>Indicado por {f.by}.</p>}
        <button className="link small inline" style={{ marginTop: 8 }} onClick={() => { if (confirm('Desligar o jejum intermitente?')) update((d) => { d.fasting = { ...d.fasting!, on: false }; }); }}>Desligar o jejum</button>
      </section>
    );
  }

  // janela diária
  const st = fastState(f, S.fastSessions ?? [], now);
  const w = windowOn(f, now);
  const meals = mealPlan(f, now);
  const tg = targetsFor(S);
  const pp = proteinPerMeal(tg.protein, meals.length);
  return (
    <section className="card fast-card">
      <div className="row"><h2 style={{ margin: 0 }}>🌙 Jejum {f.protocol}</h2><button className="link small inline" onClick={() => setSetup(true)}>Alterar</button></div>
      {st.kind === 'jejum' ? (
        <div className="health" style={{ marginTop: 10 }}>
          <FastRing hours={st.hours} target={st.target} />
          <div>
            <p style={{ margin: 0, font: '600 20px Sora' }}>{st.reached ? 'Meta cumprida ✓' : `Em jejum há ${hm(st.hours)}`}</p>
            <p className="small" style={{ margin: '2px 0 0' }}>{st.reached ? `${hm(st.hours)} de jejum. Pode comer quando quiser.` : `Meta de ${st.target} h às ${clock(st.endsAt)}`}</p>
            <p className="small mute" style={{ margin: '2px 0 0' }}>Começou às {clock(st.since)} · a janela abre às {w.openText}</p>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: 0, font: '600 20px Sora' }}>Janela aberta até às {st.closeText}</p>
          {st.lastFast && <p className="small" style={{ margin: '2px 0 0' }}>{st.lastFast.reached ? `Último jejum: ${hm(st.lastFast.hours)} ✓` : `Último jejum: ${hm(st.lastFast.hours)} — terminou mais cedo, e está tudo bem. O que conta é a semana.`}</p>}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {st.kind === 'jejum' ? (
          <>
            <button className="btn ghost sm" onClick={() => {
              update((d) => { if (!(d.fastSessions ?? []).some((s) => !s.end)) startFast(d, st.since); endFast(d); });
              toast(st.reached ? `Jejum de ${hm(st.hours)} ✓` : `Jejum terminado (${hm(st.hours)}).`);
            }}>Terminar o jejum</button>
            <button className="btn ghost sm" onClick={() => setAdjust(!adjust)}>Ajustar o início</button>
          </>
        ) : (
          <button className="btn ghost sm" onClick={() => { update((d) => startFast(d)); toast('Jejum começado. 🌙'); }}>Comecei o jejum agora</button>
        )}
      </div>
      {adjust && st.kind === 'jejum' && (
        <label className="hin" style={{ width: 170, marginTop: 8 }}>
          <span>Comecei às</span>
          <input type="time" defaultValue={clock(st.since)} onChange={(e) => {
            const [h, m] = e.target.value.split(':').map(Number);
            if (Number.isNaN(h)) return;
            const d = new Date(now); d.setHours(h, m, 0, 0);
            if (d > now) d.setDate(d.getDate() - 1);
            update((x) => { if (!(x.fastSessions ?? []).some((s) => !s.end)) startFast(x, d); else setFastStart(x, d); });
          }} aria-label="Hora a que começou o jejum" />
        </label>
      )}
      <div className="fast-meals">
        <p className="small" style={{ margin: 0 }}><b>Refeições na janela</b> ({w.openText}–{w.closeText}): {meals.map((m) => `${MEAL_NAME[m.key]} ${m.time}`).join(' · ')}</p>
        <p className="small" style={{ margin: '4px 0 0' }}>Proteína: cerca de <b>{pp.per} g por refeição</b> para chegar aos {tg.protein} g do dia.{pp.hard ? ' Com tão poucas refeições é difícil: inclua ovos, iogurte grego, peixe ou leguminosas em todas.' : ''}</p>
        {f.spirulinaInWindow !== false && <p className="small" style={{ margin: '4px 0 0' }}>🌿 Spirulina na primeira refeição ({w.openText}).</p>}
        <p className="small mute" style={{ margin: '4px 0 0' }}>No jejum: água, chá e café sem açúcar. Se treina em jejum, faça a refeição a seguir ao treino com proteína.</p>
      </div>
      {f.by && <p className="small mute" style={{ margin: '6px 0 0' }}>Indicado por {f.by}.</p>}
      <button className="link small inline" style={{ marginTop: 8 }} onClick={() => { if (confirm('Desligar o jejum intermitente?')) update((d) => { d.fasting = { ...d.fasting!, on: false }; d.fastSessions = (d.fastSessions ?? []).filter((s) => s.end); }); }}>Desligar o jejum</button>
    </section>
  );
}

/** Linha curta no Início. */
export function FastingMini({ onOpen }: { onOpen: () => void }) {
  const { S } = useStore();
  const now = useNow();
  const f = S.fasting;
  if (!f?.on) return null;
  let text: string;
  if (f.protocol === '5:2') {
    const low = lowDayToday(S, now);
    if (!low) return null;
    text = `Hoje é dia de ${low} kcal (jejum 5:2)`;
  } else {
    const st = fastState(f, S.fastSessions ?? [], now);
    text = st.kind === 'jejum' ? (st.reached ? `Jejum cumprido: ${hm(st.hours)} ✓` : `Em jejum há ${hm(st.hours)} · meta às ${clock(st.endsAt)}`) : `Janela aberta até às ${st.closeText}`;
  }
  return (
    <button className="status-strip fast-mini" onClick={onOpen} aria-label="Abrir o jejum na Nutrição">
      <span>🌙 {text}</span><span className="small mute">›</span>
    </button>
  );
}

/** Evolução: jejuns dos últimos 7 dias e o que mudou na energia e na fome. */
export function FastingEvolution() {
  const { S } = useStore();
  if (!isDaily(S.fasting)) return null;
  const sm = fastSummary(S, 7);
  const target = protocolOf(S.fasting!.protocol).fast;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); const k = todayKey(d); return { k, wd: WD_SHORT[d.getDay()], x: sm.days.find((y) => y.date === k) }; });
  const max = Math.max(target * 1.25, ...sm.days.map((d) => d.hours));
  return (
    <section className="card">
      <div className="row"><h2 style={{ margin: 0 }}>🌙 Jejum intermitente</h2><span className="small mute">últimos 7 dias</span></div>
      <p className="small" style={{ margin: '6px 0 10px' }}><b>{sm.reached}</b> de 7 dias com a meta de {target} h · média <b>{String(sm.avg).replace('.', ',')} h</b> · {sm.total} h no total</p>
      <div className="fast-bars" role="img" aria-label={`Horas de jejum nos últimos 7 dias: ${days.map((d) => `${d.wd} ${d.x?.hours ?? 0}`).join(', ')}`}>
        <i className="goal" style={{ bottom: `calc(18px + (100% - 18px) * ${(target / max).toFixed(3)})` }} />
        {days.map((d) => (
          <div key={d.k}>
            <span className={d.x?.reached ? 'ok' : ''} style={{ height: `${((d.x?.hours ?? 0) / max) * 100}%` }} />
            <small>{d.wd}</small>
          </div>
        ))}
      </div>
      {sm.cmp && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          Nos dias com a meta cumprida: energia {sm.cmp.energyYes ?? '—'}/5{sm.cmp.hungerYes !== null ? `, fome ${sm.cmp.hungerYes}/5` : ''} · nos outros: energia {sm.cmp.energyNo ?? '—'}/5{sm.cmp.hungerNo !== null ? `, fome ${sm.cmp.hungerNo}/5` : ''}.
          <span className="mute"> É uma observação sobre si, não uma prova.</span>
        </p>
      )}
    </section>
  );
}

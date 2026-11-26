import type { ReactNode } from 'react';
import { FirstStepsCard } from '../components/FirstSteps';
import { FastingMini } from '../components/Fasting';
import { MonthCelebration, showMonth } from '../components/MonthCelebration';
import { DayPanel, EnergyWeek, NextActionCard, TodayCarousel } from '../components/HomePanel';
import { DiscoverCard, InsightCard, SmartShortcuts } from '../components/SmartHome';
import { CARD_LABEL, collapsedCards, noteCard, type HomeCardId } from '../domain/smart';
import { testDays } from '../testDate';
import { homeVisibility } from '../domain/firstWeek';
import { QUIZ } from '../domain/onboarding';
import { Bar, Glass, Ring } from '../components/Charts';
import { Icon } from '../components/Icon';
import { GLASS_ML, HABITS, PROS, SHOP_URL, STEP_GOAL, whatsappLink } from '../domain/content';
import { daysSince, fmtNum, greeting, longToday, todayKey } from '../domain/dates';
import { planFor } from '../domain/plan';
import { habitOn, reorderText, stock } from '../domain/stats';
import { useStore } from '../state/store';
import { stockText } from '../domain/lots';
import { DataCard } from '../components/DataCard';
import { syncedLabel, useAuth } from '../domain/account';
import { SpirulinaCheck } from '../components/SpirulinaCheck';
import { HealthShotButton } from '../components/HealthShot';
import { SourceTag } from '../components/SourceTag';
import { setSource } from '../domain/sources';
import { dayScore } from '../domain/points';
import { LEAGUES, unreadCount, useSocial } from '../domain/social';
import type { Nav } from '../App';

const litres = (glasses: number) => fmtNum(((glasses * GLASS_ML) / 1000).toFixed(2).replace(/0$/, ''));

export function SampleBanner({ onReset }: { onReset: () => void }) {
  const { S } = useStore();
  if (!S.sample) return null;
  return (
    <div className="banner">
      <span>Está a ver uma demonstração com dados de exemplo.</span>
      <button className="btn sm" onClick={onReset}>Começar</button>
    </div>
  );
}

export function ActivityCard({ openHealth }: { openHealth: () => void }) {
  const { S, todayLog: l, updateToday } = useStore();
  const steps = l.steps ?? 0;
  const p = Math.min(1, steps / STEP_GOAL);
  const setSteps = (raw: string) => {
    const v = raw.trim() === '' ? undefined : Number(raw.replace(/\D/g, ''));
    updateToday((d) => {
      if (v === undefined || Number.isNaN(v)) delete d.steps;
      else d.steps = Math.max(0, Math.min(100000, Math.round(v)));
      setSource(d, 'steps', null);
    });
  };
  return (
    <section className="card" data-tour="passos">
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Passos de hoje</h2>
        <span className="small mute">meta {STEP_GOAL.toLocaleString('pt-PT')}</span>
      </div>
      <div className="health">
        <Ring value={steps} goal={STEP_GOAL} label="passos" />
        <div className="hm">
          <label className="hin">
            <span>Passos</span>
            <input inputMode="numeric" placeholder="ex.: 7500" value={l.steps ?? ''} onChange={(e) => setSteps(e.target.value)} aria-label="Passos de hoje" />
          </label>
          <div><b>{Math.round(p * 100)}%</b><span>da meta</span></div>
          <div><b>{fmtNum(Math.round(steps * 0.0007 * 10) / 10)} km</b><span>aprox.</span></div>
        </div>
      </div>
      {l.steps !== undefined && <p style={{ margin: '10px 0 0' }}><SourceTag l={l} f="steps" /></p>}
      {S.health2 ? (
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          Ligado ao app Saúde · últimos dados {syncedLabel(S.health2.lastAt)}.{' '}
          <button className="link small inline" onClick={openHealth}>gerir</button>
        </p>
      ) : (
        <>
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={openHealth}><Icon name="steps" /> Ligar ao app Saúde e Apple Watch</button>
          <HealthShotButton compact />
          <p className="small mute" style={{ margin: '8px 0 0' }}>Ou escreva os passos aqui. As horas de sono registam-se no check-in.</p>
        </>
      )}
    </section>
  );
}

/** Faixa no topo: sequência, pontos de hoje e liga (abre a Comunidade). */
function StatusStrip({ go }: { go: Nav }) {
  const { S } = useStore();
  const auth = useAuth();
  const joined = !!auth && !!S.community;
  const { state: st } = useSocial(joined ? 120_000 : Infinity);
  const pts = st?.verify ? st.verify.points : dayScore(S, todayKey()).points;
  const me = st?.league?.find((m) => m.me);
  const unread = unreadCount(st);
  return (
    <button className="status-strip" data-tour="strip" onClick={() => go('social')} aria-label="Abrir a Comunidade">
      <span><b>⭐ {pts}</b><small>pontos hoje</small></span>
      {joined ? (
        <span><b>🏆 {me ? `${me.rank}.º` : '—'}</b><small>liga {LEAGUES[st?.me?.league ?? 0]}</small></span>
      ) : (
        <span><b>🏆</b><small>entrar na liga</small></span>
      )}
      {unread > 0 && <i className="badge-new">{unread}</i>}
    </button>
  );
}

/** Cartão opcional do Início: conta como usado quando a pessoa lhe toca; se estiver recolhido, não aparece. */
function Adaptive({ id, hidden, children }: { id: HomeCardId; hidden: Set<HomeCardId>; children: ReactNode }) {
  const { S, update } = useStore();
  if (hidden.has(id)) return null;
  return <div onClickCapture={() => { if (S.smart?.seen?.[id] !== todayKey()) update((d) => noteCard(d, id)); }}>{children}</div>;
}

/** "Mais": os cartões recolhidos, para voltar a abrir, e a opção de ver sempre tudo. */
function MoreCards({ hidden }: { hidden: Set<HomeCardId> }) {
  const { update } = useStore();
  if (!hidden.size) return null;
  return (
    <section className="card">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Mais</p>
      <p className="small mute" style={{ margin: '4px 0 8px' }}>Recolhi o que não abre há duas semanas, para o Início ficar mais simples.</p>
      <div className="chips">{[...hidden].map((id) => <button key={id} className="chip sm" onClick={() => update((d) => noteCard(d, id))}>+ {CARD_LABEL[id]}</button>)}</div>
      <button className="link small inline" style={{ marginTop: 8 }} onClick={() => update((d) => { d.smart = { ...(d.smart ?? {}), all: true }; })}>Mostrar sempre tudo</button>
    </section>
  );
}

/** Acompanhamento por profissionais de saúde parceiros. */
export function ProsCard({ go }: { go: Nav }) {
  const { S } = useStore();
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Acompanhamento profissional</h2>
      <p className="small mute" style={{ marginTop: 0 }}>
        Nutricionistas, médicos, profissionais de exercício e psicólogos parceiros da NEFESH ajustam o plano ao seu caso.
      </p>
      <div className="pro-avs">
        {PROS.map((p) => (
          <span key={p.i} title={p.n}><i>{p.i}</i>{({ NU: 'Nutricionista', MI: 'Médico', PE: 'Exercício', PS: 'Psicólogo' } as Record<string, string>)[p.i] ?? p.n}</span>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 12 }}>
        <a className="btn sm" href={whatsappLink(`Olá NEFESH! Gostava de ter acompanhamento profissional${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)} target="_blank" rel="noopener">Pedir acompanhamento</a>
        <button className="btn ghost sm" onClick={() => go('pros')}>Ver profissionais</button>
        <button className="btn ghost sm" onClick={() => go('cuidados')}>{S.nutriLink || S.wellLink || S.proLink ? 'Os meus profissionais' : 'Tenho um código'}</button>
      </div>
    </section>
  );
}

/** Hidratação: copos de hoje (também em Nutrição). */
export function WaterCard() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const goalW = planFor(S).water;
  const w = l.water || 0;
  const setWater = (n: number) => {
    updateToday((t) => { t.water = Math.max(0, n); });
    if (n === goalW && w < goalW) toast('Meta de água cumprida.');
  };
  return (
    <section className="card" data-tour="agua">
        <div className="row">
          <h2 style={{ margin: 0 }}>Hidratação</h2>
          <span className="small mute">{litres(w)} de {litres(goalW)} L</span>
        </div>
        <div className="water-row">
          <Glass on={w > 0} />
          <div style={{ flex: 1 }}>
            <Bar pct={(w / goalW) * 100} variant="water" />
            <p className="small mute" style={{ margin: '4px 0 0' }}>
              {w} de {goalW} copos · {w >= goalW ? 'meta cumprida hoje' : `faltam ${goalW - w}`}
            </p>
          </div>
        </div>
        <div className="row">
          <p className="small mute" style={{ margin: 0 }}>Copos de 250 ml · meta de 35 ml por kg.</p>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn ghost sm" onClick={() => setWater(w - 1)} aria-label="Retirar um copo">−</button>
            <button className="btn sm" onClick={() => setWater(w + 1)}>+ 1 copo</button>
          </div>
        </div>
      </section>
  );
}

/** Hábitos de hoje (também em Mente). */
export function HabitsCard() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  return (
      <section className="card">
        <h2>Hábitos de hoje</h2>
        <div className="habits">
          {HABITS.map(([k, t, icon]) => {
            const on = habitOn(S, l, k);
            return (
              <button
                key={k}
                className={`habit ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => {
                  if (k === 'sono' && l.sleepH !== undefined) return toast('Este hábito marca-se pelas horas de sono do check-in.');
                  updateToday((d) => { d.hab = { ...d.hab, [k]: !d.hab?.[k] }; });
                }}
              >
                <Icon name={icon} />
                {t}
              </button>
            );
          })}
        </div>
      </section>
  );
}

export function Home({ go, startQuiz, onReset, openBottle, openLogin, openHealth, openSignup, openScience }: { go: Nav; startQuiz: () => void; onReset: () => void; openBottle: () => void; openLogin: () => void; openHealth: () => void; openSignup?: () => void; openScience?: () => void }) {
  const { S } = useStore();

  if (!S.ans)
    return (
      <>
        <SampleBanner onReset={onReset} />
        <section className="card hero">
          <h1>Descubra o seu Índice NEFESH e a sua dose ideal</h1>
          <p>{QUIZ.length} perguntas, cerca de 1 minuto. No fim recebe a sua pontuação de bem-estar e um plano de Spirulina feito para si.</p>
          <button className="btn" onClick={startQuiz}>Começar a avaliação</button>
        </section>
        <section className="card">
          <h2>Já usava a NEFESH Life?</h2>
          <p className="small mute">Entre na sua conta para trazer o seu plano. Se guardou uma cópia em ficheiro, recupere-a em "Os meus dados", aqui em baixo.</p>
          <button className="btn ghost sm" onClick={openLogin}>Entrar na minha conta</button>
        </section>
        <section className="card">
          <h2>{S.nutriLink || S.wellLink || S.proLink ? 'Os meus profissionais' : 'Recebeu um código de um profissional?'}</h2>
          <p className="small mute">{S.nutriLink || S.wellLink || S.proLink ? 'Conversa, plano e partilha dos seus dados com quem o acompanha.' : 'Se o seu médico, nutricionista, terapeuta ou personal o acompanha pela NEFESH, use aqui o código que ele lhe enviou (NP-XXXX-XXXX).'}</p>
          <button className="btn ghost sm" onClick={() => go('cuidados')}>{S.nutriLink || S.wellLink || S.proLink ? 'Abrir' : 'Tenho um código'}</button>
        </section>
        <DataCard />
      </>
    );

  const c = planFor(S);
  const st = stock(S);
  const day = S.planStart ? daysSince(S.planStart) + 1 : 1;
  const low = S.stockCaps > 0 && st.days <= 7;
  const vis = homeVisibility(S);
  const hide = collapsedCards(S);

  return (
    <>
      <SampleBanner onReset={onReset} />
      {testDays() > 0 && <p className="small warn" style={{ margin: '0 0 6px' }}>🧪 Modo de teste: a data está avançada {testDays()} {testDays() === 1 ? 'dia' : 'dias'} (Perfil → Voltar a hoje).</p>}
      <p className="mute small" style={{ margin: 0 }}>{longToday()} · dia {day} do ritual</p>
      <h1>{greeting()}{S.ans.name ? `, ${S.ans.name}` : ''}</h1>

      {showMonth(S) && <MonthCelebration />}
      <FirstStepsCard go={go} />
      <DayPanel go={go} />
      <NextActionCard go={go} />
      <SmartShortcuts go={go} />
      <InsightCard />
      <DiscoverCard go={go} />
      {low && (
        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>Reposição</h2>
            <span className="mute small">{c.format === 'caps' ? st.left : fmtNum(st.left / 2)} de {stockText(S.stockCaps, c.format)}</span>
          </div>
          <Bar pct={st.pct} variant="low" />
          <p className="small">{st.days ? `A sua Spirulina acaba em ${st.days} ${st.days === 1 ? 'dia' : 'dias'}${st.rate < 1 ? `, ao seu ritmo (toma em ${Math.round(st.rate * 100)}% dos dias)` : ''}.` : 'A sua Spirulina acabou.'} Encomende já para o ritual não parar: a entrega demora alguns dias.</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <a className="btn sm" href={whatsappLink(reorderText(S))} target="_blank" rel="noopener">Encomendar pelo WhatsApp</a>
            <a className="btn ghost sm" href={SHOP_URL} target="_blank" rel="noopener">Loja online</a>
            <button className="btn ghost sm" onClick={openBottle}><Icon name="qr" /> Chegou o frasco novo</button>
          </div>
        </section>
      )}
      <FastingMini onOpen={() => go('nutri')} />
      <TodayCarousel go={go} openScience={openScience} startQuiz={startQuiz} openSignup={openSignup} />
      <SpirulinaCheck />

      {/* cartões opcionais: os que não usa há 14 dias recolhem-se em "Mais" (Início adaptativo) */}
      <Adaptive id="energia" hidden={hide}><EnergyWeek go={go} /></Adaptive>
      {vis.show.has('comunidade') && <Adaptive id="comunidade" hidden={hide}><StatusStrip go={go} /></Adaptive>}
      {vis.show.has('passos') && <Adaptive id="passos" hidden={hide}><ActivityCard openHealth={openHealth} /></Adaptive>}
      {vis.show.has('habitos') && <Adaptive id="habitos" hidden={hide}><HabitsCard /></Adaptive>}
      {vis.show.has('pros') && <Adaptive id="pros" hidden={hide}><ProsCard go={go} /></Adaptive>}
      <MoreCards hidden={hide} />
    </>
  );
}


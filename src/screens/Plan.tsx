import { Bar, Radar } from '../components/Charts';
import { DoseSteps, LevelTag, StudyCard } from '../components/Science';
import { ADVICE, AREAS, CAPSULE_MG, EXPECT } from '../domain/content';
import { GOAL_EVIDENCE, LEVELS, SAFETY_REASONS, studiesFor } from '../domain/science';
import { daysSince, fmtNum } from '../domain/dates';
import { calcPlan, indexOf, scores, splitDose } from '../domain/plan';
import type { Answers } from '../domain/types';
import { useStore } from '../state/store';
import type { Nav } from '../App';

interface Props {
  answers: Answers | null;
  isNew?: boolean;
  go: Nav;
  onAdopt?: () => void;
  onCancel?: () => void;
  onReassess: () => void;
  openScience: () => void;
}

export function Plan({ answers: a, isNew, go, onAdopt, onCancel, onReassess, openScience }: Props) {
  const { S } = useStore();
  if (!a)
    return (
      <section className="card hero">
        <h1>Ainda não fez a sua avaliação</h1>
        <button className="btn" onClick={onReassess}>Começar</button>
      </section>
    );

  const c = calcPlan(a);
  const sc = scores(a);
  const ix = indexOf(sc);
  const prevEv = isNew ? S.evals[S.evals.length - 1] : S.evals[S.evals.length - 2];
  const prev = prevEv && (!S.sample || !isNew) ? prevEv.sc : null;
  const delta = prev ? ix - indexOf(prev) : null;
  const weak = AREAS.slice().sort((x, y) => sc[x[0]] - sc[y[0]])[0];
  const goal = a.goal ?? 'energia';
  const ev = GOAL_EVIDENCE[goal];

  const foot = isNew ? (
    <>
      <button className="btn full" onClick={onAdopt}>{S.ans && !S.sample ? 'Guardar a reavaliação' : 'Começar o meu ritual'}</button>
      <p />
      <button className="btn ghost full" onClick={onCancel}>Cancelar</button>
    </>
  ) : (
    <button className="btn ghost full" onClick={onReassess}>Fazer reavaliação</button>
  );

  const head = (
    <>
      <p className="mute small" style={{ margin: 0 }}>{isNew ? 'O seu resultado' : 'O seu plano'}{a.name ? ` · ${a.name}` : ''}</p>
      <section className="card hero" style={{ marginTop: 10 }}>
        <div className="idx">
          <p className="small" style={{ margin: 0, opacity: 0.8 }}>Índice NEFESH de bem-estar</p>
          <div className="n">{ix}<small>/100</small></div>
          {delta !== null && (
            <p className="small" style={{ margin: 0 }}>
              <b className="neon">{delta >= 0 ? '+' : ''}{delta}</b> desde a última avaliação
            </p>
          )}
        </div>
        <Radar sc={sc} prev={prev} />
        {prev && <p className="small" style={{ textAlign: 'center', margin: 0, opacity: 0.8 }}><span className="gold">- - -</span> avaliação anterior</p>}
        <div className="areas">
          {AREAS.map(([k, t]) => (
            <div className="area" key={k}><span>{t}</span><Bar pct={sc[k]} /><b>{sc[k]}</b></div>
          ))}
        </div>
      </section>
      <section className="card">
        <h3>A sua maior oportunidade: {weak[1]}</h3>
        <p className="small mute" style={{ margin: 0 }}>{ADVICE[weak[0]]}</p>
      </section>
    </>
  );

  if (c.flags.length)
    return (
      <>
        {head}
        <section className="card warn">
          <h2>Antes de começar a Spirulina, fale com um profissional</h2>
          <p style={{ margin: 0 }}>
            Na sua situação, a Spirulina pode não ser indicada ou precisar de acompanhamento. A dose deve ser definida por um profissional de saúde.
          </p>
          <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            {c.flags.map((f) => <li key={f} style={{ marginBottom: 4 }}>{SAFETY_REASONS[f]}</li>)}
          </ul>
        </section>
        <button className="btn full" onClick={() => go('pros')}>Ver profissionais NEFESH</button>
        <p />
        {foot}
      </>
    );

  const day = !isNew && S.planStart ? daysSince(S.planStart) + 1 : 1;
  const cur = c.start && day <= 7 ? 0 : day < 30 ? 1 : day <= 31 ? 2 : 3;
  const split = splitDose(c.caps, goal);

  return (
    <>
      {head}
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>A sua dose de Spirulina</p>
        <div className="dose" style={{ marginTop: 6 }}>{fmtNum(c.g)} g <small>/ dia</small></div>
        <p style={{ margin: '10px 0 0' }}>
          = <b>{c.caps} cápsulas</b> de Pure Spirulina ({CAPSULE_MG} mg)
          <br />
          <span className="small" style={{ opacity: 0.8 }}>ou {fmtNum(c.g)} g de Spirulina em palhinha (Nibs)</span>
        </p>
        <p className="small" style={{ margin: '10px 0 0' }}>
          {c.when}
          {split.length > 1 ? ` · ${split.map((s) => s.n).join(' + ')} cápsulas` : ''}
        </p>
      </section>

      <section className="card">
        <h2>Como calculamos a sua dose</h2>
        <p className="small mute">Cada passo indica se vem de um <b>estudo</b> ou de um <b>critério NEFESH</b>, para saber sempre o que é ciência e o que é uma escolha nossa.</p>
        <DoseSteps steps={c.why} total={`${fmtNum(c.g)} g · ${c.caps} cápsulas`} gPerKg={fmtNum(c.gPerKg.toFixed(3))} />
      </section>

      <section className="card">
        <h2>As suas primeiras semanas</h2>
        <ul className="tl">
          {c.start && (
            <li className={cur === 0 ? 'now' : ''}>
              <h3>Semana 1 · adaptação</h3>
              <p className="small mute" style={{ margin: 0 }}>{Math.ceil(c.caps / 2)} cápsulas por dia, para o corpo se habituar.</p>
            </li>
          )}
          <li className={cur === 1 ? 'now' : ''}>
            <h3>{c.start ? 'Semanas 2 a 4' : 'Semanas 1 a 4'} · dose completa</h3>
            <p className="small mute" style={{ margin: 0 }}>{c.caps} cápsulas por dia e check-in diário.</p>
          </li>
          <li className={cur === 2 ? 'now' : ''}>
            <h3>Dia 30 · reavaliação</h3>
            <p className="small mute" style={{ margin: 0 }}>Repete esta avaliação e compara o seu Índice.</p>
          </li>
          <li className={cur === 3 ? 'now' : ''}>
            <h3>Dias 30 a 90 · consolidação</h3>
            <p className="small mute" style={{ margin: 0 }}>Os estudos medem mudanças após 4 a 12 semanas de uso diário.</p>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>O que esperar</h2>
        <p className="small">{EXPECT[goal]}</p>
        <p className="small mute" style={{ margin: 0 }}>A regularidade conta mais do que a quantidade: o app ajuda-o a não falhar.</p>
      </section>

      <section className="card">
        <h2>A ciência por trás do seu plano</h2>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 8 }}>
          <span className="small mute">Força da evidência:</span>
          <LevelTag level={ev.level} />
        </div>
        <p className="small">{ev.text}</p>
        <p className="small mute">{LEVELS[ev.level].text}</p>
        {studiesFor(goal).map((st) => <StudyCard key={st.id} s={st} />)}
        <button className="btn ghost full" onClick={openScience}>Ver a biblioteca científica completa</button>
      </section>

      <section className="card">
        <h2>Segurança e tolerância</h2>
        <ul className="list small">
          <li><span className="neon">•</span><span>Os efeitos adversos relatados são raros e sobretudo digestivos (náusea, inchaço). A semana de adaptação existe para os reduzir.</span></li>
          <li><span className="neon">•</span><span>A segurança depende da pureza, ou seja, da ausência de microcistinas e metais pesados. Leia o QR code do frasco para ver as análises do seu lote.</span></li>
          <li><span className="neon">•</span><span>A Spirulina não é fonte fiável de vitamina B12. Em alimentação vegana mantenha o suplemento de B12.</span></li>
          <li><span className="neon">•</span><span>Se tiver uma doença crónica ou tomar medicação, confirme a dose com um profissional.</span></li>
        </ul>
      </section>

      <p className="small mute">
        A NEFESH Life é uma ferramenta de bem-estar e não substitui aconselhamento médico. A Spirulina é um suplemento alimentar e não se destina a tratar ou prevenir doenças.
      </p>
      {foot}
    </>
  );
}

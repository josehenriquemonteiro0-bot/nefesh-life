import { provisionalAreas } from '../domain/onboarding';
import { Bar, Radar } from '../components/Charts';
import { DoseSteps, LevelTag, StudyCard } from '../components/Science';
import { useState } from 'react';
import { BodyCard } from '../components/BodyCard';
import { ADVICE, AREAS, EXPECT } from '../domain/content';
import { PRODUCTS, doseText, type ProductId } from '../domain/lots';
import { GOAL_EVIDENCE, LEVELS, SAFETY_REASONS, studiesFor } from '../domain/science';
import { daysSince, fmtNum, todayKey } from '../domain/dates';
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

function FormatPicker() {
  const { S, update } = useStore();
  const f = S.format ?? 'caps';
  return (
    <div className="seg seg-wide" role="group" aria-label="Como vai tomar a Spirulina">
      {(Object.keys(PRODUCTS) as ProductId[]).map((k) => (
        <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => update((d) => { d.format = k; })}>
          {k === 'caps' ? 'Cápsulas' : k === 'po' ? 'Pó' : 'Palhinha'}
        </button>
      ))}
    </div>
  );
}

function LabelChoice({ gStudy, label, following }: { gStudy: number; label: string; following: boolean }) {
  const { update } = useStore();
  return (
    <div className="labelnote">
      <p className="small" style={{ margin: 0 }}>
        {following
          ? `Está a seguir a recomendação geral do rótulo (${label}). A sua sugestão personalizada, baseada nos estudos, é de ${fmtNum(gStudy)} g por dia.`
          : `Sugestão personalizada, baseada nos estudos para o seu objetivo. A recomendação geral do rótulo é ${label} por dia. Se tiver dúvidas, fale com um profissional.`}
      </p>
      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => update((d) => { d.followLabel = !following; })}>
        {following ? 'Usar a sugestão personalizada' : 'Prefiro seguir o rótulo'}
      </button>
    </div>
  );
}

function ProDoseForm() {
  const { S, update, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [g, setG] = useState(S.proDose?.g ?? 4);
  const [by, setBy] = useState(S.proDose?.by ?? '');
  if (S.proDose)
    return (
      <div className="row" style={{ marginTop: 12 }}>
        <p className="small" style={{ margin: 0 }}>Dose indicada por <b>{S.proDose.by}</b>.</p>
        <button className="btn ghost sm" onClick={() => { update((d) => { d.proDose = null; }); toast('Voltou à dose do rótulo.'); }}>Remover</button>
      </div>
    );
  if (!open)
    return <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Um profissional indicou-me outra dose</button>;
  return (
    <div className="card" style={{ marginTop: 12, background: 'var(--panel2)' }}>
      <h3>Dose indicada pelo seu profissional</h3>
      <div className="num" style={{ margin: '6px 0' }}><output>{fmtNum(g)}</output><span className="mute">g por dia</span></div>
      <input type="range" min={0.5} max={8} step={0.5} value={g} onChange={(e) => setG(+e.target.value)} aria-label="Gramas por dia" />
      <input className="field sm" style={{ width: '100%', margin: '8px 0' }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Nome do profissional (ex.: Dra. Ana Silva)" aria-label="Nome do profissional" />
      <p className="small mute">Confirmo que esta dose foi indicada por um profissional de saúde para o meu caso.</p>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
        <button
          className="btn sm"
          disabled={!by.trim()}
          onClick={() => {
            update((d) => { d.proDose = { g, by: by.trim(), at: todayKey() }; });
            toast('Dose do profissional guardada.');
            setOpen(false);
          }}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

/** Secção que se abre ao tocar (para o detalhe não ocupar o ecrã). */
function More({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="card more">
      <summary><span>{title}</span></summary>
      <div className="more-body">{children}</div>
    </details>
  );
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

  const c = calcPlan(a, { format: S.format, pro: S.proDose, followLabel: S.followLabel });
  const dt = (units: number) => doseText(units, c.format);
  const sc = scores(a);
  const ix = indexOf(sc);
  const prevEv = isNew ? S.evals[S.evals.length - 1] : S.evals[S.evals.length - 2];
  const prev = prevEv && (!S.sample || !isNew) ? prevEv.sc : null;
  const delta = prev ? ix - indexOf(prev) : null;
  // áreas ainda sem resposta (perguntas do dia) não contam como a maior oportunidade
  const prov = provisionalAreas(a);
  const weak = AREAS.filter(([k]) => !prov.includes(k)).sort((x, y) => sc[x[0]] - sc[y[0]])[0] ?? AREAS[0];
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
      {isNew && <p className="mute small" style={{ margin: 0 }}>O seu resultado{a.name ? ` · ${a.name}` : ''}</p>}
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
        {prov.length > 0 && (
          <p className="small" style={{ margin: '0 0 6px', opacity: 0.85 }}>
            Índice provisório: {AREAS.filter(([k]) => prov.includes(k)).map(([, t]) => t.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' e $1')} {prov.length === 1 ? 'completa-se' : 'completam-se'} com as perguntas do dia, a partir de amanhã.
          </p>
        )}
        <Radar sc={sc} prev={prev} />
        {prev && <p className="small" style={{ textAlign: 'center', margin: 0, opacity: 0.8 }}><span className="gold">- - -</span> avaliação anterior</p>}
        <div className="areas">
          {AREAS.map(([k, t]) => (
            <div className="area" key={k}><span>{t}</span><Bar pct={sc[k]} /><b>{sc[k]}</b></div>
          ))}
        </div>
      </section>
      <BodyCard a={a} onReassess={isNew ? undefined : onReassess} />
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
  const split = splitDose(c.caps, goal, c.format);

  return (
    <>
      {isNew ? head : <h1>O seu plano</h1>}
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>A sua dose de Spirulina</p>
        <div className="dose" style={{ marginTop: 6 }}>{fmtNum(c.g)} g <small>/ dia</small></div>
        <p style={{ margin: '10px 0 0' }}>
          = <b>{dt(c.caps)}</b>{c.format === 'caps' ? ' de 500 mg' : ` de ${PRODUCTS[c.format].name.toLowerCase()}`}
        </p>
        <p className="small" style={{ margin: '10px 0 0' }}>
          {split.length > 1 ? split.map((x) => `${x.l}: ${dt(x.n)}`).join(' · ') : c.when}
        </p>
        <p className="small" style={{ margin: '14px 0 6px', opacity: 0.8 }}>Como vai tomar?</p>
        <FormatPicker />
        {!S.proDose && (c.aboveLabel || c.capped) && <LabelChoice gStudy={c.gStudy} label={PRODUCTS[c.format].dailyText} following={c.capped} />}
        <ProDoseForm />
      </section>

      {!isNew && head}

      <h2 className="more-head">Saber mais</h2>
        <More title="Como calculamos a sua dose">
        <p className="small mute">Cada passo indica de onde vem: de um <b>estudo</b>, de um <b>critério NEFESH</b>, do <b>rótulo</b> do produto ou do <b>seu profissional</b>.</p>
        <DoseSteps steps={c.why} total={`${fmtNum(c.g)} g · ${dt(c.caps)}`} gPerKg={fmtNum(c.gPerKg.toFixed(3))} />
        </More>
        <More title="As suas primeiras semanas">
        <ul className="tl">
          {c.start && (
            <li className={cur === 0 ? 'now' : ''}>
              <h3>Semana 1 · adaptação</h3>
              <p className="small mute" style={{ margin: 0 }}>{dt(Math.ceil(c.caps / 2))} por dia, para o corpo se habituar.</p>
            </li>
          )}
          <li className={cur === 1 ? 'now' : ''}>
            <h3>{c.start ? 'Semanas 2 a 4' : 'Semanas 1 a 4'} · dose completa</h3>
            <p className="small mute" style={{ margin: 0 }}>{dt(c.caps)} por dia e check-in diário.</p>
          </li>
          <li className={cur === 2 ? 'now' : ''}>
            <h3>Dias 7, 15 e 30 · reavaliações</h3>
            <p className="small mute" style={{ margin: 0 }}>Repete esta avaliação aos 7, 15 e 30 dias e compara o seu Índice. A app avisa quando chega cada uma (também em Evolução).</p>
          </li>
          <li className={cur === 3 ? 'now' : ''}>
            <h3>Dias 30 a 90 · consolidação</h3>
            <p className="small mute" style={{ margin: 0 }}>Os estudos medem mudanças após 4 a 12 semanas de uso diário.</p>
          </li>
        </ul>
        </More>
        <More title="O que esperar">
        <p className="small">{EXPECT[goal]}</p>
        <p className="small mute" style={{ margin: 0 }}>A regularidade conta mais do que a quantidade: o app ajuda-o a não falhar.</p>
        </More>
        <More title="A ciência por trás do seu plano">
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 8 }}>
          <span className="small mute">Força da evidência:</span>
          <LevelTag level={ev.level} />
        </div>
        <p className="small">{ev.text}</p>
        <p className="small mute">{LEVELS[ev.level].text}</p>
        {studiesFor(goal).map((st) => <StudyCard key={st.id} s={st} />)}
        <button className="btn ghost full" onClick={openScience}>Ver a biblioteca científica completa</button>
        </More>
        <More title="Segurança e tolerância">
        <ul className="list small">
          <li><span className="neon">•</span><span>Os efeitos adversos relatados são raros e sobretudo digestivos (náusea, inchaço). A semana de adaptação existe para os reduzir.</span></li>
          <li><span className="neon">•</span><span>A segurança depende da pureza, ou seja, da ausência de microcistinas e metais pesados. Leia o QR code do frasco para ver as análises do seu lote.</span></li>
          <li><span className="neon">•</span><span>A Spirulina não é fonte fiável de vitamina B12. Em alimentação vegana mantenha o suplemento de B12.</span></li>
          <li><span className="neon">•</span><span>Se tiver uma doença crónica ou tomar medicação, confirme a dose com um profissional.</span></li>
        </ul>
        </More>

      <p className="small mute">
        A NEFESH Life é uma ferramenta de bem-estar e não substitui aconselhamento médico. A Spirulina é um suplemento alimentar e não se destina a tratar ou prevenir doenças.
      </p>
      {foot}
    </>
  );
}

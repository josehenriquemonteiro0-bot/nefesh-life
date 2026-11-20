import { useEffect, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { Intro } from './components/Intro';
import { ReportSheet } from './components/ReportSheet';
import { ScienceSheet } from './components/Science';
import { BottleSheet } from './components/Bottle';
import { Nutrition } from './screens/Nutrition';
import { Training } from './screens/Training';
import { Consent } from './components/Consent';
import { planFor } from './domain/plan';
import { QUESTIONS } from './domain/content';
import { daysSince, todayKey } from './domain/dates';
import { indexOf, scores } from './domain/plan';
import { blankState } from './domain/sample';
import { took } from './domain/stats';
import { scheduleReminder } from './reminders';
import { Check } from './screens/Check';
import { Evolution } from './screens/Evolution';
import { Home } from './screens/Home';
import { Plan } from './screens/Plan';
import { Pros } from './screens/Pros';
import { Quiz, type QuizState } from './screens/Quiz';
import { useStore } from './state/store';

export type Tab = 'home' | 'quiz' | 'check' | 'nutri' | 'treino' | 'evo' | 'recipes' | 'pros';
export type Nav = (t: Tab) => void;

const TABS: [Tab, string, IconName][] = [
  ['home', 'Início', 'home'],
  ['quiz', 'Plano', 'quiz'],
  ['nutri', 'Nutrição', 'recipes'],
  ['treino', 'Treino', 'flame'],
  ['evo', 'Evolução', 'evo'],
  ['pros', 'Saúde', 'pros'],
];
/** separadores sem botão próprio na barra: Check-in pertence ao Início, Receitas à Nutrição */
const NAV_OF: Partial<Record<Tab, Tab>> = { check: 'home', recipes: 'nutri' };

export function App() {
  const { S, update, replace, toast, toastMsg } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  // abertura em cada utilização: boas-vindas completas sem plano, abertura curta com escolha com plano
  const [intro, setIntro] = useState<null | 'welcome' | 'return'>(S.ans ? 'return' : 'welcome');
  const setShowIntro = (v: boolean) => setIntro(v ? 'welcome' : null);
  // ao voltar à app depois de 30 minutos em segundo plano, mostra de novo a abertura
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && S.ans) setIntro('return');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [S.ans]);
  const [reportOpen, setReportOpen] = useState(false);
  const [scienceOpen, setScienceOpen] = useState(false);
  const openScience = () => setScienceOpen(true);
  const [bottleOpen, setBottleOpen] = useState(false);
  const openBottle = () => setBottleOpen(true);

  // lembrete diário enquanto a app está aberta
  useEffect(() => {
    if (!S.notifications || !S.ans) return;
    return scheduleReminder(S.reminder, () => took(S, S.logs[todayKey()]));
  }, [S]);

  const go: Nav = (t) => {
    if (t !== 'quiz') setQuiz(null);
    setTab(t);
    window.scrollTo(0, 0);
  };
  /** Abre a avaliação; numa reavaliação, as respostas anteriores vêm preenchidas. */
  const startQuiz = (fresh = false) => {
    const prev = !fresh && S.ans ? { ...S.ans } : {};
    // idades antigas em intervalo passam a número exato
    if (typeof prev.idade === 'string') delete prev.idade;
    setQuiz({ draft: prev, qi: 0 });
    setTab('quiz');
    window.scrollTo(0, 0);
  };
  const resetDemo = () => {
    replace(blankState());
    startQuiz(true);
  };
  const cancelQuiz = () => {
    setQuiz(null);
    setTab(S.ans ? 'quiz' : 'home');
  };
  const adopt = () => {
    if (!quiz) return;
    const ans = quiz.draft;
    const ev = { date: todayKey(), sc: scores(ans) };
    if (S.sample || !S.ans) {
      const fresh = blankState();
      replace({ ...fresh, planStart: todayKey(), ans, evals: [ev], notifications: S.notifications, consent: S.consent });
    } else {
      update((d) => {
        d.ans = ans;
        d.evals = d.evals.filter((x) => x.date !== ev.date);
        d.evals.push(ev);
      });
    }
    setQuiz(null);
    setTab('home');
    window.scrollTo(0, 0);
    toast(`Plano guardado. Índice NEFESH: ${indexOf(ev.sc)}.`);
  };

  let screen: JSX.Element | null;
  if (tab === 'quiz') {
    if (quiz && !S.consent) screen = <Consent onAccept={() => setQuiz({ ...quiz })} onCancel={cancelQuiz} />;
    else if (quiz && quiz.qi < QUESTIONS.length) screen = <Quiz state={quiz} setState={setQuiz} onCancel={cancelQuiz} />;
    else if (quiz) screen = <Plan answers={quiz.draft} isNew go={go} onAdopt={adopt} onCancel={cancelQuiz} onReassess={() => startQuiz()} openScience={openScience} />;
    else screen = <Plan answers={S.ans} go={go} onReassess={() => startQuiz()} openScience={openScience} />;
  } else if (!S.ans && tab !== 'pros' && tab !== 'recipes' && tab !== 'nutri' && tab !== 'treino') {
    screen = <Home go={go} startQuiz={() => startQuiz()} onReset={resetDemo} replayIntro={() => setShowIntro(true)} openBottle={openBottle} />;
  } else {
    screen = {
      home: <Home go={go} startQuiz={() => startQuiz()} onReset={resetDemo} replayIntro={() => setShowIntro(true)} openBottle={openBottle} />,
      check: <Check onSaved={() => go('evo')} />,
      evo: <Evolution openReport={() => setReportOpen(true)} go={go} />,
      recipes: <Nutrition initial="receitas" />,
      nutri: <Nutrition />,
      treino: <Training />,
      pros: <Pros openReport={() => setReportOpen(true)} />,
    }[tab];
  }

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7fd8f7" />
            <stop offset="1" stopColor="#1f7fa6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="app">
        <header>
          <div className="logo">
            <img src={`${import.meta.env.BASE_URL}brand/logo-header.png`} alt="nefesh" width={130} height={30} />
            <small>LIFE</small>
          </div>
          <button className="btn ghost sm" onClick={() => startQuiz()}>{S.ans ? 'Reavaliar' : 'Avaliar'}</button>
        </header>
        <main key={tab + (quiz ? quiz.qi : '')} className="view">{screen}</main>
      </div>
      <nav aria-label="Navegação principal">
        {TABS.map(([k, t, icon]) => (
          <button key={k} className={(NAV_OF[tab] ?? tab) === k ? 'on' : ''} aria-current={(NAV_OF[tab] ?? tab) === k ? 'page' : undefined} onClick={() => go(k)}>
            <Icon name={icon} />
            {t}
          </button>
        ))}
      </nav>
      {intro && (
        <Intro
          mode={intro}
          hasPlan={!!S.ans}
          name={S.ans?.name}
          day={S.planStart ? daysSince(S.planStart) + 1 : undefined}
          onDone={(a) => {
            setIntro(null);
            update((d) => { d.intro = true; });
            if (a === 'reset') {
              replace({ ...blankState(), intro: true });
              toast('Dados apagados. Vamos começar do zero.');
              startQuiz(true);
            } else if (a === 'reassess' || !S.ans) startQuiz();
            // 'continue': fica no separador onde está (não interrompe um toque feito durante a animação)
          }}
        />
      )}
      {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} />}
      {scienceOpen && <ScienceSheet onClose={() => setScienceOpen(false)} />}
      {bottleOpen && <BottleSheet onClose={() => setBottleOpen(false)} doseGrams={S.ans ? planFor(S).g : undefined} />}
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
    </>
  );
}

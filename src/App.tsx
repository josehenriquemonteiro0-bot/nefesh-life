import { useEffect, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { Intro } from './components/Intro';
import { ReportSheet } from './components/ReportSheet';
import { ScienceSheet } from './components/Science';
import { BottleSheet } from './components/Bottle';
import { Recipes } from './screens/Recipes';
import { planFor } from './domain/plan';
import { QUESTIONS } from './domain/content';
import { todayKey } from './domain/dates';
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

export type Tab = 'home' | 'quiz' | 'check' | 'evo' | 'recipes' | 'pros';
export type Nav = (t: Tab) => void;

const TABS: [Tab, string][] = [
  ['home', 'Início'],
  ['quiz', 'Plano'],
  ['check', 'Check-in'],
  ['evo', 'Evolução'],
  ['recipes', 'Receitas'],
  ['pros', 'Saúde'],
];

export function App() {
  const { S, update, replace, toast, toastMsg } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [showIntro, setShowIntro] = useState(!S.intro);
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
  const startQuiz = () => {
    setQuiz({ draft: {}, qi: 0 });
    setTab('quiz');
    window.scrollTo(0, 0);
  };
  const resetDemo = () => {
    replace(blankState());
    startQuiz();
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
      replace({ ...fresh, planStart: todayKey(), ans, evals: [ev], notifications: S.notifications });
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
    if (quiz && quiz.qi < QUESTIONS.length) screen = <Quiz state={quiz} setState={setQuiz} onCancel={cancelQuiz} />;
    else if (quiz) screen = <Plan answers={quiz.draft} isNew go={go} onAdopt={adopt} onCancel={cancelQuiz} onReassess={startQuiz} openScience={openScience} />;
    else screen = <Plan answers={S.ans} go={go} onReassess={startQuiz} openScience={openScience} />;
  } else if (!S.ans && tab !== 'pros' && tab !== 'recipes') {
    screen = <Home go={go} startQuiz={startQuiz} onReset={resetDemo} replayIntro={() => setShowIntro(true)} openBottle={openBottle} />;
  } else {
    screen = {
      home: <Home go={go} startQuiz={startQuiz} onReset={resetDemo} replayIntro={() => setShowIntro(true)} openBottle={openBottle} />,
      check: <Check onSaved={() => go('evo')} />,
      evo: <Evolution openReport={() => setReportOpen(true)} />,
      recipes: <Recipes />,
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
          <button className="btn ghost sm" onClick={startQuiz}>Reavaliar</button>
        </header>
        <main key={tab + (quiz ? quiz.qi : '')} className="view">{screen}</main>
      </div>
      <nav aria-label="Navegação principal">
        {TABS.map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
            <Icon name={k as IconName} />
            {t}
          </button>
        ))}
      </nav>
      {showIntro && (
        <Intro
          hasPlan={!!S.ans}
          onDone={() => {
            setShowIntro(false);
            update((d) => { d.intro = true; });
            if (!S.ans) startQuiz();
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

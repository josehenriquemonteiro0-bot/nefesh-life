import { notePremiumUse } from './domain/analytics';
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
import { clearFiles } from './domain/files';
import { stock, took } from './domain/stats';
import { scheduleReminder } from './reminders';
import { pushMedTimes, pushStockEnd, pushSupported, updatePush } from './domain/push';
import { reminderTimes } from './domain/meds';
import { Check } from './screens/Check';
import { Evolution } from './screens/Evolution';
import { Home } from './screens/Home';
import { Plan } from './screens/Plan';
import { Pros } from './screens/Pros';
import { Sleep } from './screens/Sleep';
import { Women } from './screens/Women';
import { Care } from './screens/Care';
import { Mind } from './screens/Mind';
import { Body } from './screens/Body';
import { showWomen } from './domain/women';
import { Coach } from './screens/Coach';
import { Profile } from './screens/Profile';
import { PrintReport } from './components/PrintReport';
import { bodySnapshot } from './domain/progress';
import { sendDailyPing } from './domain/analytics';
import { AccountScreen, ConflictSheet } from './components/Account';
import { getAuth, logout, saveConsents } from './domain/account';
import { useCloudSync } from './state/cloud';
import { useSocialSync } from './state/socialSync';
import { saveInviteFromUrl } from './domain/social';
import { Community } from './screens/Community';
import { AvatarImg } from './components/Avatar';
import { GuidedTour, TAB_TIPS } from './components/GuidedTour';
import { savePendingCode, takePendingCode, useRedeemBottle } from './components/BottleCode';
import { HealthConnectSheet } from './components/HealthConnect';
import { Quiz, type QuizState } from './screens/Quiz';
import { useStore } from './state/store';

export type Tab = 'home' | 'quiz' | 'check' | 'nutri' | 'treino' | 'sono' | 'mente' | 'corpo' | 'cuidados' | 'ciclo' | 'saude' | 'coach' | 'evo' | 'recipes' | 'pros' | 'perfil' | 'conta' | 'social';
export type Nav = (t: Tab) => void;

/** 5 separadores (especificação v2, secção 3): o Coach fica ao centro, em destaque. */
const TABS: [Tab, string, IconName][] = [
  ['home', 'Início', 'home'],
  ['saude', 'Saúde', 'heart'],
  ['coach', 'Coach', 'mic'],
  ['evo', 'Evolução', 'evo'],
  ['social', 'Comunidade', 'pros'],
];
/** sub-separadores da Saúde, com os ícones que tinham na barra */
const HEALTH_TABS: [Tab, string, IconName][] = [
  ['quiz', 'Plano', 'quiz'],
  ['nutri', 'Nutrição', 'recipes'],
  ['treino', 'Treino', 'flame'],
  ['sono', 'Sono', 'moon'],
  ['mente', 'Mente', 'mind'],
  ['corpo', 'Corpo', 'body'],
  ['cuidados', 'Cuidados', 'care'],
  ['ciclo', 'Ciclo', 'cycle'],
];
/** separadores sem botão próprio na barra: Check-in pertence ao Início, Receitas à Nutrição */
const NAV_OF: Partial<Record<Tab, Tab>> = { check: 'home', recipes: 'saude', quiz: 'saude', nutri: 'saude', treino: 'saude', sono: 'saude', mente: 'saude', corpo: 'saude', cuidados: 'saude', ciclo: 'saude', pros: 'home' };

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
  const cloud = useCloudSync();
  useSocialSync();
  /** para onde ir depois do ecrã de conta */
  const [afterAccount, setAfterAccount] = useState<'quiz' | 'perfil' | 'guardar'>('perfil');
  const [accountMode, setAccountMode] = useState<'criar' | 'entrar'>('criar');
  const openAccount = (next: 'quiz' | 'perfil' | 'guardar', mode: 'criar' | 'entrar' = 'criar') => {
    setAfterAccount(next);
    setAccountMode(mode);
    setQuiz(null);
    setTab('conta');
    window.scrollTo(0, 0);
  };
  // código de frasco recebido por link (?frasco=NEF-XXXX-XXXX): regista logo, ou depois de entrar na conta
  const redeemBottle = useRedeemBottle();
  useEffect(() => {
    // convite para a comunidade ou para o 21 Day Reset (?amigo=…&reset=…)
    saveInviteFromUrl();
    const p = new URLSearchParams(location.search);
    const code = p.get('frasco');
    if (code) {
      savePendingCode(code);
      p.delete('frasco');
      history.replaceState(null, '', `${location.pathname}${p.toString() ? `?${p}` : ''}`);
    }
  }, []);
  useEffect(() => {
    if (!getAuth() || !S.ans) return;
    const pending = takePendingCode();
    if (pending) redeemBottle(pending);
  }, [getAuth()?.token, S.ans]);
  // tutorial guiado: na primeira vez que chega ao Início com um plano (e sempre que o pedir no Perfil)
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (tour || intro || quiz || !S.ans || S.sample || S.tourDone || tab !== 'home') return;
    const t = window.setTimeout(() => setTour(true), 900);
    return () => window.clearTimeout(t);
  }, [S.ans, S.tourDone, tab, intro, quiz, tour]);
  const closeTour = () => {
    setTour(false);
    update((d) => { d.tourDone = true; });
    setTab('home');
    window.scrollTo(0, 0);
  };
  const [healthOpen, setHealthOpen] = useState(false);
  const openHealth = () => setHealthOpen(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const printReport = () => {
    notePremiumUse('relatorioCompleto');
    setPrinting(true);
  };
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // espera o relatório ser desenhado antes de abrir o diálogo de impressão (Guardar como PDF)
    const t = setTimeout(() => window.print(), 300);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);
  // estatísticas anónimas: no máximo uma contagem por dia
  useEffect(() => { sendDailyPing(S); }, [S.ans, S.stats]);
  const [scienceOpen, setScienceOpen] = useState(false);
  const openScience = () => setScienceOpen(true);
  const [bottleOpen, setBottleOpen] = useState(false);
  const openBottle = () => setBottleOpen(true);

  // notificações: com Web Push, o lembrete vem do servidor mesmo com a app fechada;
  // ao abrir (e ao entrar na conta) atualiza a hora e a ligação à conta
  const authToken = getAuth()?.token;
  useEffect(() => {
    if (S.notifications && S.ans && pushSupported()) updatePush(S.reminder);
  }, [authToken, S.notifications]);
  // lembretes de medicação: o servidor só recebe as horas
  const medTimes = reminderTimes(S).join(',');
  useEffect(() => {
    if (S.notifications && !S.sample && pushSupported()) pushMedTimes(medTimes ? medTimes.split(',') : []);
  }, [medTimes, S.notifications, authToken]);
  // consentimentos: as escolhas vão para a conta (marketing com o e-mail; I&D para prova)
  const consentMark = `${authToken ?? ''}|${S.consents?.rd?.on ? 1 : 0}|${S.consents?.marketing?.on ? 1 : 0}`;
  useEffect(() => {
    if (!authToken || !S.consents) return;
    try {
      if (localStorage.getItem('nefesh-life-consentimentos') === consentMark) return;
    } catch {
      /* sem armazenamento */
    }
    saveConsents({ rd: !!S.consents.rd?.on, marketing: !!S.consents.marketing?.on })
      .then(() => {
        try {
          localStorage.setItem('nefesh-life-consentimentos', consentMark);
        } catch {
          /* sem armazenamento */
        }
      })
      .catch(() => undefined);
  }, [consentMark]);
  // reposição: o servidor avisa 7 dias antes da data prevista para acabar a Spirulina
  const stockEnds = S.ans && S.stockCaps > 0 ? stock(S).ends : null;
  useEffect(() => {
    if (S.notifications && S.ans && !S.sample && pushSupported()) pushStockEnd(stockEnds);
  }, [stockEnds, S.notifications, authToken]);
  // sem Web Push (navegador antigo): lembrete enquanto a app está aberta
  useEffect(() => {
    if (!S.notifications || !S.ans || pushSupported()) return;
    return scheduleReminder(S.reminder, () => took(S, S.logs[todayKey()]));
  }, [S]);

  // a Saúde abre no último sub-separador usado (Plano na primeira vez)
  const [healthSub, setHealthSub] = useState<Tab>('quiz');
  const go: Nav = (t) => {
    const to = t === 'saude' ? healthSub : t;
    if (to !== 'quiz') setQuiz(null);
    if (NAV_OF[to] === 'saude' && to !== 'recipes') setHealthSub(to);
    setTab(to);
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
    const ev = { date: todayKey(), sc: scores(ans), body: bodySnapshot(ans) };
    const first = S.sample || !S.ans;
    if (first) {
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
    toast(`Plano guardado. Índice NEFESH: ${indexOf(ev.sc)}.`);
    // primeiro plano sem conta: propõe criar a conta para o guardar (pode saltar)
    if (first && !getAuth()) {
      openAccount('guardar');
      return;
    }
    setTab('home');
    window.scrollTo(0, 0);
  };

  let screen: JSX.Element | null;
  if (tab === 'quiz') {
    if (quiz && !S.consent) screen = <Consent onAccept={() => setQuiz({ ...quiz })} onCancel={cancelQuiz} />;
    else if (quiz && quiz.qi < QUESTIONS.length) screen = <Quiz state={quiz} setState={setQuiz} onCancel={cancelQuiz} />;
    else if (quiz) screen = <Plan answers={quiz.draft} isNew go={go} onAdopt={adopt} onCancel={cancelQuiz} onReassess={() => startQuiz()} openScience={openScience} />;
    else screen = <Plan answers={S.ans} go={go} onReassess={() => startQuiz()} openScience={openScience} />;
  } else if (!S.ans && tab !== 'pros' && tab !== 'recipes' && tab !== 'nutri' && tab !== 'treino' && tab !== 'perfil' && tab !== 'conta' && tab !== 'social' && tab !== 'coach' && tab !== 'sono') {
    screen = <Home go={go} startQuiz={() => startQuiz()} onReset={resetDemo} openBottle={openBottle} openLogin={() => openAccount('quiz', 'entrar')} openHealth={openHealth} />;
  } else {
    screen = {
      home: <Home go={go} startQuiz={() => startQuiz()} onReset={resetDemo} openBottle={openBottle} openLogin={() => openAccount('quiz', 'entrar')} openHealth={openHealth} />,
      check: <Check onSaved={() => go('evo')} />,
      evo: <Evolution openReport={() => setReportOpen(true)} go={go} />,
      recipes: <Nutrition initial="receitas" />,
      nutri: <Nutrition />,
      treino: <Training />,
      sono: <Sleep />,
      ciclo: <Women />,
      mente: <Mind go={go} />,
      corpo: <Body />,
      cuidados: <Care />,
      coach: <Coach go={go} />,
      saude: null,
      pros: <Pros openReport={() => setReportOpen(true)} />,
      social: <Community openAccount={() => openAccount('perfil')} />,
      conta: (
        <AccountScreen
          key={accountMode}
          initial={accountMode}
          save={afterAccount === 'guardar'}
          onSkip={afterAccount === 'quiz' ? () => startQuiz() : afterAccount === 'guardar' ? () => go('home') : () => go('perfil')}
          onDone={(r) => {
            // com dados na nuvem, a sincronização traz o plano; sem plano, segue para a avaliação
            if (afterAccount === 'guardar') go('home');
            else if (afterAccount === 'quiz' && !r.updatedAt && !S.ans) startQuiz();
            else go(r.updatedAt && !S.ans ? 'home' : 'perfil');
          }}
        />
      ),
      perfil: <Profile startQuiz={() => startQuiz()} replayIntro={() => setShowIntro(true)} openBottle={openBottle} openReport={() => setReportOpen(true)} printReport={printReport} openAccount={() => openAccount('perfil')} syncNow={cloud.syncNow} openHealth={openHealth} openTour={() => { go('home'); setTour(true); }} />,
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
          <div className="row" style={{ gap: 8 }}>
            {!S.ans && <button className="btn ghost sm" onClick={() => startQuiz()}>Avaliar</button>}
            <button data-tour="perfil" className={`avatar ${tab === 'perfil' ? 'on' : ''}`} onClick={() => go('perfil')} aria-label="Perfil" aria-current={tab === 'perfil' ? 'page' : undefined}>
              <AvatarImg />
            </button>
          </div>
        </header>
        <main key={tab + (quiz ? quiz.qi : '')} className="view">
          {NAV_OF[tab] === 'saude' && !(tab === 'quiz' && quiz) && (
            <div className="subtabs" role="tablist" aria-label="Saúde" data-tour="saude-tabs">
              {HEALTH_TABS.filter(([k]) => k !== 'ciclo' || showWomen(S)).map(([k, t, icon]) => {
                const on = tab === k || (k === 'nutri' && tab === 'recipes');
                return (
                  <button key={k} role="tab" aria-selected={on} className={on ? 'on' : ''} onClick={() => go(k)}>
                    <Icon name={icon} />
                    {t}
                  </button>
                );
              })}
            </div>
          )}
          {S.ans && !tour && TAB_TIPS[tab] && !S.tipsSeen?.[tab] && (
            <div className="tab-tip" role="note">
              <span className="small">💡 {TAB_TIPS[tab]}</span>
              <button className="link small inline" onClick={() => update((d) => { d.tipsSeen = { ...(d.tipsSeen ?? {}), [tab]: true }; })}>Percebi</button>
            </div>
          )}
          {screen}
        </main>
      </div>
      <nav aria-label="Navegação principal">
        {TABS.map(([k, t, icon]) => (
          <button key={k} data-tour={`nav-${k}`} className={`${(NAV_OF[tab] ?? tab) === k ? 'on' : ''} ${k === 'coach' ? 'nav-coach' : ''}`} aria-current={(NAV_OF[tab] ?? tab) === k ? 'page' : undefined} onClick={() => go(k)}>
            {k === 'coach' ? <span className="coach-btn"><Icon name={icon} width={2.2} /></span> : <Icon name={icon} />}
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
              // os dados da conta ficam na nuvem; este telemóvel sai da conta para não os substituir
              if (getAuth()) logout();
              replace({ ...blankState(), intro: true });
              clearFiles().catch(() => undefined);
              toast('Dados apagados. Vamos começar do zero.');
              startQuiz(true);
            } else if (a === 'reassess') startQuiz();
            // primeira utilização: a avaliação vem primeiro; a conta é proposta no fim, para guardar o plano
            else if (!S.ans) startQuiz();
            // 'continue': fica no separador onde está (não interrompe um toque feito durante a animação)
          }}
        />
      )}
      {reportOpen && <ReportSheet onClose={() => setReportOpen(false)} onPrint={() => { setReportOpen(false); printReport(); }} />}
      {printing && <PrintReport />}
      {tour && <GuidedTour go={go} onClose={closeTour} />}
      {healthOpen && (
        <HealthConnectSheet
          onClose={() => setHealthOpen(false)}
          openAccount={() => { setHealthOpen(false); openAccount('perfil'); }}
          refresh={cloud.reconcile}
        />
      )}
      {cloud.conflict && <ConflictSheet cloudAt={cloud.conflict.cloudAt} localAt={S.updatedAt} onPick={cloud.resolve} />}
      {scienceOpen && <ScienceSheet onClose={() => setScienceOpen(false)} />}
      {bottleOpen && <BottleSheet onClose={() => setBottleOpen(false)} doseGrams={S.ans ? planFor(S).g : undefined} />}
      <div className={`toast ${toastMsg ? 'show' : ''}`} role="status" aria-live="polite">{toastMsg}</div>
    </>
  );
}

import { Bar } from '../components/Charts';
import { Icon } from '../components/Icon';
import { DataCard } from '../components/DataCard';
import { SHOP_URL, GOAL_LABEL } from '../domain/content';
import { daysSince, fmtNum } from '../domain/dates';
import { indexOf, planFor } from '../domain/plan';
import { stock } from '../domain/stats';
import { lotFor, stockText } from '../domain/lots';
import { nextReassessment } from '../domain/progress';
import { BODY_GOAL_LABEL, bodyGoalOf, bodyOf } from '../domain/body';
import { enableNotifications, notificationsSupported } from '../reminders';
import { useStore } from '../state/store';
import { Comparison } from './Evolution';
import { AccountCard } from '../components/Account';

export function Profile({ startQuiz, replayIntro, openBottle, openReport, printReport, openAccount, syncNow }: {
  openAccount: () => void;
  syncNow: () => Promise<void>;
  startQuiz: () => void;
  replayIntro: () => void;
  openBottle: () => void;
  openReport: () => void;
  printReport: () => void;
}) {
  const { S, update, toast } = useStore();
  if (!S.ans) {
    return (
      <>
        <h1>Perfil</h1>
        <section className="card">
          <p className="small mute">Ainda não fez a avaliação.</p>
          <button className="btn" onClick={startQuiz}>Começar a avaliação</button>
        </section>
        <AccountCard openAccount={openAccount} syncNow={syncNow} />
        <DataCard />
      </>
    );
  }
  const c = planFor(S);
  const st = stock(S);
  const low = st.days <= 7;
  const ev = S.evals[S.evals.length - 1];
  const re = nextReassessment(S);
  const lastLot = lotFor([...(S.bottles || [])].reverse().find((b) => b.code)?.code);
  const day = S.planStart ? daysSince(S.planStart) + 1 : 1;

  return (
    <>
      <h1>Perfil</h1>
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>Dia {day} do ritual</p>
        <h2 style={{ margin: '4px 0 2px' }}>{S.ans.name || 'O seu plano'}</h2>
        <p className="small" style={{ margin: 0, opacity: 0.85 }}>
          {GOAL_LABEL[S.ans.goal ?? 'energia']} · {BODY_GOAL_LABEL[bodyOf(S.ans)?.corpo ?? bodyGoalOf(S.ans)]}
          {ev ? ` · Índice ${indexOf(ev.sc)}` : ''}
        </p>
      </section>

      <AccountCard openAccount={openAccount} syncNow={syncNow} />

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>Reavaliação</h2>
            <p className="small mute" style={{ margin: '4px 0 0' }}>
              {re?.due
                ? `Chegou a reavaliação dos ${re.target} dias.`
                : re
                  ? `Próxima aos ${re.target} dias: ${re.inDays === 1 ? 'amanhã' : `daqui a ${re.inDays} dias`}.`
                  : 'Aos 7, 15 e 30 dias e depois todos os meses.'}
            </p>
          </div>
          <button className={`btn sm ${re?.due ? '' : 'ghost'}`} onClick={startQuiz}>Reavaliar</button>
        </div>
      </section>

      <Comparison />

      <section className="card">
        <h2>Relatório</h2>
        <p className="small mute" style={{ marginTop: 0 }}>Com o seu plano, a semana, o antes e depois e a execução dos planos do nutricionista e do personal.</p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="btn sm" onClick={printReport}>Guardar em PDF</button>
          <button className="btn ghost sm" onClick={openReport}>Enviar como texto</button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Spirulina e reposição</h2>
          <span className="mute small">{c.format === 'caps' ? st.left : fmtNum(st.left / 2)} de {stockText(S.stockCaps, c.format)}</span>
        </div>
        <Bar pct={st.pct} variant={low ? 'low' : undefined} />
        <p className={`small ${low ? '' : 'mute'}`}>
          {low ? `O seu stock acaba em ${st.days} dias.` : `Ao ritmo atual, o seu stock dura mais ${st.days} dias.`}
          {lastLot ? ` Lote ${lastLot.code}: ${lastLot.values.filter((v) => v.pos === 'acima').map((v) => v.label).join(', ')} acima da referência.` : ''}
        </p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <a className="btn sm" href={SHOP_URL} target="_blank" rel="noopener">Encomendar</a>
          <button className="btn ghost sm" onClick={openBottle}><Icon name="qr" /> {lastLot ? 'Ver análises' : 'Ler QR do frasco'}</button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <h2 style={{ margin: 0 }}>Lembrete diário</h2>
            <p className="mute small" style={{ margin: '4px 0 0' }}>
              {S.notifications ? 'Notificação ativa neste dispositivo.' : 'Receba uma notificação à hora da sua toma.'}
            </p>
          </div>
          <input
            type="time"
            value={S.reminder}
            aria-label="Hora do lembrete"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              update((d) => { d.reminder = v; });
              toast(`Lembrete às ${v}.`);
            }}
          />
        </div>
        {!S.notifications && notificationsSupported() && (
          <button
            className="btn ghost sm"
            style={{ marginTop: 12 }}
            onClick={async () => {
              const ok = await enableNotifications();
              update((d) => { d.notifications = ok; });
              toast(ok ? 'Notificações ativadas.' : 'As notificações foram bloqueadas no navegador.');
            }}
          >
            <Icon name="bell" /> Ativar notificações
          </button>
        )}
      </section>

      <section className="card">
        <h2>Estatísticas anónimas</h2>
        <label className="check">
          <input type="checkbox" checked={S.stats !== false} onChange={(e) => update((d) => { d.stats = e.target.checked; })} />
          <span className="small">Ajudar a melhorar a NEFESH Life com contagens anónimas de utilização.</span>
        </label>
        <p className="small mute" style={{ margin: '8px 0 0' }}>
          Sem cookies, sem nome, sem e-mail e sem dados de saúde: só contamos, uma vez por dia, que partes da app foram usadas.
        </p>
      </section>

      <DataCard />

      <p style={{ textAlign: 'center' }}>
        <button className="skip" onClick={replayIntro}>Rever as boas-vindas</button>
      </p>
    </>
  );
}

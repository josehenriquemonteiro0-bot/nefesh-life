import { useEffect, useState } from 'react';
import { Bar, Ring } from './Charts';
import { PremiumTag } from './PremiumTag';
import { REPORT_AREAS, reportSummary, weeklyReport } from '../domain/weekReport';
import { canAccess } from '../domain/features';
import { PHOTO_API, deviceId } from '../domain/photo';
import { notePremiumUse } from '../domain/analytics';
import { addDaysKey, shortDate, todayKey } from '../domain/dates';
import { speak, stopSpeaking, ttsSupported, voiceLang } from '../domain/voice';
import { useStore } from '../state/store';

/** Relatório semanal: índice de consistência, 5 áreas, o que a IA percebeu e uma prioridade. */
export function WeeklyReport() {
  const { S, update } = useStore();
  const r = weeklyReport(S);
  const full = canAccess(S, 'relatorioCompleto');
  const note = S.reportNotes?.[r.week];
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // marca o relatório como visto e pede "o que a IA percebeu" uma vez por semana
  useEffect(() => {
    if (S.reportSeen !== r.week) update((d) => { d.reportSeen = r.week; });
    if (!full || note !== undefined || r.index === null || loading || S.sample) return;
    setLoading(true);
    notePremiumUse('relatorioCompleto');
    fetch(`${PHOTO_API}/relatorio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: reportSummary(S, r), device: deviceId() }) })
      .then((x) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status)))))
      .then((b: { insights?: string }) => {
        const text = String(b.insights ?? '').trim();
        if (text) update((d) => { d.reportNotes = { ...(d.reportNotes ?? {}), [r.week]: text }; });
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.week, full]);
  useEffect(() => () => stopSpeaking(), []);

  const listen = () => {
    const parts = [
      `Relatório da semana. Índice de consistência: ${r.index} em 100.`,
      ...REPORT_AREAS.filter(([a]) => r.scores[a] !== null).map(([a, t]) => `${t}: ${r.scores[a]}.`),
      note ?? '',
      r.priority ? `A sua prioridade para a próxima semana: ${r.priority.text}` : '',
    ];
    speak(parts.filter(Boolean).join(' '), voiceLang(S));
  };

  return (
    <section className="card week-report" data-tour="relatorio">
      <div className="row">
        <h2 style={{ margin: 0 }}>Relatório da semana</h2>
        <span className="small mute">{r.days[6] < todayKey() ? 'Semana passada · ' : ''}{shortDate(r.days[0])} – {shortDate(r.days[6])}</span>
      </div>
      {r.days[6] < todayKey() && (
        <p className="small mute" style={{ margin: '4px 0 0' }}>O relatório desta semana ({shortDate(addDaysKey(r.days[6], 1))} – {shortDate(addDaysKey(r.days[6], 7))}) fica pronto no domingo às 18h.</p>
      )}
      {r.index === null ? (
        <p className="small mute" style={{ margin: '10px 0 0' }}>Ainda sem registos nesta semana. Marque a Spirulina, a água, o sono ou um treino e o relatório aparece aqui no domingo à noite.</p>
      ) : (
        <>
          <div className="health" style={{ marginTop: 10 }}>
            <Ring value={r.index} goal={100} label="/ 100" />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, font: '600 18px Sora' }}>Índice de consistência</p>
              <p className="small mute" style={{ margin: '2px 0 0' }}>
                {r.index >= 80 ? 'Semana muito consistente. 👏' : r.index >= 60 ? 'Boa base: falta pouco para uma semana redonda.' : 'Cada dia conta: escolha uma coisa para melhorar.'}
              </p>
            </div>
          </div>
          <div className="report-areas">
            {REPORT_AREAS.map(([a, t]) => (
              <div key={a}>
                <div className="row small"><span>{t}</span><span className="mute">{r.scores[a] === null ? 'sem registos' : r.scores[a]}</span></div>
                {r.scores[a] !== null && <Bar pct={r.scores[a]!} />}
              </div>
            ))}
          </div>

          <div className="report-ai">
            <div className="row" style={{ marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>O que a IA percebeu</h3>
              <PremiumTag f="relatorioCompleto" />
            </div>
            {!full ? (
              <p className="small mute" style={{ margin: 0 }}>No Premium, a IA analisa a sua semana e liga os pontos entre o sono, a energia, o treino e a Spirulina.</p>
            ) : note ? (
              <p className="small" style={{ margin: 0 }}>{note}</p>
            ) : loading ? (
              <p className="small mute" style={{ margin: 0 }}>A analisar a sua semana…</p>
            ) : failed ? (
              <p className="small mute" style={{ margin: 0 }}>Não foi possível analisar agora. Abra outra vez com internet.</p>
            ) : null}
          </div>

          {r.priority && (
            <div className="report-priority">
              <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>A sua prioridade para a próxima semana</p>
              <p style={{ margin: '4px 0 0' }}>{r.priority.text}</p>
            </div>
          )}

          {full && ttsSupported() && (
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={listen}>🔊 Ouvir o relatório</button>
          )}
        </>
      )}
      <p className="small mute" style={{ margin: '10px 0 0' }}>
        Índice de consistência baseado nos seus dados e objetivos — não é avaliação clínica. Áreas sem registos não contam como falha.
      </p>
    </section>
  );
}

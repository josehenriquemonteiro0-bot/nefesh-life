/**
 * NEFESH Voice Assistant: ações que pedem confirmação (lembretes, consultas, desafios),
 * ecrãs que o assistente pode abrir e o resumo falado do dia (feito na app, sem IA).
 */
import type { CoachAction } from './coach';
import { newId } from './care';
import { dayKey, todayKey } from './dates';
import { medsToday } from './meds';
import { planFor, slotsFor } from './plan';
import { took } from './stats';
import { weeklyReport } from './weekReport';
import type { AppState } from './types';
import type { Tab } from '../App';

/** Ecrã pedido → separador da app. */
export const SCREEN_TAB: Record<string, [Tab, string]> = {
  plano: ['quiz', 'O meu plano'],
  nutricao: ['nutri', 'Nutrição'],
  receitas: ['recipes', 'Receitas'],
  treino: ['treino', 'Treino'],
  sono: ['sono', 'Sono'],
  mente: ['mente', 'Mente'],
  corpo: ['corpo', 'Corpo'],
  cuidados: ['cuidados', 'Cuidados'],
  ciclo: ['ciclo', 'Ciclo'],
  evolucao: ['evo', 'Evolução'],
  comunidade: ['social', 'Comunidade'],
  desafios: ['social', 'Desafios'],
  profissionais: ['pros', 'Profissionais'],
  perfil: ['perfil', 'Perfil'],
  checkin: ['check', 'Check-in'],
};

const fmtDate = (k: string, now = new Date()) => {
  if (k === todayKey(now)) return 'hoje';
  if (k === dayKey(new Date(now.getTime() + 86400000))) return 'amanhã';
  return k.split('-').reverse().slice(0, 2).join('/');
};

/** Texto da proposta (para o cartão de confirmação). */
export function proposalText(a: CoachAction, now = new Date()) {
  if (a.type === 'lembrete') return `⏰ ${a.note} · ${fmtDate(a.date!, now)}${a.time ? ` às ${a.time}` : ''}`;
  if (a.type === 'consulta') return `🩺 Consulta: ${a.note || 'consulta'} · ${fmtDate(a.date!, now)}${a.time ? ` às ${a.time}` : ''}`;
  return '';
}

/** Grava uma proposta confirmada (lembrete ou consulta) no estado. */
export function applyProposal(S: AppState, a: CoachAction) {
  if (a.type === 'lembrete' && a.date) {
    S.reminders = [...(S.reminders ?? []), { id: newId(), date: a.date, time: a.time || '09:00', text: (a.note || 'Lembrete').slice(0, 80) }]
      .filter((r) => r.date >= todayKey())
      .sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`))
      .slice(0, 30);
  }
  if (a.type === 'consulta' && a.date) {
    const [kind, who] = (a.note || 'Consulta').split(/,\s*/);
    S.care = { ...(S.care ?? {}), visits: [...(S.care?.visits ?? []), { id: newId(), date: a.date, kind: kind || 'Consulta', who: who || undefined, note: a.time ? `às ${a.time}` : undefined }] };
  }
}

/** Resumo do dia, para ler em voz alta (sem IA, com os dados de hoje). */
export function daySummary(S: AppState, now = new Date()) {
  const k = todayKey(now);
  const l = S.logs[k] ?? {};
  const parts: string[] = [];
  const name = S.ans?.name ? `${S.ans.name}, ` : '';
  if (S.ans) {
    const sl = slotsFor(S, now);
    const missing = sl.filter((_, i) => !(l.doses ?? [])[i]);
    parts.push(took(S, l, now) ? 'a Spirulina de hoje já está tomada' : `falta a Spirulina${missing.length ? ` (${missing.map((s) => s.l.toLowerCase()).join(' e ')})` : ''}`);
    const goal = planFor(S).water;
    const w = l.water ?? 0;
    parts.push(w >= goal ? 'a água está na meta' : `faltam ${goal - w} copos de água`);
  }
  const meds = medsToday(S, l, now).filter((m) => !m.taken);
  if (meds.length) parts.push(`medicação por tomar: ${meds.slice(0, 3).map((m) => `${m.med.name} às ${m.time}`).join(', ')}`);
  const visits = (S.care?.visits ?? []).filter((v) => v.date === k);
  if (visits.length) parts.push(`tem consulta hoje: ${visits.map((v) => v.kind).join(', ')}`);
  const rem = (S.reminders ?? []).filter((r) => r.date === k && r.time >= now.toTimeString().slice(0, 5));
  if (rem.length) parts.push(`lembretes: ${rem.map((r) => `${r.text} às ${r.time}`).join(', ')}`);
  if (!l.e && now.getHours() >= 17) parts.push('falta o check-in');
  const pr = weeklyReport(S, now).priority;
  const tail = pr ? ` A sua prioridade desta semana: ${pr.text}` : '';
  return `${name ? name[0].toUpperCase() + name.slice(1) : ''}${parts.length ? `${parts.join('; ')}.` : 'está tudo em dia por agora.'}${tail}`;
}

/** Os amigos nomeados pelo assistente, encontrados na lista de amigos (sem acentos e sem maiúsculas). */
export function matchFriends(names: string[], friends: { id: string; nick: string }[]) {
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return friends.filter((f) => names.some((x) => n(f.nick) === n(x) || n(f.nick).startsWith(n(x)) || n(x).startsWith(n(f.nick)))).map((f) => f.id);
}

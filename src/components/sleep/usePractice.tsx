import { useState, type ReactNode } from 'react';
import { BreathSession } from '../BreathSession';
import { MeditationPlayer } from '../MeditationPlayer';
import { logBreath, techniqueOf, type Technique } from '../../domain/mind';
import { meditationById } from '../../domain/meditations';
import { canAccess } from '../../domain/features';
import { notePremiumUse } from '../../domain/analytics';
import { useStore } from '../../state/store';
import { openPaywall } from '../Paywall';

export type Practice = { kind: 'respiracao'; id: Technique['id']; minutes: number } | { kind: 'meditacao'; id: string };

/**
 * Abre uma respiração guiada ou uma meditação e regista os minutos no dia (como no ecrã Mente).
 * Devolve `start` e o elemento a pôr no ecrã; `after` corre quando a prática termina.
 */
export function usePractice(after?: (minutes: number) => void): { start: (p: Practice) => boolean; node: ReactNode } {
  const { S, updateToday, toast } = useStore();
  const [cur, setCur] = useState<Practice | null>(null);
  const start = (p: Practice) => {
    if (p.kind === 'meditacao') {
      const m = meditationById(p.id);
      if (!m) return false;
      if (!m.free && !canAccess(S, 'meditacao')) {
        toast('Esta sessão faz parte do Premium.');
        openPaywall();
        return false;
      }
      if (!m.free) notePremiumUse('meditacao');
    }
    setCur(p);
    return true;
  };
  const end = (minutes: number) => {
    const p = cur;
    setCur(null);
    if (p && minutes >= 1) {
      updateToday((d) => {
        if (p.kind === 'respiracao') logBreath(d, minutes);
        else {
          d.medit = Math.round(((d.medit ?? 0) + minutes) * 10) / 10;
          d.hab = { ...(d.hab ?? {}), resp: true };
        }
      });
    }
    after?.(minutes);
  };
  let node: ReactNode = null;
  if (cur?.kind === 'respiracao') node = <BreathSession tech={techniqueOf(cur.id)} minutes={cur.minutes} onEnd={end} />;
  if (cur?.kind === 'meditacao') {
    const m = meditationById(cur.id);
    if (m) node = <MeditationPlayer m={m} onEnd={end} />;
  }
  return { start, node };
}

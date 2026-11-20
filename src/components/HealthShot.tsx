import { useRef, useState } from 'react';
import { useAuth } from '../domain/account';
import { fmtNum, todayKey } from '../domain/dates';
import { applyHealthDays } from '../domain/healthSync';
import { compressImage } from '../domain/photo';
import { proveHealth, refresh } from '../domain/social';
import { useStore } from '../state/store';
import { pushPoints } from '../state/socialSync';

/**
 * Comprovar passos, exercício e sono com uma captura de ecrã do app Saúde, Fitness
 * ou da app do relógio. A IA lê a data e os valores; os de hoje contam como verificados ✅.
 */
export function HealthShotButton({ compact = false }: { compact?: boolean }) {
  const { S, update, toast } = useStore();
  const auth = useAuth();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!auth) return null;
  return (
    <div style={{ marginTop: compact ? 8 : 12 }}>
      <button className="btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>
        {busy ? 'A ler a captura…' : '📲 Comprovar com captura do app Saúde'}
      </button>
      {!compact && <p className="small mute" style={{ margin: '6px 0 0' }}>Tire uma captura de ecrã do app Saúde, Fitness ou do seu relógio com os passos, o exercício ou o sono de hoje. Os valores passam a contar como verificados ✅.</p>}
      {note && <p className="small key-warn">{note}</p>}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setBusy(true);
          setNote(null);
          try {
            const img = await compressImage(f, 1280);
            const r = await proveHealth(img.data, img.media_type);
            if (!r.ok) {
              setNote(r.note);
              return;
            }
            const day = { steps: r.steps, sleepH: r.sleepH, exMin: r.exMin, at: new Date().toISOString() };
            update((d) => { applyHealthDays(d, { [todayKey()]: day }); });
            toast(['✅', r.steps !== undefined && `${r.steps.toLocaleString('pt-PT')} passos`, r.exMin !== undefined && `${r.exMin} min de exercício`, r.sleepH !== undefined && `${fmtNum(r.sleepH)} h de sono`].filter(Boolean).join(' '));
            if (S.community) await pushPoints({ ...S }, true);
            await refresh();
          } catch (err) {
            setNote((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

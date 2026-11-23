import { syncTeam } from '../domain/pro';
import { useStore } from '../state/store';

/** Com personal e nutricionista na NEFESH: autorizar que vejam o essencial um do outro. */
export function TeamToggle() {
  const { S, update, toast } = useStore();
  if (!S.proLink || !S.nutriLink) return null;
  return (
    <label className="check" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={!!S.teamShare} onChange={async (e) => {
        const on = e.target.checked;
        try {
          await syncTeam(S, on);
          update((d) => { d.teamShare = on; });
          toast(on ? `${S.proLink!.pro} e ${S.nutriLink!.pro} passam a ver o essencial um do outro.` : 'Deixaram de ver o que o outro definiu.');
        } catch (err) { toast((err as Error).message); }
      }} />
      <span className="small"><b>Os meus profissionais trabalham em equipa</b><br />
        <span className="mute">{S.nutriLink.pro} vê o seu treino (divisão e quantos treinos fez) e {S.proLink.pro} vê as suas metas de alimentação, horários das refeições e jejum. Nada do diário, notas, ciclo ou medicação.</span>
      </span>
    </label>
  );
}

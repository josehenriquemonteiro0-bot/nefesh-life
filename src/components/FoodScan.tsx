import { useRef, useState } from 'react';
import { BarcodeScan } from './BarcodeScan';
import { DecimalInput } from './DecimalInput';
import { findProduct, productNotes, rememberScanned, scannedEntry, type ScannedFood } from '../domain/barcode';
import { readLabel } from '../domain/docread';
import { fmtNum } from '../domain/dates';
import type { FoodEntry } from '../domain/foods';
import { useStore } from '../state/store';

const NUTRI_COLOR: Record<string, string> = { A: '#038141', B: '#85bb2f', C: '#fecb02', D: '#ee8100', E: '#e63e11' };

/** Produto lido: valores do rótulo, avisos e a quantidade a registar. */
export function ScannedProduct({ food, hide, onAdd, onBack }: { food: ScannedFood; hide: boolean; onAdd: (e: FoodEntry) => void; onBack: () => void }) {
  const { S } = useStore();
  const base = food.serving ?? 100;
  const [g, setG] = useState<number | undefined>(base);
  const e = g ? scannedEntry(food, g) : null;
  const notes = productNotes(food, S);
  return (
    <>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginTop: 12, justifyContent: 'flex-start' }}>
        {food.img && <img src={food.img} alt="" className="scan-img" />}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{food.name}</h3>
          <p className="small mute" style={{ margin: '2px 0 0' }}>
            {food.brand ? `${food.brand} · ` : ''}{hide ? '' : `${food.kcal} kcal por 100 g`}
            {food.servingText ? ` · porção: ${food.servingText}` : ''}
          </p>
          <div className="row" style={{ gap: 6, justifyContent: 'flex-start', marginTop: 6 }}>
            {food.nutri && <span className="nutri-badge" style={{ background: NUTRI_COLOR[food.nutri] }}>Nutri-Score {food.nutri}</span>}
            {food.nova && <span className="nova-badge">NOVA {food.nova}</span>}
            <span className="small mute">{food.source === 'off' ? 'Fonte: Open Food Facts' : 'Lido do rótulo'}</span>
          </div>
        </div>
      </div>
      {notes.map((n) => <p key={n.text} className={`small med-warn ${n.level === 'alto' ? 'alto' : 'medio'}`}>{n.level === 'alto' ? '⚠️ ' : ''}{n.text}</p>)}
      <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Quantidade">
        {(food.serving ? [0.5, 1, 2].map((k) => [k * food.serving!, k === 1 ? `1 porção (${fmtNum(food.serving!)} g)` : k === 0.5 ? '½ porção' : '2 porções'] as const) : [[50, '50 g'], [100, '100 g'], [200, '200 g']] as const).map(([v, t]) => (
          <button key={t} className={`chip sm ${g === v ? 'on' : ''}`} aria-pressed={g === v} onClick={() => setG(v)}>{t}</button>
        ))}
      </div>
      <label className="measure" style={{ margin: '10px 0 12px' }}>
        <span><b>Ou em gramas</b><span className="small mute">ml nas bebidas</span></span>
        <span className="measure-in"><DecimalInput value={g} onValue={setG} aria-label="Gramas" />g</span>
      </label>
      {e && (
        <div className="macros" style={{ marginBottom: 14 }}>
          {!hide && <span><b>{e.kcal}</b> kcal</span>}
          <span><b>{fmtNum(e.p)} g</b> proteína</span>
          <span><b>{fmtNum(e.c)} g</b> hidratos</span>
          <span><b>{fmtNum(e.f)} g</b> gordura</span>
        </div>
      )}
      <button className="btn full" disabled={!e} onClick={() => e && onAdd(e)}>Adicionar</button>
      <p />
      <button className="btn ghost full" onClick={onBack}>Ler outro</button>
    </>
  );
}

/** Do código ao produto: Open Food Facts, os produtos já lidos ou a foto da tabela nutricional. */
export function FoodScan({ hide, onAdd, onClose }: { hide: boolean; onAdd: (e: FoodEntry) => void; onClose: () => void }) {
  const { update } = useStore();
  const [scanning, setScanning] = useState(true);
  const [code, setCode] = useState('');
  const [food, setFood] = useState<ScannedFood | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'missing' | 'label'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const photo = useRef<HTMLInputElement>(null);
  const { S } = useStore();

  const lookup = async (c: string) => {
    setScanning(false);
    setCode(c);
    setErr(null);
    setState('busy');
    try {
      const f = await findProduct(c, S);
      if (f) {
        setFood(f);
        update((d) => rememberScanned(d, f));
        setState('idle');
      } else setState('missing');
    } catch (e) {
      setErr((e as Error).message);
      setState('idle');
    }
  };

  if (scanning) return <BarcodeScan onCode={lookup} onClose={onClose} />;
  if (food)
    return (
      <ScannedProduct
        food={food}
        hide={hide}
        onAdd={onAdd}
        onBack={() => {
          setFood(null);
          setScanning(true);
        }}
      />
    );
  return (
    <div style={{ marginTop: 12 }}>
      {state === 'busy' && <p className="small mute">A procurar o produto {code}…</p>}
      {state === 'label' && <p className="small mute">A ler a tabela nutricional…</p>}
      {err && <p className="small warn-t">{err}</p>}
      {state === 'missing' && (
        <>
          <p className="small">Este produto ({code}) ainda não está na base de dados. Fotografe a <b>tabela nutricional</b> da embalagem: a app lê-a e guarda o produto para a próxima vez.</p>
          <button className="btn full" onClick={() => photo.current?.click()}>📷 Fotografar ou escolher a tabela nutricional</button>
        </>
      )}
      <input
        ref={photo}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setErr(null);
          setState('label');
          try {
            const food = await readLabel(f, code);
            update((d) => rememberScanned(d, food));
            setFood(food);
            setState('idle');
          } catch (er) {
            setErr((er as Error).message);
            setState('missing');
          }
        }}
      />
      <p />
      <button className="btn ghost full" onClick={() => setScanning(true)}>Ler outro código</button>
    </div>
  );
}

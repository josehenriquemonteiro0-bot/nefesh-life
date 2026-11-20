import { useEffect, useRef, useState } from 'react';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { PRODUCTS, capsEquivalent, doseNutrients, lotFor, parseScan, type LotAnalysis, type ProductId, type ScanResult } from '../domain/lots';
import { useStore } from '../state/store';
import { getAuth } from '../domain/account';
import { registerBottle } from '../domain/social';

const POS_LABEL: Record<LotAnalysis['values'][number]['pos'], [string, string]> = {
  acima: ['Acima da referência', 'pos-up'],
  alinhado: ['Alinhado', 'pos-ok'],
  abaixo: ['Abaixo da referência', 'pos-low'],
  usp: ['Acima do mínimo USP', 'pos-ok'],
  base: ['Linha de base', 'pos-base'],
};

/** Análises do lote e o que a dose diária fornece. */
export function LotDetails({ lot, doseGrams }: { lot: LotAnalysis; doseGrams?: number }) {
  return (
    <>
      <p className="small mute" style={{ margin: '0 0 10px' }}>
        Laudo <b>{lot.code}</b> · {lot.lab} · {shortDate(lot.date)} {lot.date.slice(0, 4)}
      </p>
      <div className="lotvals">
        {lot.values.map((v) => (
          <div key={v.key} className="lotval">
            <div className="row" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 600 }}>{v.label}</span>
              <span className={`pos ${POS_LABEL[v.pos][1]}`}>{POS_LABEL[v.pos][0]}</span>
            </div>
            <b>{v.value.toLocaleString('pt-PT')} <small>{v.unit}</small></b>
            <span className="small mute">{v.ref}</span>
          </div>
        ))}
      </div>
      {doseGrams ? (
        <>
          <h3 style={{ marginTop: 16 }}>O que a sua dose de {fmtNum(doseGrams)} g fornece</h3>
          <div className="nrv">
            {doseNutrients(lot, doseGrams).map((n) => (
              <div key={n.key}>
                <span>{n.label}</span>
                <b>{n.mg < 1 ? fmtNum(n.mg.toFixed(2)) : fmtNum(n.mg.toFixed(1))} mg</b>
                <span className="mute">{fmtNum(n.pct.toFixed(1))}% VRN</span>
              </div>
            ))}
          </div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>VRN: valor de referência de nutrientes da UE para um adulto.</p>
        </>
      ) : null}
      {lot.notes.map((n) => (
        <p key={n} className="small mute" style={{ margin: '8px 0 0' }}>{n}</p>
      ))}
    </>
  );
}

function Camera({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmara');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const { default: jsQR } = await import('jsqr');
        const tick = () => {
          if (stopped) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
            const w = 480;
            const h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              navigator.vibrate?.(60);
              onCode(code.data);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError('Não foi possível abrir a câmara. Autorize o acesso nas definições do navegador ou introduza o código à mão.');
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  if (error) return <p className="small warn-t">{error}</p>;
  return (
    <div className="cam">
      <video ref={video} playsInline muted />
      <div className="cam-frame" aria-hidden="true" />
    </div>
  );
}

/** Ler o QR do frasco, ver as análises do lote e somar o frasco ao stock. */
export function BottleSheet({ onClose, doseGrams }: { onClose: () => void; doseGrams?: number }) {
  const { update, toast } = useStore();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [manual, setManual] = useState('');
  const [product, setProduct] = useState<ProductId>('caps');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accept = (raw: string) => {
    const r = parseScan(raw);
    setScan(r);
    if (r.product) setProduct(r.product);
  };

  const lot = lotFor(scan?.code);
  const add = () => {
    const caps = capsEquivalent(product);
    update((d) => {
      d.stockCaps += caps;
      d.bottles = [...(d.bottles || []), { at: todayKey(), product, code: scan?.code ?? null, url: scan?.url ?? null }];
    });
    toast(`${PRODUCTS[product].name} adicionado ao stock.`);
    // com conta, o frasco conta para a verificação dos pontos da Spirulina
    if (getAuth()) registerBottle(scan?.code ?? null, product).catch(() => undefined);
    onClose();
  };

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Frasco NEFESH">
        <div className="row">
          <h2 style={{ margin: 0 }}>{scan ? 'O seu frasco' : 'Ler o QR do frasco'}</h2>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>

        {!scan ? (
          <>
            <p className="small mute">Aponte a câmara para o QR code no rótulo. Mostramos as análises do lote e somamos o frasco ao seu stock.</p>
            <Camera onCode={accept} />
            <form
              className="row"
              style={{ marginTop: 14, gap: 8, flexWrap: 'nowrap' }}
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) accept(manual);
              }}
            >
              <input className="field sm" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ou escreva o código do lote" aria-label="Código do lote" />
              <button className="btn sm" type="submit" disabled={!manual.trim()}>OK</button>
            </form>
            <p className="small mute" style={{ marginTop: 8 }}>Sem frasco à mão? Experimente o código <button className="link small inline" onClick={() => accept('GCL_26_1372')}>GCL_26_1372</button>.</p>
          </>
        ) : (
          <>
            {lot ? (
              <section className="card" style={{ marginTop: 12 }}>
                <h3>Análises do lote</h3>
                <LotDetails lot={lot} doseGrams={doseGrams} />
              </section>
            ) : (
              <section className="card" style={{ marginTop: 12 }}>
                <h3>{scan.code ? `Lote ${scan.code}` : 'Código lido'}</h3>
                <p className="small mute" style={{ margin: 0 }}>
                  {scan.code
                    ? 'Ainda não temos as análises deste lote na app.'
                    : 'Não encontrámos um código de lote neste QR.'}
                  {scan.url ? ' Pode abrir o laudo diretamente na página da NEFESH.' : ''}
                </p>
              </section>
            )}
            {scan.url && (
              <a className="btn ghost full" href={scan.url} target="_blank" rel="noopener" style={{ marginBottom: 14 }}>Abrir o laudo completo ↗</a>
            )}
            <h3>Que produto é?</h3>
            <div className="opts" style={{ marginBottom: 14 }}>
              {(Object.keys(PRODUCTS) as ProductId[]).map((p) => (
                <button key={p} className={`opt ${product === p ? 'on' : ''}`} aria-pressed={product === p} onClick={() => setProduct(p)}>
                  {PRODUCTS[p].name}
                  <span className="small mute" style={{ display: 'block', fontWeight: 500 }}>{PRODUCTS[p].unit} · rótulo: até {PRODUCTS[p].dailyText} por dia</span>
                </button>
              ))}
            </div>
            <button className="btn full" onClick={add}>Adicionar ao meu stock</button>
            <p />
            <button className="btn ghost full" onClick={() => setScan(null)}>Ler outro código</button>
          </>
        )}
      </div>
    </div>
  );
}

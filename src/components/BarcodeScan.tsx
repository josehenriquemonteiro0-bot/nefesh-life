import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * Leitor de código de barras pela câmara traseira. Usa o leitor do telemóvel quando existe
 * (Android/Chrome); no iPhone usa a biblioteca ZXing, carregada só nesta altura.
 * Também deixa escrever o número à mão.
 */
export function BarcodeScan({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    const found = (code: string) => {
      if (done.current || !/^\d{8,14}$/.test(code)) return;
      done.current = true;
      try {
        navigator.vibrate?.(60);
      } catch {
        /* sem vibração */
      }
      stop();
      onCode(code);
    };
    (async () => {
      const v = video.current;
      if (!v) return;
      const BD = (window as unknown as { BarcodeDetector?: DetectorCtor & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      try {
        if (BD && (await BD.getSupportedFormats?.())?.includes('ean_13')) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          v.srcObject = stream;
          await v.play();
          const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const id = window.setInterval(async () => {
            try {
              const r = await det.detect(v);
              if (r[0]) found(r[0].rawValue);
            } catch {
              /* frame ainda sem imagem */
            }
          }, 250);
          stop = () => {
            window.clearInterval(id);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' }, audio: false }, v, (result) => {
            if (result) found(result.getText());
          });
          if (cancelled) return controls.stop();
          stop = () => controls.stop();
        }
      } catch (e) {
        const name = (e as DOMException)?.name;
        setErr(name === 'NotAllowedError' || name === 'SecurityError' ? 'A câmara não foi autorizada. Autorize a câmara nas definições do telemóvel, ou escreva o número do código em baixo.' : 'Não foi possível abrir a câmara. Escreva o número do código em baixo.');
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scan-overlay" role="dialog" aria-label="Ler código de barras">
      <div className="scan-video">
        <video ref={video} playsInline muted />
        <div className="scan-frame" aria-hidden="true" />
      </div>
      <p className="small" style={{ margin: '10px 0' }}>{err ?? 'Aponte ao código de barras da embalagem.'}</p>
      <form
        className="row"
        style={{ gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault();
          const c = typed.replace(/\D/g, '');
          if (/^\d{8,14}$/.test(c)) {
            done.current = true;
            onCode(c);
          }
        }}
      >
        <input className="field sm" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ou escreva o número do código" aria-label="Número do código de barras" />
        <button className="btn sm" disabled={!/^\d{8,14}$/.test(typed.replace(/\D/g, ''))}>OK</button>
      </form>
      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onClose}>Fechar</button>
    </div>
  );
}

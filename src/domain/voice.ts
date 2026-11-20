/**
 * Voz (especificação v2, secção 5): fala → texto com o reconhecimento de voz do próprio
 * telemóvel (sem custo e sem enviar áudio para servidores da NEFESH), e leitura das
 * respostas em voz alta. O texto ouvido segue pelo mesmo caminho do Coach.
 */
import type { AppState } from './types';

export type VoiceLang = 'pt-PT' | 'pt-BR';

interface RecResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Rec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecCtor = new () => Rec;

const ctor = (): RecCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechSupported = () => !!ctor();
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Língua da voz: a escolhida no Coach, ou a do telemóvel (Brasil → pt-BR; resto → pt-PT). */
export function voiceLang(S: Pick<AppState, 'voiceLang'>, nav = typeof navigator !== 'undefined' ? navigator.language : 'pt-PT'): VoiceLang {
  if (S.voiceLang) return S.voiceLang;
  return /^pt-BR/i.test(nav ?? '') ? 'pt-BR' : 'pt-PT';
}

export const VOICE_ERRORS: Record<string, string> = {
  'not-allowed': 'O microfone está bloqueado. Autorize o microfone para esta app nas definições do telemóvel.',
  'service-not-allowed': 'O reconhecimento de voz não está disponível aqui. Use o microfone do teclado 🎤 para ditar.',
  'no-speech': 'Não ouvi nada. Toque outra vez e fale perto do telemóvel.',
  'audio-capture': 'Não foi possível usar o microfone.',
  network: 'O reconhecimento de voz precisa de internet.',
};

export interface Listening {
  stop(): void;
  abort(): void;
}

/**
 * Começa a ouvir. Chama onText com o texto até agora (parcial) e onDone com o texto final
 * quando a pessoa para de falar (ou toca para parar).
 */
export function listen(lang: VoiceLang, h: { onText: (t: string) => void; onDone: (t: string) => void; onError: (msg: string, code: string) => void }): Listening | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  let latest = '';
  let failed = false;
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    latest = `${finalText}${interim}`.trim();
    h.onText(latest);
  };
  rec.onerror = (e) => {
    if (e.error === 'aborted') return;
    failed = true;
    h.onError(VOICE_ERRORS[e.error] ?? 'Não foi possível ouvir. Tente outra vez.', e.error);
  };
  rec.onend = () => {
    if (!failed) h.onDone((finalText || latest).trim());
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop(), abort: () => rec.abort() };
}

/** Lê um texto em voz alta (respostas do Coach). */
export function speak(text: string, lang: VoiceLang) {
  if (!ttsSupported() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ''));
    u.lang = lang;
    const v = synth.getVoices().find((x) => x.lang?.replace('_', '-').toLowerCase() === lang.toLowerCase());
    if (v) u.voice = v;
    u.rate = 1.02;
    synth.speak(u);
  } catch {
    /* sem voz */
  }
}

export const stopSpeaking = () => {
  try {
    if (ttsSupported()) window.speechSynthesis.cancel();
  } catch {
    /* sem voz */
  }
};

/** Pedido para o Coach começar logo a ouvir (vindo do botão "Toca para falar" do Início). */
const LISTEN_KEY = 'nefesh-coach-ouvir';
export function requestListen() {
  try {
    sessionStorage.setItem(LISTEN_KEY, '1');
  } catch {
    /* sem armazenamento */
  }
}
export function takeListenRequest() {
  try {
    const v = sessionStorage.getItem(LISTEN_KEY) === '1';
    sessionStorage.removeItem(LISTEN_KEY);
    return v;
  } catch {
    return false;
  }
}

/** Último recurso, sem microfone na app: o ditado do teclado. */
export const KEYBOARD_DICTATION_HINT = 'Toque no 🎤 do teclado e fale: o texto aparece aqui e o Coach regista da mesma forma.';

// ——— gravação (iPhone e navegadores sem reconhecimento de voz) ———

export const recorderSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/** O iPhone usa sempre a gravação: o reconhecimento do Safari é bloqueado nas apps instaladas. */
export const shouldRecord = (ios: boolean) => recorderSupported() && (ios || !speechSupported());

/** Nível de som acima do qual consideramos que a pessoa está a falar (RMS 0–1). */
const SPEAKING = 0.035;
/** Silêncio depois de falar que termina a gravação. */
const SILENCE_MS = 1600;

/**
 * Grava a frase da pessoa e para sozinha quando ela se cala (ou ao fim de 60 s).
 * onDone recebe o áudio e se houve fala.
 */
export function record(h: { onDone: (audio: Blob, spoke: boolean) => void; onError: (msg: string) => void; onLevel?: (rms: number) => void }): Listening {
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let raf = 0;
  let timer = 0;
  let aborted = false;
  let stopped = false;
  let spoke = false;
  // o contexto de áudio tem de nascer no toque (regra do iPhone)
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AC ? new AC() : null;
  } catch {
    ctx = null;
  }
  const cleanup = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close().catch(() => {});
  };
  const finish = () => {
    stopped = true;
    if (rec && rec.state !== 'inactive') rec.stop();
    else cleanup();
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      cleanup();
      h.onError((e as DOMException)?.name === 'NotAllowedError' ? 'O microfone não foi autorizado. Toque outra vez e escolha Permitir (ou autorize nas definições do telemóvel).' : 'Não foi possível usar o microfone.');
      return;
    }
    if (stopped) return cleanup();
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported?.(m));
    const chunks: Blob[] = [];
    rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      cleanup();
      if (!aborted) h.onDone(new Blob(chunks, { type: rec?.mimeType || mime || 'audio/mp4' }), spoke || !ctx);
    };
    rec.start(250);
    timer = window.setTimeout(finish, 60000);
    if (!ctx) return;
    try {
      await ctx.resume();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const t0 = performance.now();
      let quietSince = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        h.onLevel?.(rms);
        if (rms > SPEAKING) {
          spoke = true;
          quietSince = 0;
        } else if (spoke) {
          quietSince ||= now;
          if (now - quietSince > SILENCE_MS) return finish();
        }
        // 8 s sem falar: desiste
        if (!spoke && now - t0 > 8000) return finish();
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* sem medição de som: para ao tocar outra vez ou ao fim de 60 s */
    }
  })();
  return {
    stop: finish,
    abort: () => {
      aborted = true;
      finish();
    },
  };
}

const toBase64 = (b: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });

/** Envia a gravação para o servidor (Whisper) e devolve o texto. */
export async function transcribe(audio: Blob, api: string, device: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${api}/voz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: await toBase64(audio), mime: audio.type, device }) });
  } catch {
    throw new Error('Sem ligação à internet. Tente outra vez.');
  }
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok) throw new Error(body.error || 'Não foi possível perceber a gravação. Tente outra vez ou escreva.');
  return String(body.text ?? '').trim();
}

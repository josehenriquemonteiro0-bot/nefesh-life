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

/**
 * No iPhone, com a app no ecrã principal, a Apple bloqueia muitas vezes o reconhecimento de
 * voz das páginas (mesmo com o microfone autorizado). Depois da primeira recusa, o botão do
 * microfone passa a abrir o teclado, onde o ditado 🎤 funciona sempre.
 */
const DICTATION_KEY = 'nefesh-voz-teclado';
export const KEYBOARD_DICTATION_HINT = 'Toque no 🎤 do teclado e fale: o texto aparece aqui e o Coach regista da mesma forma.';
export const preferKeyboardDictation = () => {
  try {
    return localStorage.getItem(DICTATION_KEY) === '1';
  } catch {
    return false;
  }
};
export function setPreferKeyboardDictation(on: boolean) {
  try {
    if (on) localStorage.setItem(DICTATION_KEY, '1');
    else localStorage.removeItem(DICTATION_KEY);
  } catch {
    /* sem armazenamento */
  }
}
/** Recusa que, num iPhone, quer dizer "use o ditado do teclado". */
export const isBlockedByPlatform = (code: string, ios: boolean) => ios && (code === 'not-allowed' || code === 'service-not-allowed');

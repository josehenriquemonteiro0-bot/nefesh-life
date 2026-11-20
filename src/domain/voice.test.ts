import { afterEach, describe, expect, it, vi } from 'vitest';
import { listen, speechSupported, voiceLang } from './voice';

class FakeRec {
  static last: FakeRec;
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { FakeRec.last = this; }
  start() {}
  stop() { this.onend?.(); }
  abort() {}
  say(parts: [string, boolean][]) {
    this.onresult?.({ resultIndex: 0, results: parts.map(([t, f]) => ({ isFinal: f, 0: { transcript: t } })) });
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('voz', () => {
  it('escolhe pt-BR para telemóveis do Brasil e respeita a escolha da pessoa', () => {
    expect(voiceLang({}, 'pt-BR')).toBe('pt-BR');
    expect(voiceLang({}, 'pt-PT')).toBe('pt-PT');
    expect(voiceLang({}, 'en-US')).toBe('pt-PT');
    expect(voiceLang({ voiceLang: 'pt-BR' }, 'pt-PT')).toBe('pt-BR');
  });

  it('ouve, mostra o texto parcial e entrega o texto final', () => {
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeRec });
    expect(speechSupported()).toBe(true);
    const seen: string[] = [];
    let done = '';
    const l = listen('pt-BR', { onText: (t) => seen.push(t), onDone: (t) => (done = t), onError: () => {} });
    expect(FakeRec.last.lang).toBe('pt-BR');
    expect(FakeRec.last.interimResults).toBe(true);
    FakeRec.last.say([['tomei a', false]]);
    FakeRec.last.say([['tomei a Spirulina', true]]);
    l!.stop();
    expect(seen).toEqual(['tomei a', 'tomei a Spirulina']);
    expect(done).toBe('tomei a Spirulina');
  });

  it('explica os erros do microfone e não entrega texto', () => {
    vi.stubGlobal('window', { SpeechRecognition: FakeRec });
    let err = '';
    let done: string | null = null;
    listen('pt-PT', { onText: () => {}, onDone: (t) => (done = t), onError: (m) => (err = m) });
    FakeRec.last.onerror!({ error: 'not-allowed' });
    FakeRec.last.onend!();
    expect(err).toMatch(/microfone está bloqueado/);
    expect(done).toBeNull();
  });

  it('sem reconhecimento de voz no navegador, não começa', () => {
    vi.stubGlobal('window', {});
    expect(speechSupported()).toBe(false);
    expect(listen('pt-PT', { onText: () => {}, onDone: () => {}, onError: () => {} })).toBeNull();
  });
});

describe('voz no iPhone', () => {
  it('o iPhone grava (o Safari bloqueia o reconhecimento nas apps instaladas)', async () => {
    const { shouldRecord } = await import('./voice');
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } });
    vi.stubGlobal('MediaRecorder', class {});
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeRec });
    expect(shouldRecord(true)).toBe(true);
    expect(shouldRecord(false)).toBe(false); // Android com Chrome: reconhecimento direto
    vi.stubGlobal('window', {});
    expect(shouldRecord(false)).toBe(true); // sem reconhecimento: grava
  });
});

describe('microfone bloqueado', () => {
  it('dá os passos certos para iPhone e Android', async () => {
    const { micBlockedHelp } = await import('./voice');
    expect(micBlockedHelp('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toMatch(/Definições → Safari → Microfone/);
    expect(micBlockedHelp('Mozilla/5.0 (Linux; Android 14)')).toMatch(/Informações da app → Permissões → Microfone/);
  });
});

/**
 * Voz → texto para o Coach (especificação v2, secção 5).
 *
 * No iPhone, a Apple bloqueia o reconhecimento de voz do Safari nas apps instaladas, mas
 * deixa gravar o microfone. A app grava a frase (até 60 s) e envia-a para aqui; o Whisper
 * do Workers AI (Cloudflare) devolve o texto, que segue pelo caminho normal do Coach.
 * O áudio não é guardado.
 */
import { check, count, type CounterStore, type Limits } from './limits';

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export const VOICE_MODEL = '@cf/openai/whisper-large-v3-turbo';
export const VOICE_LIMITS: Limits = { device: 80, ip: 240, global: 5000 };
/** ~60 s de áudio comprimido (AAC/Opus) em base64 */
export const MAX_AUDIO_CHARS = 2_800_000;

/** Palavras que o Whisper deve reconhecer bem (marca e produtos). */
const PROMPT = 'Spirulina NEFESH, cápsulas, copos de água, pequeno-almoço, café da manhã, almoço, lanche, jantar, treino, ginásio, academia, dormi, horas.';

export async function handleVoice(body: Record<string, unknown>, ai: AiBinding | undefined, store: CounterStore, device: string, ip: string, json: (b: unknown, s: number) => Response) {
  if (!ai) return json({ error: 'A voz ainda não está disponível. Tente mais tarde.' }, 503);
  const audio = String(body.audio ?? '');
  if (!audio || audio.length > MAX_AUDIO_CHARS || !/^[A-Za-z0-9+/=]+$/.test(audio)) return json({ error: 'Gravação inválida ou demasiado longa (máximo 1 minuto).' }, 400);
  const allowed = await check(store, VOICE_LIMITS, device, ip, new Date(), 'v');
  if (!allowed.ok) return json({ error: 'Já usou muito a voz hoje. Pode continuar a escrever.' }, 429);
  const r = (await ai.run(VOICE_MODEL, { audio, language: 'pt', task: 'transcribe', vad_filter: true, initial_prompt: PROMPT })) as { text?: string };
  const text = String(r?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  await count(store, VOICE_LIMITS, device, ip, new Date(), 'v');
  return json({ text }, 200);
}

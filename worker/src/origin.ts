/** Origem permitida (CORS): lista separada por vírgulas; "*" aceita letras, números, pontos e hífens. */
export function originAllowed(allowed: string | undefined, origin: string | null) {
  const list = (allowed ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!list.length) return true;
  if (!origin) return false;
  return list.some((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9.-]*')}$`, 'i').test(origin));
}

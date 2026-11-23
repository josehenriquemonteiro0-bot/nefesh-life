/** Nutricionistas e médicos usam o módulo de nutrição do NEFESH Pro. */
export const isNutriKind = (kind?: string | null) => kind === 'nutricionista' || kind === 'medico';

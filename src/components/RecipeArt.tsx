import type { Recipe } from '../domain/recipes';

/**
 * Ilustrações das receitas, desenhadas em SVG com as cores de cada uma.
 * Para trocar por fotografias, basta dar a cada receita um campo `photo`
 * e mostrar a imagem no lugar deste componente.
 */

const NIBS = [
  [22, 18, 20], [34, 24, -30], [48, 16, 60], [60, 26, 10], [74, 20, -50], [86, 28, 35], [98, 18, -15], [110, 25, 70],
] as const;

function Nibs({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {NIBS.map(([nx, ny, r], i) => (
        <rect key={i} x={nx} y={ny} width={9} height={3} rx={1.5} fill={i % 2 ? '#1d4a2a' : '#2a5e34'} transform={`rotate(${r} ${nx + 4.5} ${ny + 1.5})`} />
      ))}
    </g>
  );
}

function Glass({ a }: { a: Art }) {
  return (
    <g>
      <ellipse cx="100" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.25)" />
      {/* palhinha */}
      <path d="M112 14 L104 50" stroke="#f3f0e6" strokeWidth="5" strokeLinecap="round" />
      <path d="M112 14 L104 50" stroke={a.accent} strokeWidth="5" strokeLinecap="round" strokeDasharray="4 5" />
      {/* copo */}
      <path d="M70 34 H130 L124 108 a6 6 0 0 1 -6 5 H82 a6 6 0 0 1 -6 -5 Z" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <path d="M73 46 H127 L122 106 a5 5 0 0 1 -5 4 H83 a5 5 0 0 1 -5 -4 Z" fill={a.main} />
      <path d="M73 46 H127 L126 56 H74 Z" fill={a.top ?? a.main} opacity=".9" />
      <path d="M80 52 L84 100" stroke="rgba(255,255,255,.35)" strokeWidth="4" strokeLinecap="round" />
      {/* guarnição */}
      {a.garnish === 'lime' && (
        <g transform="translate(128 34)">
          <circle r="13" fill="#9ccc4a" stroke="#e8f5c8" strokeWidth="2.5" />
          {[0, 60, 120, 180, 240, 300].map((r) => <path key={r} d="M0 0 L0 -10" stroke="#e8f5c8" strokeWidth="1.5" transform={`rotate(${r})`} />)}
        </g>
      )}
      {a.garnish === 'mint' && (
        <g transform="translate(86 38)">
          <path d="M0 0 C-14 -6 -14 -20 0 -22 C4 -12 4 -6 0 0Z" fill="#3fbf6a" />
          <path d="M2 -2 C14 -10 22 -4 18 6 C10 6 6 4 2 -2Z" fill="#2fa35a" />
        </g>
      )}
      {a.garnish === 'fruit' && <circle cx="128" cy="36" r="10" fill={a.accent} stroke="rgba(255,255,255,.4)" strokeWidth="2" />}
    </g>
  );
}

function Bowl({ a }: { a: Art }) {
  const tops = a.toppings ?? [];
  return (
    <g>
      <ellipse cx="100" cy="112" rx="56" ry="6" fill="rgba(0,0,0,.25)" />
      <ellipse cx="100" cy="56" rx="60" ry="16" fill={a.main} />
      <path d="M40 56 a60 52 0 0 0 120 0 Z" fill={a.bowl ?? '#efe9dc'} />
      <path d="M40 56 a60 16 0 0 0 120 0" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="2" />
      {tops.map((c, i) => {
        const x = 62 + ((i * 37) % 76);
        const y = 48 + ((i * 13) % 14);
        return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 6 : 4.5} fill={c} stroke="rgba(0,0,0,.15)" />;
      })}
      {a.nibs && <Nibs x={50} y={34} scale={0.85} />}
      {a.chips && (
        <g>
          <path d="M150 30 l22 6 l-14 18 Z" fill="#e8c46a" stroke="#c99b3a" />
          <path d="M28 34 l22 -4 l-6 22 Z" fill="#e8c46a" stroke="#c99b3a" />
        </g>
      )}
    </g>
  );
}

function Jar({ a }: { a: Art }) {
  return (
    <g>
      <ellipse cx="100" cy="113" rx="34" ry="5" fill="rgba(0,0,0,.25)" />
      <rect x="72" y="18" width="56" height="12" rx="3" fill="#c9a85c" />
      <path d="M70 30 H130 V104 a8 8 0 0 1 -8 8 H78 a8 8 0 0 1 -8 -8 Z" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
      <path d="M73 70 H127 V103 a6 6 0 0 1 -6 6 H79 a6 6 0 0 1 -6 -6 Z" fill="#e6d6b3" />
      <path d="M73 52 H127 V70 H73 Z" fill={a.main} />
      <path d="M73 42 H127 V52 H73 Z" fill={a.accent} />
      {[80, 92, 104, 116].map((x) => <circle key={x} cx={x} cy={84 + (x % 3) * 6} r="2" fill="#2b2b2b" opacity=".6" />)}
      <Nibs x={64} y={28} scale={0.55} />
    </g>
  );
}

function Plate({ a }: { a: Art }) {
  const tops = a.toppings ?? [];
  return (
    <g>
      <ellipse cx="100" cy="66" rx="78" ry="44" fill="rgba(0,0,0,.2)" transform="translate(0 4)" />
      <ellipse cx="100" cy="64" rx="78" ry="44" fill="#f3efe6" />
      <ellipse cx="100" cy="64" rx="60" ry="32" fill={a.main} />
      {tops.map((c, i) => {
        const ang = (i / tops.length) * Math.PI * 2;
        return <circle key={i} cx={100 + Math.cos(ang) * 36} cy={64 + Math.sin(ang) * 18} r={i % 2 ? 7 : 5.5} fill={c} stroke="rgba(0,0,0,.12)" />;
      })}
      {a.nibs && <Nibs x={44} y={48} scale={0.9} />}
    </g>
  );
}

function Toast({ a }: { a: Art }) {
  return (
    <g>
      <ellipse cx="100" cy="110" rx="62" ry="6" fill="rgba(0,0,0,.25)" />
      <path d="M44 104 V52 C44 26 70 16 100 16 C130 16 156 26 156 52 V104 Z" fill="#c98a45" />
      <path d="M52 98 V54 C52 32 74 24 100 24 C126 24 148 32 148 54 V98 Z" fill="#e9c58f" />
      <path d="M56 60 C70 46 84 54 98 46 C114 40 128 52 144 48 V90 C128 96 112 88 98 94 C84 98 70 90 56 94 Z" fill={a.main} />
      {[66, 82, 102, 120, 134].map((x, i) => <circle key={x} cx={x} cy={62 + (i % 2) * 14} r="1.8" fill="#f6f1e2" />)}
      <Nibs x={46} y={46} scale={0.85} />
    </g>
  );
}

function Balls({ a }: { a: Art }) {
  const pos = [[64, 78], [100, 82], [136, 78], [82, 50], [118, 50]];
  return (
    <g>
      <ellipse cx="100" cy="104" rx="70" ry="6" fill="rgba(0,0,0,.25)" />
      {pos.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="19" fill={a.main} />
          <circle cx={x - 6} cy={y - 7} r="5" fill="rgba(255,255,255,.18)" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x={x - 12 + ((k * 7) % 22)} y={y - 10 + ((k * 11) % 20)} width="4" height="1.6" rx=".8" fill={a.accent} transform={`rotate(${k * 37} ${x} ${y})`} />
          ))}
        </g>
      ))}
    </g>
  );
}

export interface Art {
  type: 'glass' | 'bowl' | 'jar' | 'plate' | 'toast' | 'balls';
  main: string;
  accent: string;
  top?: string;
  bowl?: string;
  garnish?: 'lime' | 'mint' | 'fruit';
  toppings?: string[];
  nibs?: boolean;
  chips?: boolean;
}

const DRAW = { glass: Glass, bowl: Bowl, jar: Jar, plate: Plate, toast: Toast, balls: Balls };

export function RecipeArt({ r, height = 120 }: { r: Recipe; height?: number }) {
  const Draw = DRAW[r.art.type];
  const id = `bg-${r.id}`;
  return (
    <svg viewBox="0 0 200 120" width="100%" height={height} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Ilustração: ${r.title}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={r.hue[0]} />
          <stop offset="1" stopColor={r.hue[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="120" fill={`url(#${id})`} />
      <circle cx="170" cy="18" r="40" fill="rgba(255,255,255,.06)" />
      <circle cx="20" cy="110" r="30" fill="rgba(0,0,0,.08)" />
      <Draw a={r.art} />
    </svg>
  );
}

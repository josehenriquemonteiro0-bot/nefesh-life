const PATHS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  quiz: (
    <>
      <path d="M12 3l8.5 6.2-3.2 10H6.7L3.5 9.2z" />
      <path d="M12 8l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" />
    </>
  ),
  check: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  evo: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" />,
  pros: <path d="M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" />,
  mic: <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />,
  mind: <path d="M9.5 4a3.5 3.5 0 0 0-3.4 4.3A3.5 3.5 0 0 0 5 14.5 3.5 3.5 0 0 0 9.5 20h.5V4zM14.5 4a3.5 3.5 0 0 1 3.4 4.3 3.5 3.5 0 0 1 1.1 6.2 3.5 3.5 0 0 1-4.5 5.5H14V4z" />,
  body: <path d="M12 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM5 9.5h14M12 9.5v5M12 14.5l-3.5 7M12 14.5l3.5 7" />,
  care: <path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6zM12 9v6M9 12h6" />,
  cycle: <path d="M12 3a9 9 0 1 1-9 9M12 3v4M12 3l-3 2.5M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z" />,
  pill: <path d="M8.5 20.5a5 5 0 0 1-3.5-8.5l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-3.5 1.5zM8.5 8.5l7 7" />,
  timeline: <path d="M6 3v18M6 6h12M6 12h9M6 18h12M3.5 6h5M3.5 12h5M3.5 18h5" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  cam: <path d="M4 8h3l1.5-2h7L17 8h3v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  user: <path d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20a7.5 7.5 0 0 1 15 0" />,
  ok: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  steps: <path d="M7 17c-2 0-3-1.5-3-4s1-6 3-6 2.5 3 2.5 5-1 5-2.5 5zM16 21c-1.5 0-2.5-3-2.5-5s.5-5 2.5-5 3 3.5 3 6-1 4-3 4z" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  flame: <path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-6 4-10 2.5 1.5 4.5 4 4.5 7 1-1 1.5-2.2 1.5-3.5 2 1.8 3 4.2 3 6.5 0 3.4-2.5 6-6.5 6z" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  bottle: (
    <>
      <path d="M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3z" />
      <path d="M7 13h10" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  chart: <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" />,
  leaf: <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7" />,
  recipes: <path d="M3 11h18a9 9 0 0 1-18 0zM8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5M7 20h10" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM6.5 6.5h1v1h-1zM16.5 6.5h1v1h-1zM6.5 16.5h1v1h-1z" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, color = 'currentColor', width = 1.8 }: { name: IconName; color?: string; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

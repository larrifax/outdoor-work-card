import { svg, type TemplateResult } from "lit";

type Icon = (size?: number) => TemplateResult;

const wrap = (paths: TemplateResult, s: number) =>
  svg`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  wrench: (s = 20) =>
    wrap(
      svg`<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.9-.6-.6-2.9 2.5-2.5Z"/>`,
      s,
    ),
  car: (s = 20) =>
    wrap(
      svg`<path d="M5 13l1.6-4.6A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.4L19 13"/><path d="M4 13h16v4h-2v-1H6v1H4z"/>`,
      s,
    ),
  grass: (s = 18) =>
    wrap(
      svg`<path d="M3 21c0-6 2-10 5-13-1 5-1 9 0 13"/><path d="M11 21c0-7 2-12 4-16-1 6-1 11 0 16"/><path d="M19 21c0-5-1-9-3-12 0 4 0 8 1 12"/>`,
      s,
    ),
  roller: (s = 18) =>
    wrap(
      svg`<rect x="3" y="4" width="13" height="6" rx="1.5"/><path d="M16 7h4v5h-8v3"/><path d="M12 15v6"/>`,
      s,
    ),
  task: (s = 18) =>
    wrap(
      svg`<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>`,
      s,
    ),
  sun: (s = 20) =>
    wrap(
      svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
      s,
    ),
  moon: (s = 20) => wrap(svg`<path d="M20 14.5A7 7 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"/>`, s),
  drop: (s = 18) => wrap(svg`<path d="M12 3S6 10 6 15a6 6 0 0 0 12 0C18 10 12 3 12 3Z"/>`, s),
  rain: (s = 20) =>
    wrap(
      svg`<path d="M6 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.2A3.5 3.5 0 0 1 17 15Z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>`,
      s,
    ),
  info: (s = 14) =>
    wrap(svg`<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/>`, s),
  question: (s = 15) =>
    wrap(
      svg`<circle cx="12" cy="12" r="9.5"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><path d="M12 17.5h.01"/>`,
      s,
    ),
  alert: (s = 16) =>
    wrap(svg`<path d="M12 3l10 18H2z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/>`, s),
  arrow: (s = 16) => wrap(svg`<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>`, s),
  bike: (s = 22) =>
    wrap(
      svg`<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l3-8h6l4 8"/><path d="M8.5 9h-2"/><path d="M12 17l2.5-8"/><path d="M13 6h3"/>`,
      s,
    ),
  wind: (s = 11) =>
    wrap(
      svg`<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 13h15a3 3 0 1 1-3 3"/><path d="M3 18h7"/>`,
      s,
    ),
} satisfies Record<string, Icon>;

/** Pick an icon for a task by name; falls back to a generic check. */
export function taskIcon(name: string): Icon {
  const n = name.toLowerCase();
  if (/mow|lawn|grass|klipp|plen/.test(n)) return icons.grass;
  if (/paint|stain|mal|beis/.test(n)) return icons.roller;
  return icons.task;
}

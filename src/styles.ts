import { css } from "lit";

export const styles = css`
  :host {
    --owc-amber: #f5b942;
    --owc-red: #ef6b6b;
    --owc-text: var(--primary-text-color, #e8eaed);
    --owc-text-2: var(--secondary-text-color, #9aa2ad);
    --owc-line: color-mix(in srgb, var(--owc-text) 9%, transparent);
    --owc-soft: color-mix(in srgb, var(--owc-text) 4%, transparent);
    --owc-dim: color-mix(in srgb, var(--owc-text) 20%, transparent);
    --owc-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    /* Text variants: mixed toward the theme text colour so they stay legible on light themes. */
    --owc-accent-text: color-mix(in srgb, var(--owc-accent) 70%, var(--owc-text));
    --owc-amber-text: color-mix(in srgb, var(--owc-amber) 62%, var(--owc-text));
    --owc-red-text: color-mix(in srgb, var(--owc-red) 75%, var(--owc-text));
    display: block;
  }
  ha-card {
    padding: 18px 20px 16px;
    color: var(--owc-text);
    box-sizing: border-box;
  }
  * {
    box-sizing: border-box;
  }

  /* ----- header ----- */
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head .badge {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--owc-accent) 16%, transparent);
    color: var(--owc-accent);
  }
  .head .titles {
    flex: 1 1 auto;
    min-width: 0;
  }
  .head .title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }
  .head .sub {
    font-size: 12px;
    color: var(--owc-text-2);
    margin-top: 2px;
  }
  .head .updated {
    font-size: 10px;
    color: var(--owc-text-2);
    text-align: right;
    flex: 0 0 auto;
  }

  /* ----- hero ----- */
  .hero {
    margin-top: 16px;
    border-radius: 14px;
    padding: 14px 16px 15px;
    border: 1px solid;
  }
  .hero.ok {
    background: color-mix(in srgb, var(--owc-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--owc-accent) 24%, transparent);
  }
  .hero.warn {
    background: color-mix(in srgb, var(--owc-amber) 9%, transparent);
    border-color: color-mix(in srgb, var(--owc-amber) 24%, transparent);
  }
  .hero.bad {
    background: color-mix(in srgb, var(--owc-red) 9%, transparent);
    border-color: color-mix(in srgb, var(--owc-red) 24%, transparent);
  }
  .pill {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .pill .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
  .ok .pill {
    color: var(--owc-accent-text);
  }
  .warn .pill {
    color: var(--owc-amber-text);
  }
  .bad .pill {
    color: var(--owc-red-text);
  }

  .task {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: 12px;
  }
  .task + .task {
    border-top: 1px solid var(--owc-line);
    padding-top: 12px;
  }
  .task .ico {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--owc-soft);
  }
  .task .ico.on {
    color: var(--owc-accent-text);
  }
  .task .ico.off {
    color: var(--owc-text-2);
  }
  .task .body {
    flex: 1 1 auto;
    min-width: 0;
  }
  .task .k {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }
  .task .v {
    font-size: 17px;
    font-weight: 700;
    margin-top: 2px;
    line-height: 1.2;
  }
  .task .d {
    font-size: 12px;
    color: var(--owc-text-2);
    margin-top: 3px;
    line-height: 1.4;
  }

  .big {
    margin-top: 8px;
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .big .day {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .big .n {
    font-family: var(--owc-mono);
    font-size: 17px;
    font-weight: 600;
  }
  .ok .big .n {
    color: var(--owc-accent-text);
  }
  .bad .big .n {
    color: var(--owc-red-text);
  }
  .why {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--owc-text-2);
  }

  /* ----- section label ----- */
  .sect {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20px;
  }
  .sect .l {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }
  .sect .r {
    font-size: 11px;
    color: var(--owc-text-2);
  }

  /* ----- work table ----- */
  .grid {
    display: grid;
    grid-template-columns: 44px minmax(60px, 1fr) 56px minmax(60px, 1fr) auto;
    column-gap: 8px;
    align-items: center;
  }
  .cols {
    margin-top: 12px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }
  .cols .ra {
    text-align: right;
  }
  .rows {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    padding: 6px 4px;
    margin: 0 -4px;
    border-radius: 8px;
  }
  .row.today {
    background: var(--owc-soft);
  }
  .row.far {
    opacity: 0.72;
  }
  .row .dn {
    font-size: 13px;
    font-weight: 600;
  }
  .row.today .dn {
    color: var(--owc-accent-text);
  }
  .row .dd {
    font-size: 10px;
    color: var(--owc-text-2);
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .cell.r {
    align-items: flex-end;
  }
  .cell.l {
    align-items: flex-start;
  }
  .bar {
    height: 8px;
    border-radius: 3px;
    min-width: 4px;
  }
  .bar.before {
    border-radius: 4px 2px 2px 4px;
  }
  .bar.after {
    border-radius: 2px 4px 4px 2px;
  }
  .num {
    font-family: var(--owc-mono);
    font-size: 10px;
    font-weight: 500;
  }
  .pills {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }
  .tp {
    font-size: 10px;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 999px;
    line-height: 1.2;
    border: 1px solid;
    white-space: nowrap;
  }
  .tp.on {
    background: var(--owc-accent);
    border-color: var(--owc-accent);
    color: #0d1117;
  }
  .tp.off {
    background: transparent;
    border-color: var(--owc-line);
    color: var(--owc-text-2);
    opacity: 0.75;
  }

  /* ----- wash strip ----- */
  .strip {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }
  .strip.d8 {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
  .strip.d9 {
    grid-template-columns: repeat(9, minmax(0, 1fr));
  }
  .strip.d10 {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 2px 10px;
    border-radius: 9px;
    border: 1px solid transparent;
  }
  .col.best {
    background: color-mix(in srgb, var(--owc-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--owc-accent) 45%, transparent);
  }
  .col.far {
    opacity: 0.72;
  }
  .tag {
    height: 14px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }
  .col.best .tag {
    color: var(--owc-accent-text);
  }
  .col .dn {
    font-size: 13px;
    font-weight: 600;
  }
  .col .dd {
    font-size: 11px;
    color: var(--owc-text-2);
  }
  .col .ic {
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ic.sun {
    color: var(--owc-accent-text);
  }
  .ic.moon,
  .ic.drop {
    color: color-mix(in srgb, var(--owc-accent) 60%, var(--owc-text-2));
  }
  .ic.rain {
    color: var(--owc-red-text);
  }
  .mm {
    font-size: 10px;
    font-weight: 600;
    color: var(--owc-text-2);
  }
  .mm.bad {
    color: var(--owc-red-text);
  }
  .when {
    font-size: 9px;
    color: var(--owc-text-2);
  }
  .out {
    width: 100%;
    margin-top: 2px;
    padding-top: 6px;
    border-top: 1px solid var(--owc-line);
    display: flex;
    justify-content: center;
  }
  .out span {
    font-family: var(--owc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--owc-text-2);
  }
  .col.best .out span {
    color: var(--owc-accent-text);
  }
  .out span.none {
    opacity: 0.5;
  }

  /* ----- footer / states ----- */
  .foot {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--owc-line);
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 11px;
    line-height: 1.5;
    color: var(--owc-text-2);
  }
  .foot svg {
    flex: 0 0 auto;
    margin-top: 1px;
  }
  .state {
    margin-top: 16px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--owc-soft);
    font-size: 13px;
    color: var(--owc-text-2);
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .state.err {
    color: var(--owc-red-text);
    background: color-mix(in srgb, var(--owc-red) 8%, transparent);
  }
  .state code {
    font-family: var(--owc-mono);
    font-size: 11px;
  }

  @media (max-width: 420px) {
    ha-card {
      padding: 14px 14px 12px;
    }
    .grid {
      grid-template-columns: 38px minmax(44px, 1fr) 48px minmax(44px, 1fr) auto;
      column-gap: 6px;
    }
    .big .day {
      font-size: 26px;
    }
  }
`;

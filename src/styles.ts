import { css } from "lit";

export const styles = css`
  :host {
    --owc-amber: #f5b942;
    --owc-red: #ef6b6b;
    --owc-danger: #c81e1e;
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
    --owc-danger-text: color-mix(in srgb, var(--owc-danger) 80%, var(--owc-text));
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
  .prov {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
    position: relative;
  }
  .prov .ts {
    font-family: var(--owc-mono);
    font-size: 11px;
    color: var(--owc-text-2);
  }
  .qbtn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--owc-line);
    background: transparent;
    color: var(--owc-text-2);
  }
  .qbtn:hover,
  .qbtn[aria-expanded="true"] {
    border-color: color-mix(in srgb, var(--owc-accent) 45%, transparent);
    background: color-mix(in srgb, var(--owc-accent) 14%, transparent);
    color: var(--owc-accent-text);
  }
  .qbtn:focus-visible {
    outline: 2px solid var(--owc-accent);
    outline-offset: 2px;
  }
  .pop {
    position: absolute;
    top: 36px;
    right: 0;
    z-index: 5;
    width: 256px;
    max-width: calc(100vw - 48px);
    text-align: left;
    background: var(--ha-card-background, var(--card-background-color, #1d222c));
    color: var(--owc-text);
    border: 1px solid var(--owc-line);
    border-radius: 12px;
    padding: 12px 14px 13px;
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
  }
  .pop::before {
    content: "";
    position: absolute;
    top: -6px;
    right: 9px;
    width: 10px;
    height: 10px;
    transform: rotate(45deg);
    background: inherit;
    border-left: 1px solid var(--owc-line);
    border-top: 1px solid var(--owc-line);
  }
  .pop .h {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }
  .pop .grid {
    margin-top: 8px;
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    row-gap: 6px;
    font-size: 12px;
    line-height: 1.4;
  }
  .pop .grid .k {
    color: var(--owc-text-2);
  }
  .pop .grid .v {
    color: var(--owc-text);
  }
  .pop .grid .v .mono {
    font-family: var(--owc-mono);
  }
  .pop .note {
    margin-top: 8px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--owc-text-2);
  }
  .pop .src {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--owc-line);
    font-size: 11px;
    line-height: 1.45;
    color: var(--owc-text-2);
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
  .hero.rec {
    background: color-mix(in srgb, var(--owc-accent) 10%, transparent);
    border-color: color-mix(in srgb, var(--owc-accent) 24%, transparent);
  }

  /* Design E: alert banner + labelled recommendation + trade-off line */
  .alert {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--owc-red) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--owc-red) 22%, transparent);
    font-size: 12px;
    line-height: 1.4;
    color: var(--owc-text-2);
  }
  .alert svg {
    flex: 0 0 auto;
    color: var(--owc-red-text);
  }
  .alert .lbl {
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--owc-red-text);
  }
  .alert + .hero {
    margin-top: 10px;
  }
  .hero .cap {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--owc-accent-text);
  }
  .hero.bad .cap {
    color: var(--owc-text-2);
  }
  .hero .cap + .big {
    margin-top: 4px;
  }
  .hero .big .day {
    font-size: 32px;
    line-height: 1.05;
  }
  .rec .big .n {
    color: var(--owc-accent-text);
  }
  .tradeoff {
    margin-top: 12px;
    padding-top: 11px;
    border-top: 1px solid color-mix(in srgb, var(--owc-accent) 22%, transparent);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--owc-text);
  }
  .tradeoff svg {
    flex: 0 0 auto;
    color: var(--owc-accent-text);
  }
  .tradeoff strong {
    font-weight: 700;
  }
  .tradeoff strong.gain {
    color: var(--owc-accent-text);
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
    margin-top: 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
  /* Dry-by: text only, same height as a bar + number cell. */
  .cell.dryby {
    min-height: 23px;
    justify-content: flex-end;
    white-space: nowrap;
    outline: none;
  }
  .cell.dryby .tip {
    text-align: left;
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
  .col .date {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .col .dn,
  .col .dd {
    text-box-trim: trim-both;
    text-box-edge: cap alphabetic;
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
  .ic.moon {
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
  .out span:not(.tip) {
    font-family: var(--owc-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--owc-text-2);
  }
  .col.best .out > span:not(.tip) {
    color: var(--owc-accent-text);
  }
  .out span.none {
    opacity: 0.5;
  }
  .out,
  .day {
    cursor: help;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .tip {
    position: fixed;
    position-area: top center;
    margin: 0 0 8px;
    inset: auto;
    width: max-content;
    max-width: 220px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--owc-text);
    color: var(--card-background-color, var(--ha-card-background, #fff));
    font-family: inherit;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.35;
    text-align: center;
    overflow: visible;
    opacity: 0;
    transform: scale(0.95);
    transition:
      opacity 0.15s,
      transform 0.15s,
      overlay 0.15s allow-discrete,
      display 0.15s allow-discrete;
  }
  .out .tip .stats {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 6px;
  }
  .out .tip .stats div {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .out .tip .stats span {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .out .tip .stats b {
    font-size: 15px;
    font-weight: 600;
  }
  .tip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    width: 10px;
    height: 10px;
    background: inherit;
    transform: translate(-50%, -50%) rotate(45deg);
    border-radius: 2px;
  }
  .tip:popover-open {
    opacity: 1;
    transform: scale(1);
  }
  @starting-style {
    .tip:popover-open {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  /* ----- commute popover extras ----- */
  .pop .scale {
    margin-top: 7px;
    display: grid;
    grid-template-columns: auto 1fr 1fr 1fr 1fr;
    column-gap: 8px;
    row-gap: 5px;
    font-size: 11px;
    line-height: 1.3;
    align-items: center;
  }
  .pop .scale .c0 {
    font-weight: 700;
    color: var(--owc-accent-text);
  }
  .pop .scale .c1 {
    font-weight: 700;
    color: var(--owc-amber-text);
  }
  .pop .scale .c2 {
    font-weight: 700;
    color: var(--owc-red-text);
  }
  .pop .scale .c3 {
    font-weight: 700;
    color: var(--owc-danger-text);
  }
  .pop .scale .k {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--owc-text-2);
  }
  .pop .grades {
    margin-top: 7px;
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 10px;
    row-gap: 4px;
    font-size: 11px;
    line-height: 1.4;
    align-items: center;
    color: var(--owc-text-2);
  }
  .pop .gb {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    color: #0d1117;
    font-weight: 700;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ----- commute ----- */
  .chero {
    margin-top: 16px;
    border-radius: 14px;
    padding: 14px 16px 15px;
    display: flex;
    align-items: center;
    gap: 16px;
    border: 1px solid;
  }
  .chero.l0 {
    background: color-mix(in srgb, var(--owc-accent) 9%, transparent);
    border-color: color-mix(in srgb, var(--owc-accent) 28%, transparent);
  }
  .chero.l1 {
    background: color-mix(in srgb, var(--owc-amber) 9%, transparent);
    border-color: color-mix(in srgb, var(--owc-amber) 28%, transparent);
  }
  .chero.l2 {
    background: color-mix(in srgb, var(--owc-red) 9%, transparent);
    border-color: color-mix(in srgb, var(--owc-red) 28%, transparent);
  }
  .gbadge {
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    font-weight: 700;
    color: #0d1117;
    letter-spacing: -0.02em;
  }
  .gbadge.l0 {
    background: var(--owc-accent);
  }
  .gbadge.l1 {
    background: var(--owc-amber);
  }
  .gbadge.l2 {
    background: var(--owc-red);
  }
  /* no forecast for some commute hour: grade unknown */
  .gbadge.unknown {
    background: none;
    border: 1px dashed var(--secondary-text-color);
    color: var(--secondary-text-color);
  }
  /* F: dark-red badge with light text so it reads apart from D/E */
  .gbadge.f,
  .pop .gb.f {
    background: var(--owc-danger);
    color: #fff;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--owc-danger) 35%, transparent);
  }
  .chero.f {
    background: color-mix(in srgb, var(--owc-danger) 16%, transparent);
    border-color: var(--owc-danger);
  }
  .chero.f .cap {
    color: var(--owc-danger-text);
  }
  .chero .gbadge {
    width: 56px;
    height: 56px;
    font-size: 30px;
  }
  .chero .cap {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .chero.l0 .cap {
    color: var(--owc-accent-text);
  }
  .chero.l1 .cap {
    color: var(--owc-amber-text);
  }
  .chero.l2 .cap {
    color: var(--owc-red-text);
  }
  .chero .t {
    margin-top: 3px;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.15;
  }
  .chero .d {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--owc-text-2);
  }
  .cgrid {
    display: grid;
    grid-template-columns: 38px 44px 2fr 1.1fr 2fr;
    column-gap: 10px;
    align-items: center;
  }
  .ccols {
    margin-top: 18px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--owc-text-2);
    align-items: end;
  }
  .ccols .c {
    text-align: center;
  }
  .ccols .dim {
    opacity: 0.65;
  }
  .crows {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .crow {
    padding: 7px 6px;
    margin: 0 -6px;
    border-radius: 10px;
  }
  .crow.today {
    background: var(--owc-soft);
  }
  .crow.far {
    opacity: 0.72;
  }
  .crow .dn {
    font-size: 13px;
    font-weight: 600;
  }
  .crow .dd {
    font-size: 10px;
    color: var(--owc-text-2);
  }
  .crow .nt {
    font-size: 9px;
    color: var(--owc-text-2);
    letter-spacing: 0.04em;
    opacity: 0.8;
  }
  .crow .gbadge {
    width: 32px;
    height: 32px;
    margin: 0 auto;
    border-radius: 9px;
    font-size: 16px;
  }
  .tiles {
    display: flex;
    gap: 3px;
  }
  .tile {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 3px 6px;
    border-radius: 7px;
  }
  .tile.l0 {
    background: color-mix(in srgb, var(--owc-accent) 7%, transparent);
  }
  .tile.l1 {
    background: color-mix(in srgb, var(--owc-amber) 8%, transparent);
  }
  .tile.l2 {
    background: color-mix(in srgb, var(--owc-red) 9%, transparent);
  }
  .tile.l3 {
    background: color-mix(in srgb, var(--owc-danger) 28%, transparent);
    box-shadow: inset 0 0 0 1px var(--owc-danger);
  }
  .tile.l3 .hh {
    color: var(--owc-danger-text);
    font-weight: 700;
  }
  .tile:not(.missing) {
    cursor: help;
  }
  .tile .hh {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .tile.passed {
    opacity: 0.5;
  }
  .tile.missing {
    background: var(--owc-soft);
  }
  .tile .hh {
    font-size: 9px;
    color: var(--owc-text-2);
    letter-spacing: 0.02em;
  }
  .tile .val,
  .mid .val {
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1.1;
    font-family: var(--owc-mono);
    font-size: 11px;
    font-weight: 600;
  }
  .tile .val svg,
  .mid .val svg {
    flex: 0 0 auto;
  }
  .ic0,
  .ic1,
  .ic2,
  .ic3 {
    display: inline-flex;
  }
  .ic0 {
    color: var(--owc-accent-text);
  }
  .ic1 {
    color: var(--owc-amber-text);
  }
  .ic2,
  .ic3 {
    color: var(--owc-red-text);
  }
  .mid .tot {
    font-weight: 500;
    color: var(--owc-text-2);
  }
  .mid.flag {
    opacity: 1;
    box-shadow: inset 0 0 0 1.5px var(--owc-red);
  }
  .mid {
    border-radius: 7px;
    padding: 6px 4px;
    opacity: 0.6;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .wk {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 5px;
  }
  .wk .ln {
    flex: 1 1 auto;
    height: 1px;
    background: var(--owc-line);
  }
  .wk span {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--owc-text-2);
  }

  /* ----- states ----- */
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

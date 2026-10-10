// Bundled Roboto Mono for the card's numbers, so they look the same on every OS (Home Assistant
// itself only sets `monospace`). @font-face doesn't work inside shadow DOM, so the face is added to
// the document once. Latin subset only: covers English and Norwegian (æøå are Latin-1).
// ponytail: other scripts fall back to the system monospace; add the latin-ext file if needed.
import woff2 from "@fontsource-variable/roboto-mono/files/roboto-mono-latin-wght-normal.woff2?inline";

export const MONO_FAMILY = "OWC Roboto Mono";

export function loadMonoFont(): void {
  if ([...document.fonts].some((f) => f.family === MONO_FAMILY)) return;
  const face = new FontFace(MONO_FAMILY, `url(${woff2}) format("woff2")`, {
    weight: "100 700",
    display: "swap",
  });
  document.fonts.add(face);
  void face.load();
}

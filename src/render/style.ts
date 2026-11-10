// Copied from Lanternfall (games/lanternfall/src/render/style.ts @ b282628). Storage key renamed; Phase 2 grows this into the look presets (plan 7.4).
// Art style switch for the inked storybook test. Read once at load; changing it takes a reload,
// which waits until the player leaves any battle in progress.
const KEY = 'moss-and-bell.artStyle';

function read() {
  try {
    const q = new URLSearchParams(location.search).get('style');
    if (q) return q !== 'classic';
    return localStorage.getItem(KEY) !== 'classic';
  } catch {
    return true;
  }
}

/** True when the inked storybook look is active. */
export const INK = read();

/** The art style to use from the next load. */
let wanted = INK;

/** Chooses the art style. It takes a reload, so pass reload: false during a battle and reload later. */
export function setArtStyle(ink: boolean, reload = true) {
  wanted = ink;
  try {
    localStorage.setItem(KEY, ink ? 'ink' : 'classic');
  } catch { /* Storage may be unavailable; the choice then lasts only until reload. */ }
  if (reload) applyArtStyle();
}

/** True when a new art style was chosen and waits for a reload. */
export function artStylePending() {
  return wanted !== INK;
}

export function applyArtStyle() {
  // A ?style= in the address would override the choice, so drop it.
  const url = new URL(location.href);
  if (url.searchParams.has('style')) {
    url.searchParams.delete('style');
    location.replace(url.href);
  } else location.reload();
}

// Copied from Lanternfall (games/lanternfall/src/ui/touch.ts @ b282628). Unchanged.
// Tracks whether the player is using touch, so the interface can switch between touch and mouse.
// It follows the most recent input rather than the device, which keeps laptops with touchscreens working
// with either one. The root element gets a `touch` class while touch is in use.

const root = document.documentElement;
let touch = matchMedia('(pointer: coarse)').matches;
root.classList.toggle('touch', touch);

window.addEventListener('pointerdown', (e) => {
  const now = e.pointerType !== 'mouse';
  if (now === touch) return;
  touch = now;
  root.classList.toggle('touch', touch);
}, { capture: true });

/** True when the player's most recent input was a finger or pen. */
export const isTouch = () => touch;

/** A short buzz on devices that support it. iPhones ignore this. */
export function buzz(ms = 8) {
  if (touch) navigator.vibrate?.(ms);
}

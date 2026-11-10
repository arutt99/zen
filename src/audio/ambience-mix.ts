// How loud each ambience layer is at a moment (plan 8): birds and the stream by day, crickets and wind at
// night, blended through dawn and dusk. A neglected valley is quieter (fewer birds); sitting slowly lifts
// the ambience (plan 3.5). Pure, so the tests can check it without audio.
import type { AmbienceName } from './sfx-recipes';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * @param t fraction of the day (0 = midnight)
 * @param restoration the place's restoration, 0..1
 * @param sitting 0..1, eased by the caller
 */
export function ambienceMix(t: number, restoration: number, sitting: number): Record<AmbienceName, number> {
  // Day: from just before dawn (~05:30) to dusk (~19:30), with soft edges.
  const day = smooth(0.21, 0.27, t) * (1 - smooth(0.78, 0.83, t));
  const night = 1 - day;
  const lift = 1 + 0.35 * sitting;
  // The dawn chorus: birds are busiest early.
  const chorus = 1 + 0.4 * smooth(0.22, 0.27, t) * (1 - smooth(0.3, 0.36, t));
  return {
    birds: day * chorus * (0.35 + 0.65 * restoration) * lift * 0.9,
    stream: (0.55 + 0.15 * day) * lift,
    crickets: night * (0.5 + 0.5 * restoration) * lift,
    wind: (0.25 + 0.45 * night) * lift,
  };
}

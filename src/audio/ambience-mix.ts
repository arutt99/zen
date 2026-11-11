// How loud each ambience layer is at a moment (plan 8): birds and the stream by day, crickets and wind at
// night, blended through dawn and dusk. A neglected valley is quieter (fewer birds); sitting slowly lifts
// the ambience (plan 3.5). Phase 4: the grove has its own mix. Pure, so the tests can check it without audio.
import type { AmbienceName } from './sfx-recipes';
import type { SeasonId } from '../data/seasons';

/**
 * Phase 5 (plan 8): the season shifts the mix. Spring's dawn chorus is fullest; summer nights are loud with
 * crickets; autumn is windier, with wind chimes at home too; winter is hushed: few birds, no crickets, the
 * stream half under ice, more wind.
 */
const SEASON_MIX: Record<SeasonId, { birds: number; crickets: number; wind: number; stream: number; chimes: number }> = {
  spring: { birds: 1.15, crickets: 0.8, wind: 1, stream: 1, chimes: 0 },
  summer: { birds: 1, crickets: 1.35, wind: 0.85, stream: 1, chimes: 0 },
  autumn: { birds: 0.7, crickets: 0.9, wind: 1.3, stream: 1, chimes: 0.3 },
  winter: { birds: 0.3, crickets: 0, wind: 1.45, stream: 0.65, chimes: 0.1 },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * @param t fraction of the day (0 = midnight)
 * @param restoration the place's restoration, 0..1
 * @param sitting 0..1, eased by the caller
 */
export function ambienceMix(t: number, restoration: number, sitting: number, place: 'valley' | 'grove' = 'valley', season: SeasonId = 'spring'): Record<AmbienceName, number> {
  const S = SEASON_MIX[season];
  // Day: from just before dawn (~05:30) to dusk (~19:30), with soft edges.
  const day = smooth(0.21, 0.27, t) * (1 - smooth(0.78, 0.83, t));
  const night = 1 - day;
  const lift = 1 + 0.35 * sitting;
  // The dawn chorus: birds are busiest early.
  const chorus = 1 + 0.4 * smooth(0.22, 0.27, t) * (1 - smooth(0.3, 0.36, t));
  // Phase 4: the bamboo grove is quieter and windier: bamboo rustling always, a smaller spring than the
  // valley's stream, fewer birds, and the shrine's chimes once it is restored.
  const grove = place === 'grove' ? 1 : 0;
  return {
    birds: day * chorus * (0.35 + 0.65 * restoration) * lift * 0.9 * (1 - 0.4 * grove) * S.birds,
    stream: (0.55 + 0.15 * day) * lift * (1 - 0.5 * grove) * S.stream,
    crickets: night * (0.5 + 0.5 * restoration) * lift * S.crickets,
    wind: Math.min(1, (0.25 + 0.45 * night) * lift * (1 - 0.3 * grove) * S.wind),
    rustle: grove * (0.6 + 0.2 * night) * lift,
    chimes: Math.min(1, grove * restoration * lift + (1 - grove) * restoration * S.chimes * lift),
  };
}

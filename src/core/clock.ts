// The clock (plan 5, 9.3): which season it is, from the device's calendar and the player's hemisphere, or a
// chosen season (Settings). The time of day lives in src/core/daylight.ts (Phase 2); both read the same
// `Date`, so a debug override of either is one setting. Pure, no three.js.
import { SEASON_IDS, type SeasonId } from '../data/seasons';

export type Hemisphere = 'north' | 'south';

/** How the season is chosen: the calendar (plan 5's default) or a fixed season ("autumn in April"). */
export interface SeasonSetting {
  mode: 'calendar' | 'fixed';
  pick: SeasonId;
}

/**
 * The season on a date. Meteorological seasons (whole months): in the north, March–May is spring,
 * June–August summer, September–November autumn, December–February winter; the south is six months on.
 */
export function seasonOf(d: Date, hemisphere: Hemisphere = 'north'): SeasonId {
  const m = (d.getMonth() + (hemisphere === 'south' ? 6 : 0)) % 12;
  return SEASON_IDS[Math.floor(((m + 10) % 12) / 3)]!;
}

export function seasonNow(setting: SeasonSetting, hemisphere: Hemisphere, now: Date): SeasonId {
  return setting.mode === 'fixed' ? setting.pick : seasonOf(now, hemisphere);
}

export const isSeason = (s: unknown): s is SeasonId => typeof s === 'string' && (SEASON_IDS as readonly string[]).includes(s);

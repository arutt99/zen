// The active look preset (src/data/looks.ts), chosen once per page load. Replaces Lanternfall's
// style.ts switch (ink vs classic): shaders are generated for one look, so changing it reloads.
// A `?look=` in the address overrides the saved choice (used for screenshot sets).
import { lookById, type LookDef, type LookId, type OutlineClass } from '../data/looks';

let current: LookDef = lookById(null);

/** The active look. */
export function look(): LookDef {
  return current;
}

/** Picks the look for this page load. Call before materials are built. */
export function useLook(id: string | null | undefined): LookDef {
  current = lookById(urlLook() ?? id);
  return current;
}

/** True when objects of this class get an ink outline in the active look. */
export function outlined(cls: OutlineClass): boolean {
  return current.outline.on.includes(cls);
}

/** True when anything gets outlines (geometry then carries the outline normals). */
export function anyOutline(): boolean {
  return current.outline.on.length > 0;
}

function urlLook(): string | null {
  try {
    return new URLSearchParams(location.search).get('look');
  } catch {
    return null;
  }
}

/** Reloads into another look. `?look=` is dropped so the saved choice takes effect. */
export function reloadIntoLook(_id: LookId): void {
  const url = new URL(location.href);
  if (url.searchParams.has('look')) {
    url.searchParams.delete('look');
    location.replace(url.href);
  } else location.reload();
}

/** GLSL vec3 literal. */
export const v3 = (c: readonly number[]) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`;
/** GLSL float literal. */
export const f = (x: number) => x.toFixed(4);

# Art pipeline

The rules for building and tuning art. The **target look** is the painted storybook reference,
`docs/art-reference.jpg` (plan 7.1). It is not final: the owner picks from look presets in Phase 2.
Phase 0 uses a Lanternfall-like look on purpose: banded cel shading and dark outlines. Phase 2 retunes it.

## Scale
- **1 unit = 1 metre.** The caretaker is ~1.5 m tall (placeholder), walk speed 4.2 m/s.
- Home island: walkable radius 26 m (`src/data/places.ts`).

## Models
- Every model is built in code (`src/render/models.ts`), deterministic from a seed. No model files.
- To add a model: write a builder that returns a `THREE.Group`, use `paintMaterial()` for surfaces,
  `addOutline()` for the outline shell, set `castShadow`/`receiveShadow`, and keep the origin on the ground.
- Poly budget guide (Phase 0): tree ≤ 600 tris, rock ≤ 120, prop ≤ 300. Grass is instanced.

## Shading (Phase 0 values, `src/render/materials.ts` → `DEFAULT_STYLE`)
| Setting | Value | Painted target (Phase 2 retune checklist) |
|---|---|---|
| Tone bands | 3, hard steps (110→255) | softer, wider blended steps |
| Brush texture strength | 0.35 | higher |
| Outline color | `#2E2620` | warm brown, thinner |
| Outline width | 0.035 m (0.6× on small props) | thinner; characters and buildings only |
| Outlines on | trees, rocks, props, caretaker | not on foliage or ground |
| Post grade | saturation 0.92, warmth 0.06, grain 0.035, vignette 0.35 | warmer, lower saturation, paper grain, distance haze |
| Shadows | PCF soft, from Medium up | lighter, warm-tinted |

## Palette
Home valley, spring day (`src/data/places.ts`): moss `#779777`, fern `#A3B591`, cedar `#846B50`,
light wood `#D9C39D`, warm paper `#F2E4C8`, stone `#9D9C8B`, water `#9CC7B8`→`#5E968E`,
lantern `#F4C98A`, cherry `#E9A9B8`, roof slate `#5F6B6A`. Light and fog: `src/data/presets.ts`.

## Art decision points (plan 7.4)
| # | Decision | Status |
|---|---|---|
| A1 | 2D vs 3D | **Due now (end of Phase 0).** Built as 3D; waiting for owner confirmation. |
| A2 | Camera angle, height, zoom | Phase 1 gate. Current: two presets in `src/render/camera.ts` |
| A3 | World scale and spacing | Phase 1 gate |
| A4–A6 | Character style, building kit, shading family | Phase 2 gate |
| A7 | Seasonal palettes | Phase 5 gate |

## External assets
None. Fonts are system fonts; all sound is synthesized. Log the source and license of any future asset here.

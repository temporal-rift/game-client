# Catalog illustrations

The game uses hand-authored, code-native SVG artwork so the catalog art remains scalable and easy to review alongside its identifier mapping.

## Style references

- [Board reference](../art-refs/board-reference.png) captures the existing navy board, teal and gold linework, and panel composition.
- [Engraving reference](../art-refs/engraving-reference.svg) is the hand-authored sepia-on-cream etched treatment used by the alternate skin.

## Authoring and reproducibility

The illustrations are rendered as inline SVG by `src/illustrations/catalog.tsx`. Catalog identifiers, motif assignments, palettes, and SVG path forms are maintained in `src/illustrations/catalogData.ts`.

No image-generation service, external renderer, or model is used. Consequently, there are no style identifiers, prompts, or model settings to preserve. To adjust an illustration, update its motif mapping or SVG path directly and run `npm test -- src/illustrations/catalog.test.tsx` to verify catalog coverage, fallback behavior, skin support, and decorative accessibility.

Board preserves the existing event scenes, five card glyphs, and faction emblem in the fixture board. New catalog entries use the same navy, teal, muted gold, and occasional coral linework. Engraving uses cream paper and one sepia ink, with fine parallel and cross-hatched strokes. Both skins share stable event, card, special, and faction identifiers.

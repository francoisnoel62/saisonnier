<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design system ma saison

Avant toute modification UI/UX, lire `docs/design-system.md`. Conserver shadcn/ui,
Tailwind et les primitives de `src/components/ui/`. Réutiliser les tokens de
`src/app/design-tokens.css`, leur mapping dans `src/app/globals.css` et le composant
`Brand`. Les aperçus marketing doivent être de vraies captures de l’application ;
signaler clairement les fonctions à venir. Mettre à jour la bible si une règle
commune ou un token change.

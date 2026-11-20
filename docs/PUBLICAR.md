# Publicar Próstata Lab en Cloudflare Pages

Se publica desde la box y solo lo que está en `main`, con el sí de Mario. Fusionar un PR no publica nada.

## Primera vez

```sh
git clone https://github.com/drdominguezesteban/prostata-lab.git
cd prostata-lab
npx wrangler pages project create prostata-lab --production-branch main
```

## Cada publicación

```sh
cd prostata-lab
git switch main && git pull --ff-only
git status --short            # debe salir vacío
npm ci
npm run typecheck && npm test && npm run build
python3 scripts/cumplimiento.py --perfil prostatalab
npx wrangler pages deploy     # desde la raíz: sube dist/ y functions/ (lo indica wrangler.toml)
```

Hay que lanzarlo desde la raíz del repo: así Pages incluye `functions/`, que es donde se corrige. Si se sube solo `dist/`, la web carga pero no corrige.

## Comprobar tras publicar

Con `URL` = la dirección que da wrangler (por ejemplo `https://prostata-lab.pages.dev`):

```sh
curl -s "$URL/api/casos" | head -c 200                       # lista de casos, sin respuestas
curl -s "$URL/api/casos" | grep -c densidad_psa_correcta      # debe dar 0
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/api/corregir" \
  -H 'content-type: application/json' -d '{"caso":"x","lectura":{}}'   # debe dar 404
```

Después, abrir la web, hacer un caso completo y ver la corrección.

## Nunca

- Publicar desde una rama o una copia con cambios sin fusionar.
- Subir `.env`, `.dev.vars`, `.wrangler/` ni tokens al repo.
- Conectar el proyecto de Pages a GitHub sin el sí de Mario.

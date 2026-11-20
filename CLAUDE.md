# prostata-lab

Próstata Lab: lectura guiada de RM biparamétrica de próstata (PI-RADS v2.1) con 7 estudios reales de
PI-CAI. Proyecto personal de Mario, en `*.pages.dev`. Sustituye a la versión de ChatGPT Sites.

## Arquitectura

- Vite + TypeScript sin framework (`src/`), con Cloudflare Pages Functions (`functions/api/`).
- Las respuestas no llegan al navegador: `datos/casos.json` y `datos/geometria.json` solo los importa
  `shared/servidor.ts`. `GET /api/casos` da el catálogo sin respuestas; `POST /api/corregir` corrige y
  devuelve la referencia solo si la lectura está completa; `POST /api/recorregir` (panel docente)
  devuelve solo notas. Una prueba falla si una clave de respuesta aparece en el catálogo y otra si
  `src/` importa valores de `shared/servidor` o de `datos/`. Publicación: `docs/PUBLICAR.md`.
- Progreso del alumno en `localStorage`, con exportación/importación JSON. El panel docente reúne
  esos archivos en su propio `localStorage`. Solo seudónimos; nada se sube a ningún servidor.
- Datos e imágenes se regeneran con `scripts/importar_casos.py` desde `~/Dev/simulador-rm-prostata/export`
  y `~/Dev/prostata-lab-picai/out` (contornos zonales: `prostata-lab-picai/scripts/generar_zonal.py`).
- `npm run dev` (127.0.0.1:43124) sirve la misma API con el middleware de `vite.config.ts`.

## Circuito

- El despliegue en Cloudflare Pages sale de la box. Este repo no está conectado a Cloudflare:
  fusionar un PR no publica nada. Solo se publica lo que está en `main`, con el sí de Mario.
- Nadie empuja a `main`: todo entra por rama + PR y se fusiona con squash, con el sí de Mario,
  revisión de Claude sin «Debe corregirse» y comprobación en verde.
- Comprobación «Cumplimiento» (`scripts/cumplimiento.py --perfil prostatalab`) y `npm test`
  (incluida `tests/auditoria.test.ts`, que falla si la web dice «PhD», nombra una institución o
  remite a urgencias).

## Reglas

- Nunca se vincula con el HUMV, Valdecilla ni IDIVAL, ni en textos, metadatos, commits o repos. <!-- cumplimiento: permitido -->
- Solo imágenes públicas de PI-CAI (CC BY-NC 4.0, atribución en el pie y en «Método»). Nunca datos
  de pacientes propios, ni en pruebas.
- Uso no comercial (lo exige CC BY-NC): sin cobro, publicidad ni acceso de pago.
- Herramienta docente: no es un sistema de apoyo a decisiones clínicas; no se debilita ese aviso.
- Los textos clínicos (módulos 1 y 2, explicaciones) los valida Mario antes de publicar.
- «PhD» no, hasta que Mario defienda la tesis. Todo en español.

## Nunca en el repo

Secretos (`.env`, `.dev.vars`, tokens), `.wrangler/`, `node_modules/`, `dist/`, copias de seguridad y logs.

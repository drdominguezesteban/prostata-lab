# Próstata Lab

Aprende a leer la RM biparamétrica de próstata (PI-RADS v2.1) con estudios reales de PI-CAI.

1. **Anatomía zonal**: una próstata real en T2 con la zona periférica y la de transición superpuestas, y el mapa de 38 sectores.
2. **Secuencias y puntuación**: criterios de T2 y DWI, qué secuencia manda en cada zona y práctica de la regla.
3. **Casos clínicos**: siete estudios leídos a ciegas (contexto, lesiones por sectores, puntuación, categoría y decisión) y corregidos campo a campo frente a la lectura del autor.

El progreso queda en el navegador y se puede exportar para el panel docente. No es un sistema de apoyo a decisiones clínicas.

Dirección pública: https://prostatalab.drdominguezesteban.com (alternativa: https://prostata-lab.pages.dev).

## Desarrollo

```sh
npm ci
npm run dev        # http://127.0.0.1:43124
npm test
npm run build
```

## Datos

Publicación: ver `docs/PUBLICAR.md`.

Imágenes: PI-CAI (Saha et al., Lancet Oncol 2024), licencia CC BY-NC 4.0. Lecturas de referencia del autor.
Próstata Lab es una herramienta docente gratuita y no comercial, como exige esa licencia.

#!/usr/bin/env python3
"""Importa los casos del autor y las imágenes PI-CAI corregistradas al formato de la app.

Uso: python3 scripts/importar_casos.py <export_simulador> <out_prostata_lab_picai>
  export_simulador        ~/Dev/simulador-rm-prostata/export (casos_tanda*.json y <id>/manifest.json)
  out_prostata_lab_picai  ~/Dev/prostata-lab-picai/out (picai/<id>/{t2w,adc,hbv}/NNN.png y zonal/<id>.json)

Escribe datos/casos.json, datos/geometria.json (solo servidor) y public/casos/<id>/{t2w,adc,hbv,zonal.json}.
Corrige la redacción de las citas EAU 2026 (5.5.8) revisada por el autor el 2026-11-18.
"""
import json, shutil, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
exp, out = Path(sys.argv[1]), Path(sys.argv[2])

CORRECCIONES_GENERALES = [
    ("la EAU 2026 permite omitir la biopsia y hacer seguimiento con PSA tras una decisión compartida",
     "la EAU 2026 recomienda omitir la biopsia y ofrecer seguimiento con PSA, tras una decisión compartida"),
    ("la guía permite omitir la biopsia",
     "la guía recomienda omitir la biopsia y ofrecer seguimiento con PSA (EAU 2026, 5.5.8, recomendación débil)"),
]
CORRECCIONES_CASO = {
    # Las opciones se ven antes de corregir: «ambas lesiones» revelaba que hay dos.
    "11260_1001283": [
        ("Biopsia dirigida a ambas lesiones + sistemática", "Biopsia dirigida a todas las lesiones sospechosas + sistemática"),
        ("Biopsia dirigida + perilesional de ambas lesiones", "Biopsia dirigida + perilesional de todas las lesiones sospechosas"),
    ],
    "11377_1001400": [
        ("Aquí la densidad de PSA es 0,28, casi tres veces el umbral: hay que biopsiar.",
         "Con PSA-D 0,28 (por encima de 0,10), la EAU recomienda considerar biopsia dirigida con muestreo perilesional (5.5.8, débil)."),
        ("Omitir la biopsia es un error crítico.",
         "Omitirla sin un motivo clínico explícito es el error más grave de este caso."),
        ("La EAU 2026 solo permite omitir la biopsia", "La EAU 2026 solo contempla omitir la biopsia"),
        ("la guía solo permite omitir la biopsia", "la guía solo contempla omitir la biopsia"),
    ],
}


def corregir(obj, pares):
    if isinstance(obj, str):
        for a, b in pares:
            obj = obj.replace(a, b)
        return obj
    if isinstance(obj, list):
        return [corregir(x, pares) for x in obj]
    if isinstance(obj, dict):
        return {k: corregir(v, pares) for k, v in obj.items()}
    return obj


casos = []
for f in sorted(exp.glob("casos_tanda*.json")):
    casos += json.load(open(f, encoding="utf-8"))
casos = [c for c in casos if c.get("tipo_imagen") == "real"]
casos.sort(key=lambda c: (c["nivel"], c["categoria_estudio"], c["id"]))

salida = []
geometria = {}
for n, c in enumerate(casos, 1):
    cid = c["id"]
    c = corregir(c, CORRECCIONES_GENERALES + CORRECCIONES_CASO.get(cid, []))
    m = json.load(open(exp / cid / "manifest.json", encoding="utf-8"))
    for l in c["lesiones"]:
        l.pop("manifest_lesion", None)
    salida.append({
        "id": cid,
        "numero": n,
        "nivel": c["nivel"],
        "contexto_real": c["contexto_real"],
        "contexto_docente": c["contexto_docente"],
        "aviso_contexto": c["aviso_contexto"],
        "densidad_psa_correcta": c["densidad_psa_correcta"],
        "categoria_estudio": c["categoria_estudio"],
        "estrato_referencia": c["estrato_referencia"],
        "desenlace_real": c["desenlace_real"],
        "medicion": c.get("medicion"),
        "lesiones": c["lesiones"],
        "decision": c["decision"],
        "informe_referencia": c["informe_referencia"],
        "errores_frecuentes": c["errores_frecuentes"],
        "tecnica": {
            "n_cortes": m["n_cortes"], "mm_por_px": m["mm_por_px"], "grosor_corte_mm": m["grosor_corte_mm"],
            "b_alto": m["dwi"]["b_alto_s_mm2"], "equipo": f'{m["dwi"]["fabricante"].title()} {m["dwi"]["modelo"]}',
        },
    })
    dst = RAIZ / "public/casos" / cid
    for seq in ("t2w", "adc", "hbv"):
        if (dst / seq).exists():
            shutil.rmtree(dst / seq)
        shutil.copytree(out / "picai" / cid / seq, dst / seq)
    geo = {"lesiones": [{k: l[k] for k in ("id", "cortes", "corte_referencia", "contornos_px")} for l in m["lesiones"]]}
    geometria[cid] = geo
    z = out / "zonal" / f"{cid}.json"
    if z.exists():
        shutil.copy(z, dst / "zonal.json")

(RAIZ / "datos/casos.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
(RAIZ / "datos/geometria.json").write_text(json.dumps(geometria, separators=(",", ":")), encoding="utf-8")
print(f"{len(salida)} casos importados")

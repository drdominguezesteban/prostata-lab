#!/usr/bin/env python3
"""Comprueba las reglas de Mario en este repo (y, en la web, en el sitio publicado).

Tres comprobaciones:
  repo   archivos que nunca deben versionarse y tokens o claves en cualquier archivo.
  cambios  líneas añadidas en un PR o un push que rompen las reglas del perfil.
           Solo mira lo nuevo, para no tropezar con restos antiguos que no se publican.
           Una línea que necesite citar una palabra prohibida (p. ej. una prueba que
           comprueba que no aparece) lleva el marcador «cumplimiento: permitido».
  web    descarga las páginas del sitemap publicado y busca lo mismo en el texto
         y los enlaces (solo perfil web).

Uso:
  python3 scripts/cumplimiento.py --perfil web|refcheck|tutoria|prostatalab [--base REF] [--web]
"""
import argparse
import re
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MARCADOR = "cumplimiento: permitido"
SITIO = "https://drdominguezesteban.com"

PROHIBIDO_ARCHIVOS = [
    (re.compile(r"(^|/)\.env(\..*)?$|(^|/)\.dev\.vars$|\.(pem|key)$"), "secreto"),
    (re.compile(r"(^|/)(\.wrangler|node_modules|dist)/"), "dependencias o build"),
    (re.compile(r"(^|/)(_?backup[-_][^/]*|prod-snapshot-[^/]*)/|\.bak"), "copia de seguridad"),
    (re.compile(r"\.(mp4|mov|webm|m4v)$", re.I), "vídeo: se despliega desde la box"),
    (re.compile(r"(^|/)(nueva-slp|asesoria|umi_analisis)/|(^|/)historico\.md$"), "confidencial"),
    (re.compile(r"(^|/)contenido/datos_umi_cita\.md$"), "asuntos de UMI y sus socios (regla 6)"),
]
SECRETOS = re.compile(
    r"(ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}|\bxai-[A-Za-z0-9]{20,}|\bsk-(ant-)?[A-Za-z0-9_-]{20,}"
    r"|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----"
)

COMUN = [
    (re.compile(r"\bPh\.?\s?D\b"), "«PhD» (regla 10: no hasta defender la tesis)"),
]
UMI = [
    (re.compile(r"mompi[aá]", re.I), "Mompía (regla 6)"),
    (re.compile(r"masuro", re.I), "masuro.com (regla 6)"),
    (re.compile(r"wa\.me|api\.whatsapp|whatsapp\.com/send", re.I), "enlace de WhatsApp (regla 6)"),
    (re.compile(r"942\s?314\s?297"), "teléfono de UMI (regla 6)"),
    (re.compile(r"href=[\"'][^\"']*(urologiaminimamenteinvasiva|uronoinvasiva)", re.I),
     "enlace a la web de UMI (regla 6)"),
    (re.compile(r"href=[\"']tel:", re.I), "enlace de teléfono (regla 6)"),
]
URGENCIAS = [
    (re.compile(r"acud[ea]s?\s+a\s+(urgencias|un hospital)|ve\s+a\s+urgencias|go to the emergency",
                re.I), "remitir a urgencias (regla 3: «Consulta de forma urgente»)"),
    (re.compile(r"(llam[ae]s?|marca)\s+al\s+112|\b(call|dial)\s+112\b", re.I),
     "112 en contenido divulgativo (regla 3)"),
]
INSTITUCION = [
    (re.compile(r"\bHUMV\b|valdecilla|\bIDIVAL\b|scsalud", re.I),
     "vínculo con HUMV, Valdecilla o IDIVAL (regla 1c)"),
]
PERFILES = {
    "web": COMUN + UMI + URGENCIAS,
    "refcheck": COMUN + INSTITUCION,
    "tutoria": COMUN + INSTITUCION + URGENCIAS,
    "prostatalab": COMUN + INSTITUCION + URGENCIAS,
}
# Notas internas y pruebas, que no se publican: no se revisan las líneas nuevas.
SIN_REVISAR = re.compile(r"^(contenido|investigacion|ideas_urosuite)/|(^|/)README\.md$|(^|/)CLAUDE\.md$"
                         r"|(^|/)tests?/|\.test\.[a-z]+$|^scripts/cumplimiento\.py$|^\.github/")


def git(*args):
    return subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, check=True).stdout.decode("utf-8", "replace")


def revisar_repo():
    errores = []
    for ruta in git("ls-files").splitlines():
        for patron, motivo in PROHIBIDO_ARCHIVOS:
            if patron.search(ruta):
                errores.append(f"{ruta}: no puede estar en el repo ({motivo})")
        archivo = RAIZ / ruta
        if archivo.is_file() and archivo.stat().st_size < 5_000_000:
            try:
                if SECRETOS.search(archivo.read_text(encoding="utf-8")):
                    errores.append(f"{ruta}: parece contener un token o una clave privada")
            except UnicodeDecodeError:
                pass
    return errores


def revisar_cambios(base, reglas):
    errores = []
    diff = git("diff", "--unified=0", "--no-color", f"{base}...HEAD")
    ruta, linea = None, 0
    for l in diff.splitlines():
        if l.startswith("+++ "):
            ruta = l[6:] if l.startswith("+++ b/") else None
        elif l.startswith("@@"):
            linea = int(re.search(r"\+(\d+)", l).group(1))
        elif l.startswith("+") and ruta:
            texto = l[1:]
            if not SIN_REVISAR.search(ruta) and MARCADOR not in texto:
                for patron, motivo in reglas:
                    if patron.search(texto):
                        errores.append(f"{ruta}:{linea}: {motivo}")
            linea += 1
    return errores


class Texto(HTMLParser):
    def __init__(self):
        super().__init__()
        self.partes, self.saltar = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.saltar += 1
        for nombre, valor in attrs:
            if nombre == "href" and valor:
                self.partes.append(f'href="{valor}"')

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.saltar:
            self.saltar -= 1

    def handle_data(self, data):
        if not self.saltar:
            self.partes.append(data)


def descargar(url):
    pet = urllib.request.Request(url, headers={"User-Agent": "cumplimiento-drdominguezesteban"})
    with urllib.request.urlopen(pet, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def revisar_web(reglas):
    errores = []
    urls = re.findall(r"<loc>([^<]+)</loc>", descargar(f"{SITIO}/sitemap.xml"))
    if not urls:
        return ["El sitemap publicado no tiene URL"]
    for url in urls:
        p = Texto()
        p.feed(descargar(url))
        texto = " ".join(p.partes)
        for patron, motivo in reglas:
            if patron.search(texto):
                errores.append(f"{url}: {motivo}")
    print(f"Web: {len(urls)} páginas revisadas")
    return errores


def main():
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--perfil", required=True, choices=PERFILES)
    a.add_argument("--base", help="commit o rama contra la que comparar las líneas nuevas")
    a.add_argument("--web", action="store_true", help="revisar también el sitio publicado")
    args = a.parse_args()
    reglas = PERFILES[args.perfil]

    errores = revisar_repo()
    if args.base:
        errores += revisar_cambios(args.base, reglas)
    if args.web:
        errores += revisar_web(reglas)

    for e in errores:
        print(f"ERROR  {e}")
    print(f"\n{len(errores)} errores")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()

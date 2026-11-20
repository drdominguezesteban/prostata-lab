/**
 * Mapa de sectores PI-RADS v2.1 (esquema axial de base, tercio medio y ápex).
 * Se elige con clic o con el teclado (Espacio/Intro) y, como alternativa, con casillas.
 */
import { h } from "./dom";
import { NIVELES, NOMBRE_NIVEL, SECTORES, nombreSector, type Sector } from "../shared/sectores";

const SVG = "http://www.w3.org/2000/svg";
const ANCHO = 150;
const ALTO = 124;
const R_INT = 30;
const R_EXT = 58;
const ESCALA_Y = 0.78;

function punto(cx: number, cy: number, r: number, grados: number): string {
  const a = (grados * Math.PI) / 180;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a) * ESCALA_Y).toFixed(1)}`;
}

function trazo(s: Sector, cx: number, cy: number): string {
  const [r0, r1] = s.anillo === "interno" ? [0, R_INT] : [R_INT, R_EXT];
  const pasos = Math.max(2, Math.ceil((s.hasta - s.desde) / 4));
  const exterior: string[] = [];
  const interior: string[] = [];
  for (let i = 0; i <= pasos; i++) {
    const g = s.desde + ((s.hasta - s.desde) * i) / pasos;
    exterior.push(punto(cx, cy, r1, g));
    if (r0 > 0) interior.unshift(punto(cx, cy, r0, g));
  }
  const cierre = r0 > 0 ? interior : [`${cx},${cy}`];
  return `M${exterior.join("L")}L${cierre.join("L")}Z`;
}

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export interface OpcionesMapa {
  seleccion?: string[];
  /** Sectores de referencia (corrección): se dibujan con trama. */
  referencia?: string[];
  soloLectura?: boolean;
  alCambiar?: (seleccion: string[]) => void;
  /** Mostrar las casillas alternativas. */
  casillas?: boolean;
  etiqueta?: string;
}

export function mapaSectores(o: OpcionesMapa): HTMLElement {
  const sel = new Set(o.seleccion ?? []);
  const ref = new Set(o.referencia ?? []);
  const caminos = new Map<string, SVGElement>();
  const casillas = new Map<string, HTMLInputElement>();
  const nombreSel = h("p", { class: "mapa-seleccion", "aria-live": "polite" });

  const pintar = () => {
    for (const [c, p] of caminos) {
      p.classList.toggle("elegido", sel.has(c));
      p.classList.toggle("referencia", ref.has(c));
      if (!o.soloLectura) p.setAttribute("aria-checked", String(sel.has(c)));
    }
    for (const [c, x] of casillas) x.checked = sel.has(c);
    nombreSel.textContent = sel.size
      ? [...sel].map(nombreSector).join(" · ")
      : o.soloLectura ? "" : "Ningún sector elegido.";
  };

  const alternar = (c: string) => {
    if (o.soloLectura) return;
    if (sel.has(c)) sel.delete(c);
    else sel.add(c);
    pintar();
    o.alCambiar?.([...sel]);
  };

  const dibujo = h("div", { class: "mapa-niveles", role: o.soloLectura ? "img" : "group", "aria-label": o.etiqueta ?? "Mapa de sectores PI-RADS" });
  for (const nivel of NIVELES) {
    const cx = ANCHO / 2;
    const cy = ALTO / 2 + 10;
    const lamina = svg("svg", { viewBox: `0 0 ${ANCHO} ${ALTO + 18}`, class: "mapa-svg" });
    const t = svg("text", { x: cx, y: 12, class: "mapa-nivel", "text-anchor": "middle" });
    t.textContent = NOMBRE_NIVEL[nivel];
    lamina.append(t);
    for (const s of SECTORES.filter((x) => x.nivel === nivel)) {
      const p = svg("path", { d: trazo(s, cx, cy), class: `sector zona-${s.zona}` });
      const titulo = svg("title", {});
      titulo.textContent = nombreSector(s.codigo);
      p.append(titulo);
      if (!o.soloLectura) {
        p.setAttribute("role", "checkbox");
        p.setAttribute("tabindex", "0");
        p.setAttribute("aria-label", nombreSector(s.codigo));
        p.addEventListener("click", () => alternar(s.codigo));
        p.addEventListener("keydown", (e) => {
          const k = (e as KeyboardEvent).key;
          if (k === " " || k === "Enter") {
            e.preventDefault();
            alternar(s.codigo);
          }
        });
      }
      caminos.set(s.codigo, p);
      lamina.append(p);
    }
    for (const [x, letra] of [[cx - R_EXT - 8, "D"], [cx + R_EXT + 8, "I"]] as const) {
      const l = svg("text", { x, y: cy + 4, class: "mapa-lado", "text-anchor": "middle" });
      l.textContent = letra;
      lamina.append(l);
    }
    dibujo.append(lamina);
  }

  const partes: Array<HTMLElement | SVGElement> = [dibujo];
  if (!o.soloLectura) partes.push(nombreSel);
  if (o.casillas && !o.soloLectura) {
    partes.push(
      h(
        "details",
        { class: "mapa-lista" },
        h("summary", null, "Elegir los sectores de una lista"),
        ...NIVELES.map((nivel) =>
          h(
            "fieldset",
            null,
            h("legend", null, NOMBRE_NIVEL[nivel]),
            ...SECTORES.filter((s) => s.nivel === nivel).map((s) => {
              const x = h("input", { type: "checkbox", value: s.codigo, onchange: () => alternar(s.codigo) });
              casillas.set(s.codigo, x);
              return h("label", null, x, " ", nombreSector(s.codigo).split(" · ").slice(1).join(" · "));
            }),
          ),
        ),
      ),
    );
  }
  const raiz = h("div", { class: "mapa" + (o.soloLectura ? " solo-lectura" : "") });
  raiz.append(...partes);
  pintar();
  return raiz;
}

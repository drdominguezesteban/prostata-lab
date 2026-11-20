import { h, num } from "../dom";
import type { CasoPublico } from "../../shared/servidor";

export const DIFICULTAD: Record<number, string> = { 1: "Básica", 2: "Media", 3: "Alta" };

export function lineaCaso(c: CasoPublico): string {
  const biopsias = c.contexto_docente.biopsias_previas === "ninguna" ? "sin biopsias previas" : `biopsias previas: ${c.contexto_docente.biopsias_previas}`;
  return `${c.edad} años · PSA ${num(c.psa)} ng/mL · ${biopsias}`;
}

export function cargando(texto = "Cargando…"): HTMLElement {
  return h("p", { class: "cargando", role: "status" }, texto);
}

export function errorCarga(): HTMLElement {
  return h("p", { class: "aviso error", role: "alert" }, "No se han podido cargar los casos. Comprueba la conexión y recarga la página.");
}

export function porcentaje(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)} %`;
}

export function barra(v: number | null | undefined, etiqueta: string): HTMLElement {
  const p = v === null || v === undefined ? 0 : Math.round(v * 100);
  return h("div", { class: "barra", role: "meter", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": p, "aria-label": etiqueta },
    h("span", { style: `width:${p}%` }));
}

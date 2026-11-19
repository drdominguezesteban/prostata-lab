type Hijo = Node | string | number | null | undefined | false | Hijo[];
type Atributos = Record<string, string | number | boolean | null | undefined | EventListener>;

/** Crea un elemento: h("p", { class: "nota" }, "texto", otroNodo). Los `on…` son eventos. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Atributos | null = null, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  anadir(el, hijos);
  return el;
}

export function anadir(el: Element, hijos: Hijo[]): void {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (Array.isArray(hijo)) anadir(el, hijo);
    else el.append(hijo instanceof Node ? hijo : String(hijo));
  }
}

export function vaciar(el: Element, ...hijos: Hijo[]): void {
  el.replaceChildren();
  anadir(el, hijos);
}

/** Decimales con coma: 0.17 → «0,17». */
export function num(v: number, decimales?: number): string {
  const t = decimales === undefined ? String(v) : v.toFixed(decimales);
  return t.replace(".", ",");
}

/** Lee un número escrito con coma o punto. */
export function leerNum(t: string): number | null {
  const v = Number(t.trim().replace(",", "."));
  return t.trim() !== "" && Number.isFinite(v) ? v : null;
}

export function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = h("a", { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Botón que pide un segundo clic para confirmar (sin diálogos del navegador). */
export function botonConfirmar(texto: string, confirmar: string, accion: () => void, clase = "boton secundario"): HTMLButtonElement {
  const b = h("button", { type: "button", class: clase }, texto);
  let armado = false;
  b.addEventListener("click", () => {
    if (!armado) {
      armado = true;
      b.textContent = confirmar;
      b.classList.add("peligro");
      setTimeout(() => {
        armado = false;
        b.textContent = texto;
        b.classList.remove("peligro");
      }, 4000);
      return;
    }
    accion();
  });
  return b;
}

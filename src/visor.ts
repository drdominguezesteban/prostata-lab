/**
 * Visor de cortes axiales en <canvas>: T2, ADC y b alto sincronizados (misma geometría: un píxel y
 * un corte son el mismo punto anatómico en las tres), con zoom, desplazamiento, brillo/contraste,
 * marcas del alumno y contornos (referencia del autor o zonas de PI-CAI).
 *
 * La rueda solo cambia de corte con el visor enfocado (tras hacer clic) o con Mayúsculas; sin
 * foco, la página se desplaza con normalidad.
 */
import { h, vaciar } from "./dom";

export type Secuencia = "t2w" | "adc" | "hbv";
export const NOMBRE_SECUENCIA: Record<Secuencia, string> = { t2w: "T2", adc: "ADC", hbv: "b alto" };

export interface Contorno {
  corte: number;
  polys: number[][][];
  color: string;
  relleno?: string;
}

export interface MarcaVisor {
  corte: number;
  x: number;
  y: number;
  etiqueta: string;
  color: string;
}

export interface OpcionesVisor {
  caso: string;
  nCortes: number;
  secuencias: Secuencia[];
  corte?: number;
  /** Texto bajo cada imagen (b alto real del estudio, p. ej.). */
  rotulos?: Partial<Record<Secuencia, string>>;
  alPulsar?: (p: { corte: number; x: number; y: number }) => void;
  alCambiarCorte?: (corte: number) => void;
}

const N = 384;
const imagenes = new Map<string, HTMLImageElement>();

function urlImagen(caso: string, seq: Secuencia, k: number): string {
  return `/casos/${caso}/${seq}/${String(k).padStart(3, "0")}.png`;
}

function imagen(url: string, alCargar: () => void): HTMLImageElement {
  let img = imagenes.get(url);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = url;
    imagenes.set(url, img);
  }
  if (!img.complete) img.addEventListener("load", alCargar, { once: true });
  return img;
}

export class Visor {
  readonly el: HTMLElement;
  private o: OpcionesVisor;
  private corte: number;
  private zoom = 1;
  private cx = N / 2;
  private cy = N / 2;
  private brillo = 1;
  private contraste = 1;
  private marcas: MarcaVisor[] = [];
  private contornos: Contorno[] = [];
  private lienzos = new Map<Secuencia, HTMLCanvasElement>();
  private deslizador: HTMLInputElement;
  private rotuloCorte: HTMLElement;
  private modoMarca = false;
  private aviso: HTMLElement;
  private precargado = false;

  constructor(o: OpcionesVisor) {
    this.o = o;
    this.corte = Math.min(o.nCortes - 1, Math.max(0, o.corte ?? Math.floor(o.nCortes / 2)));
    this.deslizador = h("input", {
      type: "range",
      min: 0,
      max: o.nCortes - 1,
      step: 1,
      value: this.corte,
      "aria-label": "Corte",
      oninput: () => this.irA(Number(this.deslizador.value)),
    });
    this.rotuloCorte = h("span", { class: "visor-corte", "aria-live": "polite" });
    this.aviso = h("p", { class: "visor-aviso" });

    const paneles = o.secuencias.map((seq) => {
      const c = h("canvas", { width: N, height: N, "aria-label": `${NOMBRE_SECUENCIA[seq]}, corte axial` });
      this.lienzos.set(seq, c);
      this.eventosLienzo(c);
      return h(
        "figure",
        { class: "visor-panel" },
        c,
        h("figcaption", null, h("strong", null, NOMBRE_SECUENCIA[seq]), o.rotulos?.[seq] ? ` · ${o.rotulos[seq]}` : ""),
      );
    });

    const brillo = h("input", { type: "range", min: 0.5, max: 1.8, step: 0.05, value: 1, "aria-label": "Brillo", oninput: (e: Event) => { this.brillo = Number((e.target as HTMLInputElement).value); this.dibujar(); } });
    const contraste = h("input", { type: "range", min: 0.5, max: 2.5, step: 0.05, value: 1, "aria-label": "Contraste", oninput: (e: Event) => { this.contraste = Number((e.target as HTMLInputElement).value); this.dibujar(); } });

    this.el = h(
      "section",
      { class: `visor visor-${o.secuencias.length}`, tabindex: 0, "aria-label": "Visor de RM. Flechas: cambiar de corte." },
      h("div", { class: `visor-paneles` }, paneles),
      h(
        "div",
        { class: "visor-controles" },
        h(
          "div",
          { class: "visor-cortes" },
          h("button", { type: "button", class: "icono", "aria-label": "Corte anterior (hacia el ápex)", onclick: () => this.irA(this.corte - 1) }, "−"),
          h("span", { class: "extremo" }, "Ápex"),
          this.deslizador,
          h("span", { class: "extremo" }, "Base"),
          h("button", { type: "button", class: "icono", "aria-label": "Corte siguiente (hacia la base)", onclick: () => this.irA(this.corte + 1) }, "+"),
          this.rotuloCorte,
        ),
        h(
          "div",
          { class: "visor-ajustes" },
          h("label", null, "Zoom ", h("select", { onchange: (e: Event) => this.ponerZoom(Number((e.target as HTMLSelectElement).value)) },
            ...[1, 1.5, 2, 3].map((z) => h("option", { value: z }, `${String(z).replace(".", ",")}×`)))),
          h("label", null, "Brillo ", brillo),
          h("label", null, "Contraste ", contraste),
          h("button", { type: "button", class: "enlace", onclick: () => { brillo.value = "1"; contraste.value = "1"; this.brillo = 1; this.contraste = 1; this.ponerZoom(1); const s = this.el.querySelector("select"); if (s) s.value = "1"; } }, "Restablecer"),
        ),
      ),
      this.aviso,
    );

    this.el.addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
      if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); this.irA(this.corte + 1); }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "PageDown") { e.preventDefault(); this.irA(this.corte - 1); }
    });
    this.el.addEventListener("wheel", (e) => {
      if (!e.shiftKey && !this.el.contains(document.activeElement)) return;
      e.preventDefault();
      const d = e.deltaY || e.deltaX;
      if (Math.abs(d) < 2) return;
      this.irA(this.corte + (d < 0 ? 1 : -1));
    }, { passive: false });

    this.actualizarRotulo();
    this.dibujar();
  }

  private eventosLienzo(c: HTMLCanvasElement): void {
    let inicio: { x: number; y: number; cx: number; cy: number } | null = null;
    let movido = false;
    c.addEventListener("pointerdown", (e) => {
      this.el.focus({ preventScroll: true });
      inicio = { x: e.clientX, y: e.clientY, cx: this.cx, cy: this.cy };
      movido = false;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      if (Math.hypot(dx, dy) > 4) movido = true;
      if (movido && this.zoom > 1) {
        const escala = N / c.getBoundingClientRect().width / this.zoom;
        this.cx = this.limitar(inicio.cx - dx * escala);
        this.cy = this.limitar(inicio.cy - dy * escala);
        this.dibujar();
      }
    });
    c.addEventListener("pointerup", (e) => {
      if (inicio && !movido && this.o.alPulsar) {
        const r = c.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * N;
        const py = ((e.clientY - r.top) / r.height) * N;
        const x = (px - N / 2) / this.zoom + this.cx;
        const y = (py - N / 2) / this.zoom + this.cy;
        if (x >= 0 && x <= N && y >= 0 && y <= N) this.o.alPulsar({ corte: this.corte, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
      }
      inicio = null;
    });
    c.addEventListener("pointercancel", () => (inicio = null));
  }

  private limitar(v: number): number {
    const m = N / 2 / this.zoom;
    return Math.min(N - m, Math.max(m, v));
  }

  ponerZoom(z: number): void {
    this.zoom = z;
    this.cx = this.limitar(this.cx);
    this.cy = this.limitar(this.cy);
    this.dibujar();
  }

  irA(k: number): void {
    const nuevo = Math.min(this.o.nCortes - 1, Math.max(0, k));
    if (nuevo === this.corte) return;
    this.corte = nuevo;
    this.deslizador.value = String(nuevo);
    this.actualizarRotulo();
    this.dibujar();
    this.o.alCambiarCorte?.(nuevo);
  }

  corteActual(): number {
    return this.corte;
  }

  /** Centra la vista en un punto (y el corte), p. ej. una marca o una lesión de referencia. */
  centrarEn(corte: number, x?: number, y?: number): void {
    if (x !== undefined && y !== undefined && this.zoom > 1) {
      this.cx = this.limitar(x);
      this.cy = this.limitar(y);
    }
    this.irA(corte);
    this.dibujar();
  }

  ponerMarcas(m: MarcaVisor[]): void {
    this.marcas = m;
    this.dibujar();
  }

  ponerContornos(c: Contorno[]): void {
    this.contornos = c;
    this.dibujar();
  }

  modoMarcado(activo: boolean, texto = ""): void {
    this.modoMarca = activo;
    this.el.classList.toggle("marcando", activo);
    vaciar(this.aviso, activo ? texto : "");
  }

  get marcando(): boolean {
    return this.modoMarca;
  }

  private actualizarRotulo(): void {
    this.rotuloCorte.textContent = `Corte ${this.corte + 1} / ${this.o.nCortes}`;
  }

  private precargar(): void {
    if (this.precargado) return;
    this.precargado = true;
    const orden = [...Array(this.o.nCortes).keys()].sort((a, b) => Math.abs(a - this.corte) - Math.abs(b - this.corte));
    let i = 0;
    const siguiente = () => {
      const lote = orden.slice(i, i + 3);
      i += 3;
      for (const k of lote) for (const seq of this.o.secuencias) imagen(urlImagen(this.o.caso, seq, k), () => {});
      if (i < orden.length) setTimeout(siguiente, 60);
    };
    siguiente();
  }

  dibujar(): void {
    for (const [seq, c] of this.lienzos) {
      const ctx = c.getContext("2d");
      if (!ctx) continue;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "none";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, N, N);
      ctx.setTransform(this.zoom, 0, 0, this.zoom, N / 2 - this.cx * this.zoom, N / 2 - this.cy * this.zoom);
      const img = imagen(urlImagen(this.o.caso, seq, this.corte), () => this.dibujar());
      if (img.complete && img.naturalWidth) {
        ctx.filter = `brightness(${this.brillo}) contrast(${this.contraste})`;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, N, N);
        ctx.filter = "none";
      }
      const grosor = 1.6 / this.zoom;
      for (const ct of this.contornos.filter((x) => x.corte === this.corte)) {
        ctx.beginPath();
        for (const poly of ct.polys) {
          poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x!, y!) : ctx.lineTo(x!, y!)));
          ctx.closePath();
        }
        if (ct.relleno) {
          ctx.fillStyle = ct.relleno;
          ctx.fill("evenodd");
        }
        ctx.strokeStyle = ct.color;
        ctx.lineWidth = grosor;
        ctx.stroke();
      }
      for (const m of this.marcas.filter((x) => x.corte === this.corte)) {
        const r = 7 / this.zoom;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = grosor * 2.6;
        this.cruz(ctx, m.x, m.y, r);
        ctx.strokeStyle = m.color;
        ctx.lineWidth = grosor * 1.2;
        this.cruz(ctx, m.x, m.y, r);
        ctx.font = `${13 / this.zoom}px system-ui, sans-serif`;
        ctx.fillStyle = m.color;
        ctx.fillText(m.etiqueta, m.x + r + 2 / this.zoom, m.y - r);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.fillText("D", 6, N / 2);
      ctx.fillText("I", N - 12, N / 2);
      ctx.fillText("A", N / 2 - 4, 14);
    }
    this.precargar();
  }

  private cruz(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r / 3, y);
    ctx.moveTo(x + r / 3, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y - r / 3);
    ctx.moveTo(x, y + r / 3);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }
}

/** Punto dentro de un conjunto de polígonos (regla par-impar). */
export function dentro(polys: number[][][], x: number, y: number): boolean {
  let d = false;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i]!;
      const [xj, yj] = p[j]!;
      if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) d = !d;
    }
  }
  return d;
}

import { h, leerNum, num, vaciar } from "../dom";
import { casos, corregir } from "../api";
import { almacen, type Borrador } from "../almacen";
import { Visor, type MarcaVisor } from "../visor";
import { mapaSectores } from "../mapa";
import { informeAlumno } from "../informe";
import { faltantesLectura, nombreFalta, type Falta } from "../../shared/faltantes";
import { intentoDesde } from "../../shared/progreso";
import { NOMBRE_ZONA_LARGA, zonaPrincipal } from "../../shared/sectores";
import { lecturaVacia, type LesionAlumno } from "../../shared/tipos";
import type { CasoPublico } from "../../shared/servidor";
import { cargando, errorCarga, lineaCaso } from "./comun";

const PASOS = ["Contexto clínico", "Lesiones", "Conclusión"];
const COLORES = ["#facc15", "#38bdf8", "#f472b6", "#a3e635", "#fb923c", "#c084fc"];

export async function vistaCaso(el: HTMLElement, id: string): Promise<void> {
  vaciar(el, cargando());
  let caso: CasoPublico | undefined;
  try {
    caso = (await casos()).find((c) => c.id === id);
  } catch {
    vaciar(el, errorCarga());
    return;
  }
  if (!caso) {
    vaciar(el, h("p", { class: "aviso" }, "No encuentro ese caso. ", h("a", { href: "#/casos" }, "Volver a la lista")));
    return;
  }
  new LecturaCaso(el, caso);
}

class LecturaCaso {
  private b: Borrador;
  private visor: Visor;
  private panel = h("div", { class: "panel-paso" });
  private pasos = h("ol", { class: "pasos" });
  private marcando: string | null = null;
  /** Tras un «Enviar» con la lectura incompleta: se muestran el resumen y los mensajes de cada campo. */
  private avisarFaltas = false;
  private reloj: number;

  constructor(el: HTMLElement, private caso: CasoPublico) {
    this.b = almacen.borrador(caso.id) ?? { lectura: lecturaVacia(), paso: 0, segundos: 0 };
    this.visor = new Visor({
      caso: caso.id,
      nCortes: caso.tecnica.n_cortes,
      secuencias: ["t2w", "adc", "hbv"],
      rotulos: { hbv: `b ${caso.tecnica.b_alto}` },
      alPulsar: (p) => this.pulsar(p),
    });
    this.reloj = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        this.b.segundos += 5;
        this.guardar();
      }
    }, 5000);
    window.addEventListener("hashchange", () => window.clearInterval(this.reloj), { once: true });

    vaciar(
      el,
      h("p", { class: "migas" }, h("a", { href: "#/casos" }, "Casos clínicos"), " / Caso ", String(caso.numero)),
      h("h1", null, `Caso ${caso.numero}`),
      h("p", { class: "entradilla" }, lineaCaso(caso)),
      this.pasos,
      h("div", { class: "disposicion-caso" }, h("div", { class: "columna-visor" }, this.visor.el, notaVisor(caso)), this.panel),
    );
    this.mostrar();
  }

  private guardar(): void {
    almacen.guardarBorrador(this.caso.id, this.b);
  }

  private get lectura() {
    return this.b.lectura;
  }

  private irA(paso: number): void {
    this.b.paso = paso;
    this.dejarDeMarcar();
    this.guardar();
    this.mostrar();
    this.panel.querySelector<HTMLElement>("h2")?.focus();
  }

  private mostrar(): void {
    vaciar(
      this.pasos,
      ...PASOS.map((t, i) =>
        h("li", { class: i === this.b.paso ? "actual" : i < this.b.paso ? "hecho" : "" },
          h("button", { type: "button", "aria-current": i === this.b.paso ? "step" : null, onclick: () => this.irA(i) }, `${i + 1}. ${t}`))),
    );
    this.pintarMarcas();
    if (this.b.paso === 0) this.pasoContexto();
    else if (this.b.paso === 1) this.pasoLesiones();
    else this.pasoConclusion();
    this.pintarErrores();
  }

  private pintarMarcas(): void {
    const marcas: MarcaVisor[] = [];
    this.lectura.lesiones.forEach((l, i) => {
      if (l.marca) marcas.push({ ...l.marca, etiqueta: l.id, color: COLORES[i % COLORES.length]! });
    });
    this.visor.ponerMarcas(marcas);
  }

  private pulsar(p: { corte: number; x: number; y: number }): void {
    let objetivo = this.marcando ? this.lectura.lesiones.find((l) => l.id === this.marcando) : undefined;
    if (!objetivo && this.lectura.lesiones.length === 0) {
      objetivo = this.nuevaLesion();
      this.b.paso = 1;
    }
    if (!objetivo) return;
    objetivo.marca = { corte: p.corte, x: p.x, y: p.y };
    this.dejarDeMarcar();
    this.guardar();
    this.mostrar();
  }

  private dejarDeMarcar(): void {
    this.marcando = null;
    this.visor.modoMarcado(false);
  }

  private nuevaLesion(): LesionAlumno {
    const usados = new Set(this.lectura.lesiones.map((l) => l.id));
    let n = 1;
    while (usados.has(`L${n}`)) n++;
    const l: LesionAlumno = { id: `L${n}`, sectores: [], t2: null, dwi: null, tamano: null, epe: null, pirads: null, marca: null };
    this.lectura.lesiones.push(l);
    return l;
  }

  // ── Paso 1 ──
  private pasoContexto(): void {
    const c = this.caso;
    const d = c.contexto_docente;
    const psad = h("input", {
      id: "psad", type: "text", inputmode: "decimal", autocomplete: "off", value: this.lectura.psad === null ? "" : num(this.lectura.psad),
      "aria-describedby": "psad-ayuda psad-error",
      oninput: () => { this.lectura.psad = leerNum(psad.value); this.guardar(); this.pintarErrores(); },
    });
    const impresion = h("textarea", { id: "impresion", rows: 4, oninput: () => { this.lectura.impresion = impresion.value; this.guardar(); } });
    impresion.value = this.lectura.impresion;
    vaciar(
      this.panel,
      h("h2", { tabindex: -1 }, "1. Contexto clínico"),
      h("dl", { class: "datos" },
        dato("Edad", `${c.edad} años`),
        dato("PSA", `${num(c.psa)} ng/mL`),
        dato("Volumen prostático (RM)", `${num(c.volumen)} mL`),
        dato("Tacto rectal", d.tacto_rectal),
        dato("Antecedentes familiares", d.antecedentes_familiares),
        dato("Inhibidor de la 5-alfa-reductasa", d.inhibidor_5ari ? "sí" : "no"),
        dato("Biopsias previas", d.biopsias_previas),
      ),
      h("p", { class: "nota" }, c.aviso_contexto),
      h("div", { class: "campo" },
        h("label", { for: "psad" }, "Densidad de PSA (ng/mL/mL)"),
        psad,
        h("p", { class: "ayuda", id: "psad-ayuda" }, "PSA dividido entre el volumen, con dos decimales."),
        h("p", { class: "error-campo", id: "psad-error" })),
      h("div", { class: "campo" },
        h("label", { for: "impresion" }, "Lectura libre (opcional)"),
        impresion,
        h("p", { class: "ayuda" }, "Antes de puntuar, recorre las tres secuencias y escribe lo que ves. No se corrige: te sirve para compararte después.")),
      h("div", { class: "acciones" }, h("button", { type: "button", class: "boton", onclick: () => this.irA(1) }, "Siguiente: lesiones")),
    );
  }

  // ── Paso 2 ──
  private pasoLesiones(): void {
    const lista = h("div", { class: "lesiones" });
    const pintarLista = () => {
      vaciar(lista, ...this.lectura.lesiones.map((l, i) => this.editorLesion(l, i, pintarLista)));
      if (!this.lectura.lesiones.length) {
        lista.append(h("p", { class: "nota" }, "No has marcado ninguna lesión. Si el estudio no tiene lesiones sospechosas, pasa a la conclusión."));
      }
    };
    pintarLista();
    vaciar(
      this.panel,
      h("h2", { tabindex: -1 }, "2. Lesiones"),
      h("p", null, "Anota cada lesión sospechosa (PI-RADS ≥3): sectores, puntuación de T2 y de DWI, tamaño, extensión y categoría. Puedes marcarla en la imagen."),
      lista,
      h("div", { class: "acciones" },
        h("button", { type: "button", class: "boton secundario", disabled: this.lectura.lesiones.length >= 6, onclick: () => { this.nuevaLesion(); this.guardar(); this.mostrar(); } }, "Añadir lesión"),
        h("button", { type: "button", class: "boton", onclick: () => this.irA(2) }, "Siguiente: conclusión")),
    );
  }

  private editorLesion(l: LesionAlumno, i: number, repintar: () => void): HTMLElement {
    const id = l.id;
    const zonaTexto = h("p", { class: "zona-deducida" });
    const pintarZona = () => {
      const z = zonaPrincipal(l.sectores);
      zonaTexto.textContent = z
        ? `Zona: ${NOMBRE_ZONA_LARGA[z]}${z === "PZ" ? " · en la zona periférica manda la DWI" : z === "TZ" ? " · en la zona de transición manda T2" : ""}.`
        : "Elige primero el sector o sectores (el primero que elijas es el principal).";
    };
    pintarZona();
    const selector = (etiqueta: string, campo: "t2" | "dwi" | "pirads") => {
      const s = h("select", {
        id: `${id}-${campo}`,
        onchange: () => { l[campo] = s.value ? Number(s.value) : null; this.guardar(); this.pintarErrores(); },
      }, h("option", { value: "" }, "—"), ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: l[campo] === n }, String(n))));
      return h("div", { class: "campo compacto" }, h("label", { for: `${id}-${campo}` }, etiqueta), s, h("p", { class: "error-campo", id: `${id}-${campo}-error` }));
    };
    const radios = <T extends string>(nombre: string, leyenda: string, opciones: Array<[T, string]>, actual: T | null, poner: (v: T) => void) =>
      h("fieldset", { class: "radios" }, h("legend", null, leyenda),
        ...opciones.map(([v, t]) => h("label", null,
          h("input", { type: "radio", name: `${id}-${nombre}`, value: v, checked: actual === v, onchange: () => { poner(v); this.guardar(); } }), " ", t)));
    const color = COLORES[i % COLORES.length]!;
    const botonMarca = h("button", {
      type: "button", class: "boton secundario pequeno",
      onclick: () => {
        if (this.marcando === id) { this.dejarDeMarcar(); botonMarca.textContent = l.marca ? "Cambiar la marca" : "Marcar en la imagen"; return; }
        this.marcando = id;
        this.visor.modoMarcado(true, `Haz clic sobre ${id} en cualquiera de las tres imágenes.`);
        botonMarca.textContent = "Cancelar marcado";
        this.visor.el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
    }, l.marca ? "Cambiar la marca" : "Marcar en la imagen");

    return h(
      "article",
      { class: "editor-lesion", style: `--color-lesion:${color}`, id: `lesion-${id}` },
      h("header", null,
        h("h3", null, id),
        l.marca ? h("button", { type: "button", class: "enlace", onclick: () => this.visor.centrarEn(l.marca!.corte, l.marca!.x, l.marca!.y) }, `Marcada en el corte ${l.marca.corte + 1}`) : h("span", { class: "nota" }, "Sin marca"),
        botonMarca,
        h("button", { type: "button", class: "enlace peligro", onclick: () => {
          this.lectura.lesiones = this.lectura.lesiones.filter((x) => x !== l);
          this.dejarDeMarcar(); this.guardar(); this.pintarMarcas(); repintar();
        } }, "Quitar")),
      h("div", { class: "campo" },
        h("span", { class: "etiqueta" }, "Sectores"),
        mapaSectores({ seleccion: l.sectores, casillas: true, etiqueta: `Sectores de ${id}`, alCambiar: (s) => { l.sectores = s; this.guardar(); pintarZona(); this.pintarErrores(); } }),
        h("p", { class: "error-campo", id: `${id}-sectores-error` })),
      zonaTexto,
      h("div", { class: "fila-campos" },
        selector("T2", "t2"),
        selector("DWI", "dwi"),
        h("div", { class: "campo compacto" }, h("span", { class: "etiqueta" }, "DCE"), h("p", { class: "fijo" }, "No disponible"))),
      radios("tamano", "Tamaño (eje mayor)", [["<1.5", "<1,5 cm"], [">=1.5", "≥1,5 cm"]], l.tamano, (v) => (l.tamano = v)),
      radios("epe", "Extensión extraprostática", [["no", "No definida"], ["definida", "Definida"]], l.epe, (v) => (l.epe = v)),
      selector("Categoría PI-RADS de la lesión", "pirads"),
    );
  }

  // ── Paso 3 ──
  private pasoConclusion(): void {
    const sugerida = Math.max(0, ...this.lectura.lesiones.map((l) => l.pirads ?? 0));
    const categoria = h("select", { id: "categoria", "aria-describedby": "categoria-ayuda categoria-error", onchange: () => {
      this.lectura.categoria = categoria.value ? Number(categoria.value) : null; this.guardar(); pintarInforme(); this.pintarErrores();
    } }, h("option", { value: "" }, "—"), ...[1, 2, 3, 4, 5].map((n) => h("option", { value: n, selected: this.lectura.categoria === n }, `PI-RADS ${n}`)));
    const informe = h("pre", { class: "informe" });
    const pintarInforme = () => (informe.textContent = informeAlumno(this.caso, this.lectura));
    pintarInforme();
    // Sugerencia sin rellenar sola: el desplegable sigue en «—» hasta que el alumno decide.
    const usar = sugerida
      ? h("button", { type: "button", class: "boton secundario pequeno", id: "usar-sugerida", onclick: () => {
          categoria.value = String(sugerida);
          this.lectura.categoria = sugerida; this.guardar(); pintarInforme(); this.pintarErrores();
        } }, `Usar PI-RADS ${sugerida}`)
      : null;
    const enviar = h("button", { type: "button", class: "boton", onclick: () => void this.enviar(enviar) }, "Enviar y ver la corrección");
    vaciar(
      this.panel,
      h("h2", { tabindex: -1 }, "3. Conclusión"),
      h("div", { class: "campo" },
        h("label", { for: "categoria" }, "Categoría PI-RADS del estudio"),
        categoria,
        h("p", { class: "ayuda", id: "categoria-ayuda" }, sugerida ? `La de tu lesión índice es ${sugerida}.` : "Sin lesiones sospechosas, el estudio es PI-RADS 1 o 2."),
        usar,
        h("p", { class: "error-campo", id: "categoria-error" })),
      h("fieldset", { class: "radios bloque", id: "decision", "aria-describedby": "decision-error" },
        h("legend", null, "Decisión clínica"),
        ...this.caso.opciones.map((o) => h("label", null,
          h("input", { type: "radio", name: "decision", value: o.id, checked: this.lectura.decision === o.id, onchange: () => { this.lectura.decision = o.id; this.guardar(); this.pintarErrores(); } }), " ", o.texto)),
        h("p", { class: "error-campo", id: "decision-error" })),
      h("h3", null, "Tu informe (borrador)"),
      informe,
      h("div", { class: "aviso error resumen-faltas", id: "faltas", tabindex: -1, hidden: true }),
      h("p", { class: "error-campo", id: "envio-error", role: "alert" }),
      h("div", { class: "acciones" }, enviar),
    );
  }

  private faltas(): Falta[] {
    return faltantesLectura(this.lectura, this.caso.opciones);
  }

  /**
   * Tras un envío incompleto, pinta el resumen y el mensaje junto a cada campo del paso visible.
   * Solo `anunciar` (al pulsar «Enviar») le da `role="alert"`: al ir rellenando campos el resumen se
   * actualiza en silencio, sin volver a leerse entero; ya se anuncia el mensaje junto a cada campo.
   */
  private pintarErrores(anunciar = false): void {
    if (!this.avisarFaltas) return;
    const faltas = this.faltas();
    for (const p of this.panel.querySelectorAll<HTMLElement>(".error-campo")) if (p.id !== "envio-error") p.textContent = "";
    for (const f of faltas) {
      const msg = document.getElementById(`${idCampo(f)}-error`);
      if (msg) msg.textContent = mensajeCampo(f);
    }
    const resumen = document.getElementById("faltas");
    if (!resumen) return;
    if (anunciar) resumen.setAttribute("role", "alert");
    else resumen.removeAttribute("role");
    resumen.hidden = !faltas.length;
    vaciar(resumen, ...(faltas.length ? [
      h("strong", null, "Para corregir falta: "),
      ...faltas.flatMap((f, i) => [
        ...(i ? [" · "] : []),
        h("button", { type: "button", class: "enlace", onclick: () => this.irAlCampo(f) }, nombreFalta(f)),
      ]),
    ] : []));
  }

  /** Lleva al paso de la falta y pone el foco en su campo. */
  private irAlCampo(f: Falta): void {
    if (f.paso !== this.b.paso) this.irA(f.paso);
    const control = controlCampo(f);
    control?.focus();
    control?.scrollIntoView({ block: "center" });
  }

  private async enviar(boton: HTMLButtonElement): Promise<void> {
    const faltas = this.faltas();
    if (faltas.length) {
      this.avisarFaltas = true;
      this.pintarErrores(true);
      const resumen = document.getElementById("faltas");
      resumen?.focus();
      resumen?.scrollIntoView({ block: "center" });
      return;
    }
    boton.disabled = true;
    boton.textContent = "Corrigiendo…";
    try {
      const r = await corregir(this.caso.id, this.lectura);
      const p = almacen.progreso();
      const intento = intentoDesde(this.caso.id, this.lectura, r.resultado, this.b.segundos);
      p.intentos.push(intento);
      if (!almacen.guardarProgreso(p)) throw new Error("No se ha podido guardar el intento en este navegador.");
      almacen.borrarBorrador(this.caso.id);
      window.clearInterval(this.reloj);
      location.hash = `#/correccion/${encodeURIComponent(intento.id)}`;
    } catch (e) {
      boton.disabled = false;
      boton.textContent = "Enviar y ver la corrección";
      const msg = document.getElementById("envio-error");
      if (msg) msg.textContent = e instanceof Error && e.message ? e.message : "No se ha podido corregir. Inténtalo de nuevo.";
    }
  }
}

function idCampo(f: Falta): string {
  return f.lesion ? `${f.lesion}-${f.campo}` : f.campo === "opcion" ? "decision" : f.campo;
}

function controlCampo(f: Falta): HTMLElement | null {
  if (f.campo === "sectores") return document.querySelector<HTMLElement>(`#lesion-${CSS.escape(f.lesion ?? "")} .sector`);
  if (f.campo === "decision" || f.campo === "opcion") return document.querySelector<HTMLElement>("#decision input");
  return document.getElementById(idCampo(f));
}

/** El mensaje junto a cada campo, el mismo que había antes del resumen. */
function mensajeCampo(f: Falta): string {
  switch (f.campo) {
    case "psad": return "Escribe la densidad de PSA (por ejemplo, 0,15).";
    case "sectores": return `Elige al menos un sector para ${f.lesion}, o quita la lesión.`;
    case "pirads": return `Pon la categoría PI-RADS de ${f.lesion}.`;
    case "categoria": return "Elige la categoría PI-RADS del estudio.";
    case "decision":
    case "opcion": return "Elige una decisión clínica.";
  }
}

function dato(t: string, v: string): HTMLElement[] {
  return [h("dt", null, t), h("dd", null, v)];
}

export function notaVisor(c: CasoPublico): HTMLElement {
  return h("p", { class: "nota visor-nota" },
    `Axial, convención radiológica: la derecha del paciente (D) a la izquierda de la pantalla. ${c.tecnica.equipo}, cortes de ${num(c.tecnica.grosor_corte_mm)} mm. `,
    "ADC y b alto remuestreados a la geometría de T2; las zonas negras en los bordes quedan fuera del volumen adquirido. ",
    "Clic en el visor y flechas, o Mayúsculas + rueda, para cambiar de corte.");
}

import { h, num, vaciar } from "../dom";
import { casos } from "../api";
import { Visor, dentro, type Contorno } from "../visor";
import { mapaSectores } from "../mapa";
import type { CasoPublico } from "../../shared/servidor";
import { cargando, errorCarga } from "./comun";

interface Zonal {
  cortes: Record<string, { PZ?: number[][][]; TZ?: number[][][] }>;
}

const COLOR = { PZ: "#22c55e", TZ: "#38bdf8" };
const RELLENO = { PZ: "rgba(34,197,94,.22)", TZ: "rgba(56,189,248,.22)" };

export async function vistaAnatomia(el: HTMLElement): Promise<void> {
  vaciar(el, cargando());
  let lista: CasoPublico[];
  try {
    lista = (await casos()).filter((c) => c.zonal);
  } catch {
    vaciar(el, errorCarga());
    return;
  }
  const hueco = h("div", { class: "columna-visor" });
  const respuesta = h("p", { class: "respuesta-clic", "aria-live": "polite" }, "Haz clic en cualquier punto de la imagen: te diré la zona, el lado y el nivel.");
  const verPZ = h("input", { type: "checkbox", checked: true });
  const verTZ = h("input", { type: "checkbox", checked: true });
  const selector = h("select", { id: "glandula" }, ...lista.map((c, i) => h("option", { value: c.id }, `Próstata ${"ABCDE"[i]} · ${num(c.volumen)} mL`)));

  let visor: Visor | null = null;
  let zonal: Zonal | null = null;
  let rango: [number, number] = [0, 0];

  const contornos = (): Contorno[] => {
    if (!zonal) return [];
    const r: Contorno[] = [];
    for (const [k, z] of Object.entries(zonal.cortes)) {
      if (verPZ.checked && z.PZ) r.push({ corte: Number(k), polys: z.PZ, color: COLOR.PZ, relleno: RELLENO.PZ });
      if (verTZ.checked && z.TZ) r.push({ corte: Number(k), polys: z.TZ, color: COLOR.TZ, relleno: RELLENO.TZ });
    }
    return r;
  };
  const nivel = (k: number): string => {
    const [a, b] = rango;
    if (k < a || k > b) return "fuera de la glándula (por encima de la base o por debajo del ápex)";
    const t = (k - a) / Math.max(1, b - a);
    return t < 1 / 3 ? "ápex" : t < 2 / 3 ? "tercio medio" : "base";
  };

  const cargar = async (id: string) => {
    const c = lista.find((x) => x.id === id)!;
    try {
      zonal = (await (await fetch(`/casos/${id}/zonal.json`)).json()) as Zonal;
    } catch {
      zonal = { cortes: {} };
    }
    const ks = Object.keys(zonal.cortes).map(Number).sort((a, b) => a - b);
    rango = [ks[0] ?? 0, ks[ks.length - 1] ?? c.tecnica.n_cortes - 1];
    visor = new Visor({
      caso: id,
      nCortes: c.tecnica.n_cortes,
      secuencias: ["t2w"],
      corte: Math.round((rango[0] + rango[1]) / 2),
      alPulsar: (p) => {
        const z = zonal?.cortes[String(p.corte)];
        const zona = z?.PZ && dentro(z.PZ, p.x, p.y) ? "zona periférica" : z?.TZ && dentro(z.TZ, p.x, p.y) ? "zona de transición" : null;
        const lado = p.x < 192 ? "derecho" : "izquierdo";
        visor?.ponerMarcas([{ ...p, etiqueta: "", color: "#facc15" }]);
        respuesta.textContent = zona
          ? `${zona[0]!.toUpperCase()}${zona.slice(1)}, lado ${lado} del paciente, ${nivel(p.corte)}.`
          : `Fuera de las zonas segmentadas (cápsula, estroma anterior, uretra o tejido periprostático). Lado ${lado}; ${nivel(p.corte)}.`;
      },
    });
    visor.ponerContornos(contornos());
    vaciar(hueco, visor.el,
      h("p", { class: "nota" }, h("span", { class: "muestra", style: `background:${COLOR.PZ}` }), " Zona periférica  ",
        h("span", { class: "muestra", style: `background:${COLOR.TZ}` }), " Zona de transición (incluye la zona central, que PI-CAI no separa)"),
      h("p", { class: "nota" }, "Segmentación zonal de PI-CAI (picai_labels), remuestreada a la imagen. Es automática y puede tener pequeños errores en los bordes."));
  };
  verPZ.addEventListener("change", () => visor?.ponerContornos(contornos()));
  verTZ.addEventListener("change", () => visor?.ponerContornos(contornos()));
  selector.addEventListener("change", () => void cargar(selector.value));

  vaciar(
    el,
    h("h1", null, "Módulo 1 · Anatomía zonal en RM"),
    h("p", { class: "entradilla" }, "Antes de puntuar hay que saber dónde se está. Recorre una próstata real en T2 con las zonas superpuestas y comprueba tu orientación haciendo clic sobre la imagen."),
    h("div", { class: "disposicion-caso" },
      hueco,
      h("div", { class: "panel-paso" },
        h("div", { class: "campo" }, h("label", { for: "glandula" }, "Estudio"), selector),
        h("fieldset", { class: "radios" }, h("legend", null, "Mostrar"),
          h("label", null, verPZ, " Zona periférica"), h("label", null, verTZ, " Zona de transición")),
        respuesta,
        h("h2", null, "Cómo orientarte"),
        h("ul", null,
          h("li", null, h("strong", null, "Convención radiológica: "), "la derecha del paciente se ve a la izquierda de la pantalla (D) y la parte anterior arriba (A)."),
          h("li", null, h("strong", null, "Niveles: "), "los cortes van del ápex (a la izquierda del deslizador) a la base (a la derecha). PI-RADS divide la glándula en tres tercios: base, tercio medio y ápex."),
          h("li", null, h("strong", null, "Zona periférica (ZP): "), "posterior y lateral, en forma de media luna; brillante en T2. Asienta en torno al 70 % de los cánceres. En ella, la categoría la decide la DWI."),
          h("li", null, h("strong", null, "Zona de transición (ZT): "), "central y anterior, rodea la uretra; crece con la hiperplasia y forma nódulos. En ella, la categoría la decide T2."),
          h("li", null, h("strong", null, "Zona central (ZC): "), "en la base, posterior, rodea los conductos eyaculadores; es hipointensa de forma simétrica y no hay que confundirla con una lesión."),
          h("li", null, h("strong", null, "Estroma fibromuscular anterior (EFMA): "), "banda anterior, hipointensa en T2 y en ADC, sin lesión.")),
      )),
    h("h2", null, "Mapa de 38 sectores (PI-RADS v2.1)"),
    h("p", null, "Es el mapa con el que se localizan las lesiones en el Módulo 3. Pasa el cursor (o el foco) por cada sector para ver su nombre."),
    mapaSectores({ soloLectura: false, casillas: false, etiqueta: "Mapa de sectores para explorar" }),
    h("ul", { class: "nota" },
      h("li", null, "ZP: anterior, posterolateral y posteromedial, a cada lado y en cada nivel."),
      h("li", null, "ZT: anterior y posterior. En la base, la zona central ocupa la parte posteromedial."),
      h("li", null, "Estroma anterior: a cada lado de la línea media y en cada nivel.")),
    h("div", { class: "acciones" }, h("a", { class: "boton", href: "#/secuencias" }, "Siguiente: Módulo 2 · Secuencias")),
  );
  if (lista[0]) await cargar(lista[0].id);
}

/**
 * Mapa de 38 sectores de PI-RADS v2.1 en un esquema axial por nivel.
 *
 * Códigos: `<nivel>_<zona>_<sub>_<lado>` (ZP y ZT) o `<nivel>_<zona>_<lado>` (zona central y
 * estroma anterior). Lado D = derecha del paciente, I = izquierda.
 *
 * La geometría (anillo y arco) sirve para dibujar el mapa y para deducir qué sectores son
 * contiguos. Ángulos en grados de pantalla: 0 = derecha de la pantalla, sentido horario
 * (90 = abajo, posterior; 270 = arriba, anterior). Convención radiológica: la derecha del
 * paciente queda a la izquierda de la pantalla, es decir, entre 90 y 270.
 */

export type Nivel = "base" | "mid" | "apex";
export type Zona = "PZ" | "TZ" | "CZ" | "AS";
export type Lado = "D" | "I";
export type Anillo = "interno" | "externo";

export interface Sector {
  codigo: string;
  nivel: Nivel;
  zona: Zona;
  sub: string | null;
  lado: Lado;
  anillo: Anillo;
  /** Arco en grados de pantalla, desde < hasta (hasta puede pasar de 360). */
  desde: number;
  hasta: number;
}

export const NIVELES: Nivel[] = ["base", "mid", "apex"];

export const NOMBRE_NIVEL: Record<Nivel, string> = {
  base: "Base",
  mid: "Tercio medio",
  apex: "Ápex",
};

const NOMBRE_ZONA: Record<string, string> = {
  PZ_a: "ZP anterior",
  PZ_pl: "ZP posterolateral",
  PZ_pm: "ZP posteromedial",
  TZ_a: "ZT anterior",
  TZ_p: "ZT posterior",
  CZ: "zona central",
  AS: "estroma fibromuscular anterior",
};

export const NOMBRE_ZONA_LARGA: Record<Zona, string> = {
  PZ: "zona periférica",
  TZ: "zona de transición",
  CZ: "zona central",
  AS: "estroma fibromuscular anterior",
};

/** Arcos del lado derecho del paciente (izquierda de la pantalla). El izquierdo es su espejo. */
function arcosDerecha(nivel: Nivel): Array<Omit<Sector, "codigo" | "nivel" | "lado">> {
  const arcos: Array<Omit<Sector, "codigo" | "nivel" | "lado">> = [
    { zona: "PZ", sub: "pm", anillo: "externo", desde: 90, hasta: 120 },
    { zona: "PZ", sub: "pl", anillo: "externo", desde: 120, hasta: 180 },
    { zona: "PZ", sub: "a", anillo: "externo", desde: 180, hasta: 225 },
    { zona: "AS", sub: null, anillo: "externo", desde: 225, hasta: 270 },
    { zona: "TZ", sub: "a", anillo: "interno", desde: 180, hasta: 270 },
  ];
  if (nivel === "base") {
    arcos.push(
      { zona: "CZ", sub: null, anillo: "interno", desde: 90, hasta: 135 },
      { zona: "TZ", sub: "p", anillo: "interno", desde: 135, hasta: 180 },
    );
  } else {
    arcos.push({ zona: "TZ", sub: "p", anillo: "interno", desde: 90, hasta: 180 });
  }
  return arcos;
}

function codigoDe(nivel: Nivel, zona: Zona, sub: string | null, lado: Lado): string {
  return sub ? `${nivel}_${zona}_${sub}_${lado}` : `${nivel}_${zona}_${lado}`;
}

function construir(): Sector[] {
  const lista: Sector[] = [];
  for (const nivel of NIVELES) {
    for (const a of arcosDerecha(nivel)) {
      lista.push({ ...a, nivel, lado: "D", codigo: codigoDe(nivel, a.zona, a.sub, "D") });
      // Espejo respecto al eje vertical: ángulo θ → 180 − θ.
      const desde = (180 - a.hasta + 360) % 360;
      const hasta = desde + (a.hasta - a.desde);
      lista.push({ ...a, nivel, lado: "I", desde, hasta, codigo: codigoDe(nivel, a.zona, a.sub, "I") });
    }
  }
  return lista;
}

export const SECTORES: Sector[] = construir();
const POR_CODIGO = new Map(SECTORES.map((s) => [s.codigo, s]));

export function sector(codigo: string): Sector | undefined {
  return POR_CODIGO.get(codigo);
}

export function esSector(codigo: string): boolean {
  return POR_CODIGO.has(codigo);
}

/** «Tercio medio · ZP posterolateral · lado derecho» */
export function nombreSector(codigo: string): string {
  const s = POR_CODIGO.get(codigo);
  if (!s) return codigo;
  const zona = NOMBRE_ZONA[s.sub ? `${s.zona}_${s.sub}` : s.zona];
  return `${NOMBRE_NIVEL[s.nivel]} · ${zona} · lado ${s.lado === "D" ? "derecho" : "izquierdo"}`;
}

/** Versión corta para etiquetas: «Medio · ZP posterolateral D» */
export function nombreCorto(codigo: string): string {
  const s = POR_CODIGO.get(codigo);
  if (!s) return codigo;
  const nivel = s.nivel === "mid" ? "Medio" : NOMBRE_NIVEL[s.nivel];
  return `${nivel} · ${NOMBRE_ZONA[s.sub ? `${s.zona}_${s.sub}` : s.zona]} ${s.lado}`;
}

/** Sustituye en un texto los códigos de sector por su nombre legible. */
export function legibilizar(texto: string): string {
  return texto
    .replace(/\s*\(((?:(?:base|mid|apex)_[A-Za-z_]+(?:,\s*)?)+)\)/g, (_, lista: string) => {
      const nombres = lista.split(/,\s*/).map((c) => nombreSector(c.trim()));
      return ` (${nombres.join("; ")})`;
    })
    .replace(/\b(?:base|mid|apex)_(?:PZ|TZ|CZ|AS)(?:_[a-z]+)?_[DI]\b/g, (c) => nombreSector(c));
}

function normalizar(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Longitud del solape entre dos arcos (en grados). */
function solapeArcos(a: Sector, b: Sector): number {
  let total = 0;
  for (const desplazamiento of [-360, 0, 360]) {
    const ini = Math.max(a.desde, b.desde + desplazamiento);
    const fin = Math.min(a.hasta, b.hasta + desplazamiento);
    if (fin > ini) total += fin - ini;
  }
  return total;
}

function arcosSeTocan(a: Sector, b: Sector): boolean {
  return normalizar(a.hasta) === normalizar(b.desde) || normalizar(b.hasta) === normalizar(a.desde);
}

const NIVEL_INDICE: Record<Nivel, number> = { base: 0, mid: 1, apex: 2 };

/**
 * Dos sectores son contiguos si comparten borde en el mismo nivel (mismo anillo y arcos que se
 * tocan, o anillos distintos con arcos que se solapan), o si son el mismo sector en niveles
 * consecutivos. La zona central de la base es contigua a la ZT posterior del tercio medio.
 */
export function sonAdyacentes(c1: string, c2: string): boolean {
  const a = POR_CODIGO.get(c1);
  const b = POR_CODIGO.get(c2);
  if (!a || !b || c1 === c2) return false;
  if (a.nivel === b.nivel) {
    if (a.anillo === b.anillo) return arcosSeTocan(a, b);
    return solapeArcos(a, b) > 0;
  }
  if (Math.abs(NIVEL_INDICE[a.nivel] - NIVEL_INDICE[b.nivel]) !== 1 || a.lado !== b.lado) return false;
  if (a.zona === b.zona && a.sub === b.sub) return true;
  const [base, otro] = a.nivel === "base" ? [a, b] : [b, a];
  return base.zona === "CZ" && otro.nivel === "mid" && otro.zona === "TZ" && otro.sub === "p";
}

export function ladoDe(codigos: string[]): Lado | "ambos" | null {
  const lados = new Set(codigos.map((c) => POR_CODIGO.get(c)?.lado).filter(Boolean));
  if (lados.size === 0) return null;
  return lados.size === 2 ? "ambos" : (lados.values().next().value as Lado);
}

/** Zona del sector principal (el primero elegido). */
export function zonaPrincipal(codigos: string[]): Zona | null {
  for (const c of codigos) {
    const s = POR_CODIGO.get(c);
    if (s) return s.zona;
  }
  return null;
}

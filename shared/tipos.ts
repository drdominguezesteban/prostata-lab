/** Tipos de los casos del autor (datos/casos.json) y de la lectura del alumno. */

export type Tamano = "<1.5" | ">=1.5";
export type Epe = "no" | "definida";

export interface LesionReferencia {
  id: string;
  indice: boolean;
  sospechosa: boolean;
  zona: "PZ" | "TZ" | "CZ" | "AS";
  sectores: string[];
  t2: number;
  dwi: number;
  dce: string;
  tamano: Tamano;
  epe: Epe;
  pirads_global: number;
  explicacion: string;
}

export interface OpcionDecision {
  id: string;
  texto: string;
}

export interface Caso {
  id: string;
  numero: number;
  nivel: number;
  contexto_real: { edad: number; psa_ng_ml: number; volumen_ml: number; psad: number; psad_calculada: boolean };
  contexto_docente: {
    tacto_rectal: string;
    antecedentes_familiares: string;
    inhibidor_5ari: boolean;
    biopsias_previas: string;
  };
  aviso_contexto: string;
  densidad_psa_correcta: number;
  categoria_estudio: number;
  estrato_referencia: string;
  desenlace_real: string;
  medicion: string | null;
  lesiones: LesionReferencia[];
  decision: {
    opciones: OpcionDecision[];
    correcta: string[];
    aceptable: string[];
    critico_si_elige: string[];
    explicacion: string;
    via_preferente: string;
  };
  informe_referencia: string;
  errores_frecuentes: Array<{ si: string; feedback: string }>;
  tecnica: { n_cortes: number; mm_por_px: number; grosor_corte_mm: number; b_alto: number; equipo: string };
}

export interface Marca {
  corte: number;
  x: number;
  y: number;
}

export interface LesionAlumno {
  id: string;
  sectores: string[];
  t2: number | null;
  dwi: number | null;
  tamano: Tamano | null;
  epe: Epe | null;
  pirads: number | null;
  marca: Marca | null;
}

export interface Lectura {
  psad: number | null;
  lesiones: LesionAlumno[];
  categoria: number | null;
  decision: string | null;
  /** Impresión libre antes de puntuar; no se corrige. */
  impresion: string;
}

export function lecturaVacia(): Lectura {
  return { psad: null, lesiones: [], categoria: null, decision: null, impresion: "" };
}

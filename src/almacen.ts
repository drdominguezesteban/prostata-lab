/** Todo lo que se guarda vive en este navegador (localStorage). Nada se envía a ningún servidor. */
import { grupoVacio, progresoVacio, type Grupo, type Progreso } from "../shared/progreso";
import type { Lectura } from "../shared/tipos";

const CLAVE_PROGRESO = "prostata-lab:progreso:v1";
const CLAVE_GRUPO = "prostata-lab:docente:v1";
const CLAVE_BORRADOR = "prostata-lab:borrador:v1:";

function leer<T>(clave: string, defecto: () => T): T {
  try {
    const t = localStorage.getItem(clave);
    return t ? (JSON.parse(t) as T) : defecto();
  } catch {
    return defecto();
  }
}

function escribir(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export const almacen = {
  progreso: (): Progreso => leer(CLAVE_PROGRESO, progresoVacio),
  guardarProgreso: (p: Progreso) => escribir(CLAVE_PROGRESO, p),
  borrarProgreso: () => {
    try {
      localStorage.removeItem(CLAVE_PROGRESO);
    } catch {
      /* sin almacén */
    }
  },
  grupo: (): Grupo => leer(CLAVE_GRUPO, grupoVacio),
  guardarGrupo: (g: Grupo) => escribir(CLAVE_GRUPO, g),
  borrador: (caso: string): Borrador | null => leer<Borrador | null>(CLAVE_BORRADOR + caso, () => null),
  guardarBorrador: (caso: string, b: Borrador) => escribir(CLAVE_BORRADOR + caso, b),
  borrarBorrador: (caso: string) => {
    try {
      localStorage.removeItem(CLAVE_BORRADOR + caso);
    } catch {
      /* sin almacén */
    }
  },
};

export interface Borrador {
  lectura: Lectura;
  paso: number;
  segundos: number;
}

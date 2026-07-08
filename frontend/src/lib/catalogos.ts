import { api } from './api';

/**
 * Cache en memoria de los catálogos DIAN. Se carga UNA vez por sesión
 * al montar el primer componente que los pida, y todos los demás lo
 * reusan (Promise única).
 */

export interface CatalogoItem {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export interface Departamento {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Municipio {
  id: number;
  departamento_id: number;
  codigo: string;
  nombre: string;
}

export interface CatalogosDian {
  tipos_documento: CatalogoItem[];
  tipos_organizacion: CatalogoItem[];
  tipos_responsabilidad: CatalogoItem[];
  tipos_regimen: CatalogoItem[];
  tipos_adquirente: CatalogoItem[];
  departamentos: Departamento[];
}

let cache: Promise<CatalogosDian> | null = null;

export function cargarCatalogos(): Promise<CatalogosDian> {
  if (!cache) {
    cache = api.get<CatalogosDian>('/catalogos').then((r) => r.data);
  }
  return cache;
}

export async function buscarMunicipios(departamentoId?: number, q?: string): Promise<Municipio[]> {
  const params: Record<string, unknown> = {};
  if (departamentoId) params.departamento_id = departamentoId;
  if (q) params.q = q;
  const { data } = await api.get<{ municipios: Municipio[] }>('/catalogos/municipios', { params });
  return data.municipios;
}

/**
 * DV oficial DIAN. Mismo algoritmo del backend — se calcula en client
 * para feedback instantáneo mientras el usuario tipea el NIT.
 */
export function calcularDv(identificacion: string): string {
  const num = (identificacion ?? '').replace(/\D/g, '');
  if (!num || num.length > 15) return '';
  const primos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const digits = num.split('').reverse();
  let suma = 0;
  for (let i = 0; i < digits.length && i < primos.length; i++) {
    suma += parseInt(digits[i]) * primos[i];
  }
  const mod = suma % 11;
  return mod >= 2 ? String(11 - mod) : String(mod);
}

/**
 * Utilidades para normalización de nombres de localidades y formateo en Title Case / Capitalize en el Core.
 * Mapea barrios y parajes censales a sus municipios de cabecera en Jujuy (ej. Barrio El Milagro y Ovejería -> Monterrico).
 */

const LOWERCASE_CONNECTORS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'al']);

export const LOCALITY_CANONICAL_MAP: Record<string, string> = {
  'barrio el milagro': 'Monterrico',
  'el milagro': 'Monterrico',
  'ovejeria': 'Monterrico',
  'la ovejeria': 'Monterrico',
  'barrio ovejeria': 'Monterrico',
  'barrio odij': 'Palpalá',
  'barrio parque la cienaga': 'El Carmen',
  'barrio la cienaga': 'El Carmen',
  'parque la cienaga': 'El Carmen',
  'la cienaga': 'El Carmen',
  'carahunco': 'Palpalá',
  'centro forestal': 'Palpalá',
  'rio blanco': 'Palpalá',
  'los alisos': 'San Antonio',
  'san bernardo': 'Tumbaya',
  'ciudad de nieva': 'San Salvador de Jujuy',
  'alto comedero': 'San Salvador de Jujuy',
};

export function cleanText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toTitleCase(input: string): string {
  if (!input || !input.trim()) return '';

  let text = input.trim();
  text = text.replace(/\bldor\.?\s+gral\.?\s+san\s+martin\b/gi, 'Libertador Gral. San Martín');
  text = text.replace(/\bldor\b/gi, 'Libertador');
  text = text.replace(/\bgral\.?\b/gi, 'Gral.');

  const words = text.split(/\s+/);
  const formatted = words.map((word, index) => {
    const cleanWord = word.toLowerCase();
    if (['CAPS', 'CIC', 'ODIJ', 'AFIP', 'SAME'].includes(word.toUpperCase())) {
      return word.toUpperCase();
    }
    if (index > 0 && LOWERCASE_CONNECTORS.has(cleanWord)) {
      return cleanWord;
    }
    if (word.endsWith('.')) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return formatted.join(' ');
}

export function normalizeLocalityName(rawName: string): string {
  if (!rawName || !rawName.trim()) return 'Sin localidad';

  const cleaned = cleanText(rawName);
  if (LOCALITY_CANONICAL_MAP[cleaned]) {
    return LOCALITY_CANONICAL_MAP[cleaned];
  }

  if (cleaned === 'san salvador de jujuy' || cleaned === 'jujuy' || cleaned === 'capital') return 'San Salvador de Jujuy';
  if (cleaned === 'san pedro de jujuy' || cleaned === 'san pedro') return 'San Pedro de Jujuy';
  if (cleaned === 'palpala') return 'Palpalá';
  if (cleaned === 'monterrico') return 'Monterrico';
  if (cleaned === 'perico' || cleaned === 'ciudad perico') return 'Perico';
  if (cleaned === 'la quiaca') return 'La Quiaca';
  if (cleaned === 'tilcara') return 'Tilcara';
  if (cleaned === 'humahuaca') return 'Humahuaca';
  if (cleaned === 'abra pampa') return 'Abra Pampa';
  if (cleaned === 'calilegua') return 'Calilegua';
  if (cleaned === 'el carmen') return 'El Carmen';
  if (cleaned === 'fraile pintado') return 'Fraile Pintado';
  if (cleaned === 'la esperanza') return 'La Esperanza';
  if (cleaned === 'la mendieta') return 'La Mendieta';
  if (cleaned === 'yuto') return 'Yuto';
  if (cleaned === 'barcena') return 'Bárcena';
  if (cleaned.includes('libertador') || cleaned.includes('san martin')) return 'Libertador Gral. San Martín';

  return toTitleCase(rawName);
}


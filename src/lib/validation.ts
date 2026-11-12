/**
 * TecniFlow - Validações e Regras de Negócio Brasileiras
 *
 * Fornece:
 * 1. Validação estrita de telefones fixos e celulares brasileiros (DDD + 8 ou 9 dígitos, rejeição de repetições).
 * 2. Validação oficial de CPF e CNPJ (com cálculo de dígitos verificadores e rejeição de sequências repetidas).
 * 3. Validação de exclusão mútua de condições de entrada e acessórios.
 */

// Lista oficial de DDDs válidos no Brasil
const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

/**
 * Valida telefone/WhatsApp brasileiro:
 * - 10 dígitos: DDD (2) + Fixo (8 dígitos, primeiro dígito 2 a 5)
 * - 11 dígitos: DDD (2) + Celular (9 dígitos, primeiro dígito 9)
 * - Rejeita números com todos os dígitos iguais (ex.: 00000000000, 11111111111)
 * - Rejeita DDDs inexistentes
 */
export function isValidBrazilianPhone(rawPhone: string): boolean {
  if (!rawPhone || typeof rawPhone !== 'string') return false;
  if (!/^[0-9+(). \-]+$/.test(rawPhone)) return false;
  let digits = rawPhone.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);

  // Tamanho deve ser 10 ou 11 dígitos
  if (digits.length !== 10 && digits.length !== 11) {
    return false;
  }

  // Rejeita sequências de dígitos idênticos (ex: 00000000000, 99999999999)
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  const ddd = digits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return false;
  }

  const numberPart = digits.slice(2);

  // Celular (11 dígitos): deve começar com 9 e ter comprimento 9
  if (digits.length === 11) {
    if (numberPart[0] !== '9') return false;
  }

  // Fixo (10 dígitos): deve começar com 2, 3, 4 ou 5
  if (digits.length === 10) {
    if (!['2', '3', '4', '5'].includes(numberPart[0])) return false;
  }

  return true;
}

/**
 * Valida CPF oficial pelo cálculo dos dois dígitos verificadores
 */
export function isValidCPF(rawCpf: string): boolean {
  if (!rawCpf || typeof rawCpf !== 'string') return false;
  const digits = rawCpf.replace(/\D/g, '');

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[9], 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[10], 10)) return false;

  return true;
}

/**
 * Valida CNPJ oficial pelo cálculo dos dois dígitos verificadores
 */
export function isValidCNPJ(rawCnpj: string): boolean {
  if (typeof rawCnpj !== 'string' || !/^[A-Za-z0-9./ \-]+$/.test(rawCnpj)) return false;
  const value = rawCnpj.toUpperCase().replace(/[./ \-]/g, '');
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value)) return false;
  const weights = [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]];
  return weights.every((w, j) => {
    const sum = w.reduce((total, weight, i) => total + (value.charCodeAt(i) - 48) * weight, 0);
    return Number(value[12+j]) === (sum % 11 < 2 ? 0 : 11 - sum % 11);
  });
}

/**
 * Valida documento opcional (CPF ou CNPJ):
 * Se vazio/não preenchido, é válido (opcional).
 * Se preenchido, deve ser um CPF ou CNPJ formalmente válido.
 */
export function isValidDocumentOrEmpty(doc?: string | null): boolean {
  if (doc === null || doc === undefined || doc.trim() === '') return true;
  if (!/^[A-Za-z0-9./ \-]+$/.test(doc)) return false;
  const value = doc.toUpperCase().replace(/[./ \-]/g, '');
  if (/^[0-9]{11}$/.test(value)) return isValidCPF(value);
  return isValidCNPJ(value);
}

export function contactValidationError(phone: string, whatsapp = '', document = '', phoneRequired = true): string | null {
  if ((phoneRequired || phone.trim()) && !isValidBrazilianPhone(phone)) return 'Telefone inválido. Informe DDD e um número brasileiro válido.';
  if (whatsapp.trim() && !isValidBrazilianPhone(whatsapp)) return 'WhatsApp inválido. Confira o DDD e o número.';
  if (!isValidDocumentOrEmpty(document)) return 'CPF/CNPJ inválido. Confira os caracteres e os dígitos verificadores.';
  return null;
}

/**
 * Valida exclusões mútuas de Acessórios:
 * Se "Nenhum acessório" for marcado, nenhum outro acessório pode ser selecionado.
 */
export function sanitizeAccessories(
  selectedAccessories: string[],
  otherAccessories: string
): { valid: boolean; error?: string; result: string } {
  const hasNone = selectedAccessories.includes('Nenhum acessório');
  const otherClean = (otherAccessories || '').trim();
  const hasSpecifics = selectedAccessories.some((a) => a !== 'Nenhum acessório') || otherClean.length > 0;

  if (hasNone && hasSpecifics) {
    return {
      valid: false,
      error: 'Não é possível marcar "Nenhum acessório" em conjunto com acessórios específicos.',
      result: '',
    };
  }

  const items: string[] = [];
  if (hasNone) {
    items.push('Nenhum acessório');
  } else {
    items.push(...selectedAccessories.filter((a) => a !== 'Nenhum acessório'));
    if (otherClean) {
      items.push(otherClean);
    }
  }

  return {
    valid: true,
    result: items.join(', ').slice(0, 255),
  };
}

/**
 * Valida exclusões mútuas de Condição de Entrada:
 * "Liga normalmente" e "Não liga / Sem sinal" não podem coexistir.
 */
export function sanitizeConditions(
  selectedConditions: string[],
  customNotes: string
): { valid: boolean; error?: string; result: string } {
  const turnsOn = selectedConditions.includes('Liga normalmente');
  const doesNotTurnOn = selectedConditions.includes('Não liga / Sem sinal');

  if (turnsOn && doesNotTurnOn) {
    return {
      valid: false,
      error: 'Condições contraditórias selecionadas: o aparelho não pode marcar "Liga normalmente" e "Não liga" simultaneamente.',
      result: '',
    };
  }

  const items = [...selectedConditions];
  const customClean = (customNotes || '').trim();
  if (customClean) {
    items.push(customClean);
  }

  return {
    valid: true,
    result: items.join(' | ').slice(0, 500),
  };
}

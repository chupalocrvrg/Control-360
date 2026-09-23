/**
 * Validador oficial de Cédula y RUC de la República del Ecuador.
 * 
 * - Cédula: 10 dígitos numéricos con algoritmo Módulo 10.
 *   - Los 2 primeros dígitos corresponden al código de provincia (01 a 24 o 30 para residentes en el exterior).
 *   - El tercer dígito debe ser menor a 6 (0 a 5).
 *   - Dígito verificador final calculado con coeficientes [2, 1, 2, 1, 2, 1, 2, 1, 2].
 * 
 * - RUC Personas Naturales: 13 dígitos numéricos terminados en 001 y los primeros 10 son cédula válida.
 * - RUC Sociedades Privadas / Extranjeras: tercer dígito 9, coeficientes específicos módulo 11.
 * - RUC Sector Público: tercer dígito 6, coeficientes específicos módulo 11.
 */

export interface ValidationResult {
  isValid: boolean;
  type: 'CEDULA' | 'RUC_NATURAL' | 'RUC_PRIVADA' | 'RUC_PUBLICA' | 'INVALIDO';
  errorMessage?: string;
}

export function validateEcuadorId(id: string): ValidationResult {
  const cleanId = (id || '').trim();

  // Validar longitud general y que sean solo dígitos
  if (!/^\d+$/.test(cleanId)) {
    return {
      isValid: false,
      type: 'INVALIDO',
      errorMessage: 'La identificación debe contener únicamente dígitos numéricos.'
    };
  }

  if (cleanId.length !== 10 && cleanId.length !== 13) {
    return {
      isValid: false,
      type: 'INVALIDO',
      errorMessage: `Longitud incorrecta (${cleanId.length} dígitos). Cédula debe tener 10 dígitos y RUC 13 dígitos.`
    };
  }

  // Validar código de provincia (2 primeros dígitos)
  const provincia = parseInt(cleanId.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) {
    return {
      isValid: false,
      type: 'INVALIDO',
      errorMessage: `Código de provincia '${cleanId.substring(0, 2)}' inválido. Debe estar entre 01 y 24 (o 30 exterior).`
    };
  }

  const tercerDigito = parseInt(cleanId.charAt(2), 10);

  // CASO 1: Cédula de Identidad (10 dígitos)
  if (cleanId.length === 10) {
    if (tercerDigito >= 6) {
      return {
        isValid: false,
        type: 'INVALIDO',
        errorMessage: 'En una cédula, el tercer dígito debe ser menor a 6.'
      };
    }

    const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let val = parseInt(cleanId.charAt(i), 10) * coefficients[i];
      if (val >= 10) val -= 9;
      sum += val;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const lastDigit = parseInt(cleanId.charAt(9), 10);

    if (checkDigit !== lastDigit) {
      return {
        isValid: false,
        type: 'INVALIDO',
        errorMessage: `Dígito verificador de cédula no coincide (calculado ${checkDigit}, ingresado ${lastDigit}).`
      };
    }

    return { isValid: true, type: 'CEDULA' };
  }

  // CASO 2: RUC (13 dígitos)
  if (cleanId.length === 13) {
    // 1. RUC de Persona Natural (tercer dígito < 6)
    if (tercerDigito < 6) {
      if (!cleanId.endsWith('001') && !cleanId.endsWith('002') && !cleanId.endsWith('003')) {
        return {
          isValid: false,
          type: 'INVALIDO',
          errorMessage: 'El RUC de persona natural debe terminar en un código de establecimiento válido (ej: 001).'
        };
      }
      // Validar los primeros 10 dígitos como cédula
      const cedulaPart = cleanId.substring(0, 10);
      const cedulaCheck = validateEcuadorId(cedulaPart);
      if (!cedulaCheck.isValid) {
        return {
          isValid: false,
          type: 'INVALIDO',
          errorMessage: `La base del RUC natural no es una cédula válida: ${cedulaCheck.errorMessage}`
        };
      }
      return { isValid: true, type: 'RUC_NATURAL' };
    }

    // 2. RUC Sociedad Pública (tercer dígito = 6)
    if (tercerDigito === 6) {
      const coefficients = [3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += parseInt(cleanId.charAt(i), 10) * coefficients[i];
      }
      const remainder = sum % 11;
      const checkDigit = remainder === 0 ? 0 : 11 - remainder;
      const verifiedDigit = parseInt(cleanId.charAt(8), 10);

      if (checkDigit !== verifiedDigit) {
        return {
          isValid: false,
          type: 'INVALIDO',
          errorMessage: 'Dígito verificador de RUC público no coincide.'
        };
      }
      return { isValid: true, type: 'RUC_PUBLICA' };
    }

    // 3. RUC Sociedad Privada o Extranjeros sin cédula (tercer dígito = 9)
    if (tercerDigito === 9) {
      const coefficients = [4, 3, 2, 7, 6, 5, 4, 3, 2];
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanId.charAt(i), 10) * coefficients[i];
      }
      const remainder = sum % 11;
      const checkDigit = remainder === 0 ? 0 : 11 - remainder;
      const verifiedDigit = parseInt(cleanId.charAt(9), 10);

      if (checkDigit !== verifiedDigit) {
        return {
          isValid: false,
          type: 'INVALIDO',
          errorMessage: 'Dígito verificador de RUC privado no coincide.'
        };
      }
      return { isValid: true, type: 'RUC_PRIVADA' };
    }

    return {
      isValid: false,
      type: 'INVALIDO',
      errorMessage: 'El tercer dígito del RUC no corresponde a una categoría válida (0-5 natural, 6 pública, 9 privada).'
    };
  }

  return { isValid: false, type: 'INVALIDO', errorMessage: 'Identificación no válida.' };
}

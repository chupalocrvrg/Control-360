import { describe, it, expect } from 'vitest';
import { validateEcuadorianId } from '../ecuadorModulo10';

describe('ecuadorModulo10 validation', () => {
  it('should invalidate empty or null input', () => {
    expect(validateEcuadorianId(null)).toEqual({
      isValid: false,
      type: 'INVALIDO',
      reason: 'Código o número de cédula vacío',
      cleanedId: ''
    });
  });

  it('should invalidate non-numeric characters', () => {
    expect(validateEcuadorianId('010123456A').isValid).toBe(false);
  });

  it('should invalidate wrong length', () => {
    expect(validateEcuadorianId('01012345').isValid).toBe(false);
  });

  it('should invalidate invalid province code', () => {
    expect(validateEcuadorianId('9901234567').isValid).toBe(false);
  });

  it('should validate a correct cedula', () => {
    // Ejemplo de cédula válida (0912345678 no es real, buscar una genérica o mock)
    // Cédula válida ficticia: 1710034065
    const result = validateEcuadorianId('1710034065');
    expect(result.isValid).toBe(true);
    expect(result.type).toBe('CEDULA');
  });

  it('should validate a correct RUC Privado', () => {
    // RUC privado válido ficticio con 3er dígito 9: 1790011674001
    const result = validateEcuadorianId('1790011674001');
    expect(result.isValid).toBe(true);
    expect(result.type).toBe('RUC_PRIVADO');
  });

  it('should validate a correct RUC Publico', () => {
    // RUC público válido ficticio con 3er dígito 6: 1760001550001
    const result = validateEcuadorianId('1760001550001');
    expect(result.isValid).toBe(true);
    expect(result.type).toBe('RUC_PUBLICO');
  });
});

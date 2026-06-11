import { describe, it, expect } from 'vitest';
import { computeOpenLoans, loansByTool } from './loans';

const tx = (type, person, toolId, qty, ts) => ({ id: Math.random().toString(), type, person, toolId, toolName: 'Tool ' + toolId, qty, ts });

describe('computeOpenLoans', () => {
  it('devuelve vacío sin transacciones', () => {
    expect(computeOpenLoans([])).toEqual([]);
  });

  it('un retiro abre un préstamo', () => {
    const loans = computeOpenLoans([tx('retiro', 'Gael', 't1', 2, '2026-01-01')]);
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ person: 'Gael', toolId: 't1', qty: 2 });
  });

  it('una devolución completa cierra el préstamo', () => {
    const loans = computeOpenLoans([
      tx('retiro', 'Gael', 't1', 2, '2026-01-01'),
      tx('ingreso', 'Gael', 't1', 2, '2026-01-02'),
    ]);
    expect(loans).toEqual([]);
  });

  it('devolución parcial deja saldo', () => {
    const loans = computeOpenLoans([
      tx('retiro', 'Gael', 't1', 3, '2026-01-01'),
      tx('ingreso', 'Gael', 't1', 1, '2026-01-02'),
    ]);
    expect(loans[0].qty).toBe(2);
  });

  it('los nombres no distinguen mayúsculas pero conservan el original', () => {
    const loans = computeOpenLoans([
      tx('retiro', 'Gael', 't1', 1, '2026-01-01'),
      tx('retiro', 'gael', 't1', 1, '2026-01-02'),
    ]);
    expect(loans).toHaveLength(1);
    expect(loans[0].qty).toBe(2);
  });

  it('procesa en orden cronológico aunque lleguen desordenadas', () => {
    const loans = computeOpenLoans([
      tx('ingreso', 'Gael', 't1', 2, '2026-01-02'),
      tx('retiro', 'Gael', 't1', 2, '2026-01-01'),
    ]);
    expect(loans).toEqual([]);
  });

  it('devolver de más no deja saldo negativo', () => {
    const loans = computeOpenLoans([
      tx('retiro', 'Gael', 't1', 1, '2026-01-01'),
      tx('ingreso', 'Gael', 't1', 5, '2026-01-02'),
    ]);
    expect(loans).toEqual([]);
  });

  it('transacciones sin persona se ignoran', () => {
    const loans = computeOpenLoans([tx('retiro', '', 't1', 2, '2026-01-01')]);
    expect(loans).toEqual([]);
  });

  it('préstamos separados por persona y herramienta', () => {
    const loans = computeOpenLoans([
      tx('retiro', 'Gael', 't1', 1, '2026-01-01'),
      tx('retiro', 'Ana', 't1', 1, '2026-01-02'),
      tx('retiro', 'Gael', 't2', 1, '2026-01-03'),
    ]);
    expect(loans).toHaveLength(3);
    expect(loansByTool(loans, 't1')).toHaveLength(2);
  });
});

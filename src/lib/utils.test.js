import { describe, it, expect } from 'vitest';
import { statusOf, clamp, snap, belowMin } from './utils';

describe('statusOf', () => {
  it('full cuando current == total', () => expect(statusOf({ current: 3, total: 3 }).key).toBe('full'));
  it('empty cuando current == 0', () => expect(statusOf({ current: 0, total: 3 }).key).toBe('empty'));
  it('partial con faltantes', () => {
    const s = statusOf({ current: 1, total: 4 });
    expect(s.key).toBe('partial');
    expect(s.missing).toBe(3);
    expect(s.pct).toBe(25);
  });
});

describe('clamp / snap', () => {
  it('clamp limita el rango', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
  it('snap redondea a la cuadrícula', () => {
    expect(snap(27, 20)).toBe(20);
    expect(snap(33, 20)).toBe(40);
  });
});

describe('belowMin', () => {
  it('true bajo el mínimo', () => expect(belowMin({ current: 1, minStock: 3 })).toBe(true));
  it('false sin mínimo definido', () => expect(belowMin({ current: 0, minStock: 0 })).toBe(false));
  it('false en o sobre el mínimo', () => expect(belowMin({ current: 3, minStock: 3 })).toBe(false));
});

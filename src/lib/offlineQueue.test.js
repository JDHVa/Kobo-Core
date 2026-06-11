import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueue, queueSize, flushQueue } from './offlineQueue';

// localStorage simulado para Node
beforeEach(() => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
});

describe('offlineQueue', () => {
  it('encola y reporta tamaño', () => {
    enqueue('upsertTool', { id: 't1' });
    enqueue('insertTx', { id: 'x1' });
    expect(queueSize()).toBe(2);
  });

  it('flush ejecuta y vacía la cola', async () => {
    enqueue('upsertTool', { id: 't1' });
    const exec = vi.fn().mockResolvedValue();
    const n = await flushQueue({ upsertTool: exec });
    expect(n).toBe(1);
    expect(exec).toHaveBeenCalledWith({ id: 't1' });
    expect(queueSize()).toBe(0);
  });

  it('si una operación falla, se detiene y conserva lo pendiente', async () => {
    enqueue('upsertTool', { id: 't1' });
    enqueue('upsertTool', { id: 't2' });
    const exec = vi.fn().mockRejectedValue(new Error('offline'));
    const n = await flushQueue({ upsertTool: exec });
    expect(n).toBe(0);
    expect(queueSize()).toBe(2); // nada se pierde
  });

  it('mantiene el orden FIFO', async () => {
    enqueue('insertTx', { id: 'a' });
    enqueue('insertTx', { id: 'b' });
    const seen = [];
    await flushQueue({ insertTx: async (p) => seen.push(p.id) });
    expect(seen).toEqual(['a', 'b']);
  });

  it('descarta operaciones desconocidas sin romper', async () => {
    enqueue('opVieja', {});
    const n = await flushQueue({});
    expect(n).toBe(0);
    expect(queueSize()).toBe(0);
  });
});

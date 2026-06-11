// Calcula préstamos abiertos a partir del historial de transacciones.
// retiro suma, ingreso resta (por persona+herramienta). Lo que queda > 0 está "fuera".
export function computeOpenLoans(transactions) {
  const map = new Map(); // key: person||toolId
  // procesar en orden cronológico
  const sorted = [...transactions].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  for (const tx of sorted) {
    if (!tx.person) continue;
    const key = `${tx.person.toLowerCase()}||${tx.toolId}`;
    const cur = map.get(key) || { person: tx.person, toolId: tx.toolId, toolName: tx.toolName, qty: 0, since: tx.ts };
    if (tx.type === 'retiro') {
      if (cur.qty === 0) cur.since = tx.ts;
      cur.qty += tx.qty;
    } else if (tx.type === 'ingreso') {
      cur.qty = Math.max(0, cur.qty - tx.qty);
    }
    map.set(key, cur);
  }
  return [...map.values()].filter(l => l.qty > 0)
    .sort((a, b) => new Date(a.since) - new Date(b.since));
}

export function loansByTool(openLoans, toolId) {
  return openLoans.filter(l => l.toolId === toolId);
}

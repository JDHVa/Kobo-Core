import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/ui';
import { CONTAINER_META, getDrawerLabel, TOOL_STATUS } from '../constants';
import { GEMINI_API_KEY, GEMINI_MODEL } from '../config';
import { computeOpenLoans } from '../lib/loans';

// Declaración de funciones que Gemini puede ejecutar sobre el inventario
const FN_DECLS = [
  {
    name: 'retirar_herramienta',
    description: 'Retira unidades de una herramienta del inventario a nombre de una persona.',
    parameters: { type:'object', properties: {
      tool_name: { type:'string', description:'Nombre (o parte) de la herramienta' },
      qty: { type:'integer', description:'Cantidad a retirar' },
      person: { type:'string', description:'Nombre de quien se la lleva' },
      note: { type:'string', description:'Motivo opcional' },
    }, required:['tool_name','qty','person'] },
  },
  {
    name: 'ingresar_herramienta',
    description: 'Devuelve/ingresa unidades de una herramienta al inventario.',
    parameters: { type:'object', properties: {
      tool_name: { type:'string', description:'Nombre (o parte) de la herramienta' },
      qty: { type:'integer', description:'Cantidad a ingresar' },
      person: { type:'string', description:'Nombre de quien devuelve (opcional)' },
    }, required:['tool_name','qty'] },
  },
];

export function ChatPanel({ open, onClose, containers, tools, transactions, onMovement, defaultPerson }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const configured = !!GEMINI_API_KEY;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  const buildContext = () => {
    let ctx = '';
    containers.forEach(c => {
      const meta = CONTAINER_META[c.type];
      ctx += `[${c.name}] (${meta?.label || c.type}, ${c.drawers} secciones)\n`;
      for (let d = 0; d < c.drawers; d++) {
        const label = getDrawerLabel(c, d);
        const inD = tools.filter(t => t.container === c.id && t.drawer === d);
        if (inD.length === 0) { ctx += `  ${label}: vacio\n`; continue; }
        inD.forEach(t => {
          const st = t.status && t.status !== 'ok' ? ` [${TOOL_STATUS[t.status]?.label}]` : '';
          ctx += `  ${label}: ${t.name} [${t.category}] S/N:${t.serial||'N/A'} ${t.current}/${t.total} disp.${t.total-t.current > 0 ? ' ('+(t.total-t.current)+' fuera)' : ''}${st}\n`;
        });
      }
    });
    const loans = computeOpenLoans(transactions || []);
    if (loans.length) {
      ctx += '\nPRESTAMOS ABIERTOS (quien tiene que):\n';
      loans.forEach(l => { ctx += `  ${l.person} tiene ${l.qty}x ${l.toolName} desde ${l.since}\n`; });
    }
    return ctx;
  };

  // Ejecuta una función pedida por el modelo y devuelve el resultado
  const execFn = (call) => {
    const args = call.args || {};
    const q = (args.tool_name || '').toLowerCase();
    const tool = tools.find(t => t.name.toLowerCase() === q) || tools.find(t => t.name.toLowerCase().includes(q));
    if (!tool) return { error: `No encontré ninguna herramienta que coincida con "${args.tool_name}".` };
    const qty = Math.max(1, parseInt(args.qty) || 1);
    if (call.name === 'retirar_herramienta') {
      if (tool.status && tool.status !== 'ok') return { error: `"${tool.name}" no está disponible (estado: ${TOOL_STATUS[tool.status]?.label}).` };
      if (tool.current < qty) return { error: `Solo hay ${tool.current} disponibles de "${tool.name}".` };
      const person = (args.person || defaultPerson || '').trim();
      if (!person) return { error: 'Falta el nombre de la persona que retira.' };
      onMovement({ toolId: tool.id, type:'retiro', qty, person, note: args.note || 'Vía asistente IA' });
      return { ok: true, result: `Retiradas ${qty}x ${tool.name} a nombre de ${person}. Quedan ${tool.current - qty} disponibles.` };
    }
    if (call.name === 'ingresar_herramienta') {
      const max = tool.total - tool.current;
      if (max <= 0) return { error: `"${tool.name}" ya está completa (${tool.current}/${tool.total}).` };
      const n = Math.min(qty, max);
      onMovement({ toolId: tool.id, type:'ingreso', qty: n, person: (args.person || defaultPerson || '').trim(), note: 'Vía asistente IA' });
      return { ok: true, result: `Ingresadas ${n}x ${tool.name}. Ahora hay ${tool.current + n}/${tool.total}.` };
    }
    return { error: 'Función desconocida.' };
  };

  const send = async () => {
    if (!input.trim() || !configured || loading) return;
    const userText = input.trim();
    setInput('');
    const next = [...messages, { role:'user', text:userText }];
    setMessages(next);
    setLoading(true);
    try {
      const sys = `Eres el asistente del inventario del taller. Tienes acceso total a la base de datos y puedes EJECUTAR retiros e ingresos con las funciones disponibles. Confirma siempre lo que hiciste. Responde en espanol, se conciso. Si mencionas una herramienta, di exactamente en que mueble y seccion esta, cuantas hay, cuantas faltan y quien las tiene si aplica.${defaultPerson ? ` El usuario actual es "${defaultPerson}" — usalo como persona por defecto si no especifican otra.` : ''}\n\nINVENTARIO ACTUAL:\n${buildContext()}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      let contents = next.map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts:[{text:m.text}] }));

      // Bucle de function calling (máx. 4 vueltas)
      for (let round = 0; round < 4; round++) {
        const res = await fetch(url, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({
            systemInstruction:{parts:[{text:sys}]},
            contents,
            tools: [{ functionDeclarations: FN_DECLS }],
            generationConfig:{temperature:0.3,maxOutputTokens:1024},
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'API error');
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter(p => p.functionCall);

        if (calls.length === 0) {
          const reply = parts.map(p => p.text).filter(Boolean).join('\n') || 'Sin respuesta.';
          setMessages(prev => [...prev, { role:'model', text:reply }]);
          break;
        }
        // Ejecutar y devolver resultados al modelo
        contents = [...contents, { role:'model', parts }];
        const responses = calls.map(p => ({
          functionResponse: { name: p.functionCall.name, response: execFn(p.functionCall) },
        }));
        contents = [...contents, { role:'user', parts: responses }];
      }
    } catch(e) {
      setMessages(prev => [...prev, { role:'model', text:'Error: ' + (e.message || 'Error al conectar con la API.') }]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-4 z-[55] flex w-[340px] flex-col rounded-3xl border border-steel-200 bg-white shadow-lift sm:w-[400px] animate-scale-in" style={{maxHeight:'70vh'}}>
      <div className="flex items-center justify-between border-b border-steel-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-steel-800 text-white"><Icon name="bot" size={18}/></span>
          <div><p className="text-sm font-semibold text-ink">Asistente del Taller</p><p className="text-[11px] text-ink-mute">{GEMINI_MODEL}</p></div>
        </div>
        <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-steel-50"><Icon name="x" size={18}/></button>
      </div>

      {!configured ? (
        <div className="flex flex-col items-center gap-3 p-6">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-clay-50 text-clay-500"><Icon name="alert-triangle" size={28}/></div>
          <p className="text-center text-sm text-ink-soft">Falta configurar GEMINI_API_KEY en src/config.js.</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{minHeight:'200px',maxHeight:'calc(70vh - 140px)'}}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Icon name="message-circle" size={32} className="text-steel-300"/>
                <p className="text-sm text-ink-mute">Pregunta cualquier cosa sobre el inventario</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {['¿Quién tiene herramientas fuera?','¿Qué hay que reponer?','Retira 1 martillo a mi nombre'].map(q => (
                    <button key={q} onClick={() => setInput(q)} className="rounded-full border border-steel-200 bg-steel-50 px-3 py-1 text-xs text-ink-soft hover:bg-steel-100">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-steel-800 text-white' : 'bg-steel-50 text-ink border border-steel-100'}`}>
                  {m.text.split('\n').map((line, j) => <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start"><div className="rounded-2xl bg-steel-50 border border-steel-100 px-4 py-3"><span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-steel-400 animate-pulse"/><span className="h-2 w-2 rounded-full bg-steel-400 animate-pulse" style={{animationDelay:'0.15s'}}/><span className="h-2 w-2 rounded-full bg-steel-400 animate-pulse" style={{animationDelay:'0.3s'}}/></span></div></div>
            )}
            <div ref={endRef}/>
          </div>
          <div className="border-t border-steel-200 p-3">
            <div className="flex items-center gap-2">
              <input ref={inputRef} className="flex-1 rounded-xl border border-steel-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-steel-400 focus:ring-2 focus:ring-steel-200"
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Escribe tu pregunta..." disabled={loading}/>
              <button onClick={send} disabled={!input.trim() || loading} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-steel-800 text-white transition hover:bg-steel-900 disabled:opacity-35">
                <Icon name="send" size={18}/>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

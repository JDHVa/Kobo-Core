export const CATEGORIES = ['Manuales','Electricas','Medicion','Corte','Sujecion','Seguridad','Consumibles','Electronicos','Cajas','Otros'];

// Estados de herramienta (técnica: asset condition tracking)
export const TOOL_STATUS = {
  ok:           { label:'Disponible',        icon:'check-circle',   tone:'sage'  },
  mantenimiento:{ label:'En mantenimiento',  icon:'wrench',         tone:'amber' },
  calibracion:  { label:'Calibración pend.', icon:'gauge',          tone:'steel' },
  perdida:      { label:'Perdida',           icon:'help-circle',    tone:'clay'  },
};

// Sin límite superior de secciones (maxD alto en vez de Infinity para
// que clamp() y los steppers sigan funcionando con números normales)
export const MAX_DRAWERS = 999;
export const CONTAINER_META = {
  gabinete:     { label:'Gabinete',              drawerLabel:'Cajon',          icon:'archive',      accent:'steel', defaultDrawers:4, minD:1, maxD:MAX_DRAWERS },
  multiple:     { label:'Mueble Multiple',       drawerLabel:'Cajon',          icon:'layout-grid',  accent:'sage',  defaultDrawers:3, minD:1, maxD:MAX_DRAWERS },
  caja:         { label:'Caja de Herramientas',  drawerLabel:'Compartimento',  icon:'briefcase',    accent:'clay',  defaultDrawers:1, minD:1, maxD:MAX_DRAWERS },
  mesa:         { label:'Mesa de Trabajo',       drawerLabel:'Superficie',     icon:'square',       accent:'wood',  defaultDrawers:1, minD:1, maxD:MAX_DRAWERS },
  estante:      { label:'Estante',               drawerLabel:'Nivel',          icon:'layers',       accent:'steel', defaultDrawers:4, minD:1, maxD:MAX_DRAWERS },
  repisa:       { label:'Repisa',                drawerLabel:'Nivel',          icon:'minus',        accent:'wood',  defaultDrawers:1, minD:1, maxD:MAX_DRAWERS },
  organizador:  { label:'Organizador de Cajitas',drawerLabel:'Cajita',         icon:'grid-3x3',     accent:'clay',  defaultDrawers:8, minD:2, maxD:MAX_DRAWERS },
  personalizado:{ label:'Personalizado',         drawerLabel:'Seccion',        icon:'pen-tool',     accent:'steel', defaultDrawers:1, minD:0, maxD:MAX_DRAWERS },
};

// Entrada del taller por defecto (la posición histórica fija)
export const DEFAULT_ENTRANCE = { wall:'bottom', offset:440, size:120 };

export const CUSTOM_SHAPES = [
  { key:'rect',     label:'Rectangulo', preview:'M2 4h20v16H2z' },
  { key:'circle',   label:'Circulo',    preview:'M12 2a10 10 0 110 20 10 10 0 010-20z' },
  { key:'lshape',   label:'Forma L',    preview:'M2 2h10v8H8v10H2z' },
  { key:'ushape',   label:'Forma U',    preview:'M2 2h4v14h8V2h4v18H2z' },
  { key:'triangle', label:'Triangulo',  preview:'M12 2L22 20H2z' },
  { key:'diamond',  label:'Diamante',   preview:'M12 2L22 12 12 22 2 12z' },
];

export const FURNITURE_COLORS = {
  steel: { fill:'#e5ecf4', stroke:'#345b82', light:'#f3f6fa' },
  sage:  { fill:'#e3ede2', stroke:'#52804f', light:'#f3f7f3' },
  clay:  { fill:'#f6e6d8', stroke:'#bc602c', light:'#fbf4ee' },
  wood:  { fill:'#efe6da', stroke:'#b89a73', light:'#f7f0e6' },
};

// Tailwind no detecta clases dinámicas — mapa estático de acentos
export const ACCENT_BG = {
  steel:'bg-steel-100 text-steel-600',
  sage:'bg-sage-100 text-sage-600',
  clay:'bg-clay-100 text-clay-600',
  wood:'bg-wood-100 text-wood-400',
};
export const ACCENT_PILL = {
  steel:'bg-steel-500', sage:'bg-sage-500', clay:'bg-clay-500', wood:'bg-wood-300',
};
export const DRAWER_TONE = {
  steel:'from-steel-100 to-steel-200 border-steel-300',
  sage:'from-sage-100 to-sage-200 border-sage-300',
  clay:'from-clay-100 to-clay-200 border-clay-300',
  wood:'from-yellow-50 to-yellow-100 border-yellow-300',
};

export const DEFAULT_CONTAINERS = [
  { id:'gab-1', type:'gabinete', name:'Gabinete Principal',  drawers:4, drawerNames:['','','',''],    x:70,  y:80,  w:180, h:160, z:1 },
  { id:'mul-1', type:'multiple', name:'Mueble Multiple',     drawers:3, drawerNames:['','',''],       x:320, y:80,  w:180, h:140, z:1 },
  { id:'cja-1', type:'caja',     name:'Caja de Herramientas',drawers:1, drawerNames:[''],             x:580, y:260, w:150, h:90,  z:2 },
  { id:'mes-1', type:'mesa',     name:'Banco de Trabajo',    drawers:1, drawerNames:[''],             x:70,  y:320, w:340, h:80,  z:0 },
];

export const SEED_TOOLS = [
  { id:'t1', name:'Taladro Percutor 18V',    category:'Electricas',  serial:'DW-8842-A',    total:3, current:2, container:'gab-1', drawer:0, icon:'taladro' },
  { id:'t2', name:'Juego de Llaves Allen',    category:'Manuales',    serial:'ALN-220',      total:5, current:5, container:'gab-1', drawer:0, icon:'llave-allen' },
  { id:'t3', name:'Calibrador Digital',       category:'Medicion',    serial:'MIT-500-196',  total:2, current:1, container:'gab-1', drawer:1, icon:'calibrador' },
  { id:'t4', name:'Martillo de Bola 16oz',    category:'Manuales',    serial:'STN-16BP',     total:4, current:4, container:'gab-1', drawer:2, icon:'martillo' },
  { id:'t5', name:'Cinta Metrica 8m',         category:'Medicion',    serial:'TJ-8M',        total:6, current:3, container:'gab-1', drawer:3, icon:'cinta-metrica' },
  { id:'t6', name:'Esmeriladora Angular',     category:'Electricas',  serial:'BSH-GWS-7',   total:2, current:2, container:'mul-1', drawer:0, icon:'engranaje' },
  { id:'t7', name:'Juego de Destornilladores',category:'Manuales',    serial:'WRA-6PC',      total:8, current:6, container:'mul-1', drawer:1, icon:'destornillador' },
  { id:'t8', name:'Pinza de Presion',         category:'Sujecion',    serial:'IRW-10R',      total:5, current:5, container:'mul-1', drawer:2, icon:'pinzas' },
  { id:'t9', name:'Gafas de Seguridad',       category:'Seguridad',   serial:'SEG-AS-01',    total:12,current:7, container:'cja-1', drawer:0, icon:'gafas' },
  { id:'t10',name:'Cuter Retractil',          category:'Corte',       serial:'OLF-L5',       total:4, current:4, container:'cja-1', drawer:0, icon:'cuter' },
];

export function getDrawerLabel(container, index) {
  const generic = `${CONTAINER_META[container.type]?.drawerLabel || 'Cajon'} ${index + 1}`;
  const custom = container.drawerNames && container.drawerNames[index];
  return custom && custom.trim() ? custom.trim() : generic;
}

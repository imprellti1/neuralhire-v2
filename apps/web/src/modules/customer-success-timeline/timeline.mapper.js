export function mapTimeline(res){ const p=res?.item||res?.data||res||{}; return { totalEventos:Number(p.totalEventos||0), eventos:Array.isArray(p.eventos)?p.eventos:[] }; }

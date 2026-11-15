export const $ = (s, r=document) => r.querySelector(s);
export const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const loaded = {};
export function loadScript(src, type){
  return loaded[src] ||= new Promise((ok, bad) => {
    const s = document.createElement('script'); s.src = src; if (type) s.type = type;
    s.onload = ok; s.onerror = () => { delete loaded[src]; bad(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}
export async function exists(url){
  try { const r = await fetch(url, { method:'HEAD' }); return r.ok; } catch { return false; }
}

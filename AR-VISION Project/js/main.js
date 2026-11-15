import { OBJECTS } from './objects.js';
import { $, $$ } from './utils.js';
const ar = () => import('./ar.js');
const pv = () => import('./model-viewer.js');

const intro = $('#intro'); let introDone = false;
const endIntro = () => { if (introDone) return; introDone = true; intro.classList.add('out'); setTimeout(() => intro.remove(), 600); };
$('#skip-intro').onclick = endIntro; setTimeout(endIntro, 3200);

$('#cards').innerHTML = OBJECTS.map(o => `
  <article class="card"><div class="thumb" style="background-image:url(${o.targetImage})"><span>${o.name[0]}</span></div>
  <h3>${o.name}</h3><p>${o.blurb}</p><div class="row"><span class="badge">AR ready</span>
  <button class="btn ghost" data-preview="${o.id}">Explore</button></div></article>`).join('');
$('#cards').addEventListener('click', e => { const b = e.target.closest('[data-preview]'); if (b) openPreview(b.dataset.preview); });

const menu = $('#menu'), burger = $('#burger');
burger.onclick = () => burger.setAttribute('aria-expanded', menu.classList.toggle('open'));
$$('#menu a').forEach(a => a.onclick = () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', false); });

async function openPreview(id){ $('#preview').classList.remove('hidden'); (await pv()).openPreview(id); }
$('#preview-close').onclick = () => { $('#preview').classList.add('hidden'); $('#preview-stage').innerHTML = ''; };

const overlay = $('#ar');
function openPrep(){ overlay.classList.remove('hidden'); $('#ar-prep').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
async function begin(){ localStorage.setItem('arv-tutorial', '1'); $('#ar-prep').classList.add('hidden'); (await ar()).startAR(); }
async function exitAR(){ (await ar()).stopAR(); overlay.classList.add('hidden'); ['#ar-info','#ar-controls','#ar-error','#ar-guide','#ar-loading'].forEach(s => $(s).classList.add('hidden')); document.body.style.overflow = ''; }
async function restart(){ const m = await ar(); m.stopAR(); m.startAR(); }
$$('[data-start-ar]').forEach(b => b.onclick = openPrep);
$('#prep-go').onclick = begin; $('#prep-skip').onclick = begin;
$('#ar-exit').onclick = exitAR; $('#err-exit').onclick = exitAR;
$('#ar-restart').onclick = restart; $('#err-retry').onclick = restart;
$('#err-preview').onclick = async () => { await exitAR(); openPreview(OBJECTS[0].id); };
$('#ar-help').onclick = () => $('#ar-prep').classList.toggle('hidden');
$('#info-toggle').onclick = () => $('#ar-info').classList.toggle('min');
$('#ar-controls').addEventListener('click', async e => { const a = e.target.closest('[data-act]'); if (a) (await ar()).transform(a.dataset.act); });
if (localStorage.getItem('arv-tutorial')) $('#prep-skip').classList.remove('hidden');

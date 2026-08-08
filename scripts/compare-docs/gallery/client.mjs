/**
 * The gallery's client script: nav selection, the filter box, and the compare
 * widgets' slider / side-by-side behaviour. Inlined into the page, so it runs
 * with no module system and no dependencies.
 */

export const JS = String.raw`
const items=[...document.querySelectorAll('.nav-item')];
const sheets=[...document.querySelectorAll('.sheet')];
function show(type){
  sheets.forEach(s=>s.hidden=s.dataset.type!==type);
  items.forEach(b=>b.setAttribute('aria-current',String(b.dataset.type===type)));
  const active=sheets.find(s=>s.dataset.type===type);
  if(active) initCompare(active);
  location.hash=encodeURIComponent(type);
}
items.forEach(b=>b.addEventListener('click',()=>show(b.dataset.type)));
document.getElementById('search').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  items.forEach(b=>{b.style.display=b.dataset.type.toLowerCase().includes(q)?'':'none';});
  document.querySelectorAll('.nav-group').forEach(g=>{
    g.style.display=[...g.querySelectorAll('.nav-item')].some(b=>b.style.display!=='none')?'':'none';
  });
  // Hide a category divider when every group under it (its siblings up to the
  // next divider) is filtered out.
  document.querySelectorAll('.nav-cat').forEach(cat=>{
    let any=false;
    for(let el=cat.nextElementSibling; el && !el.classList.contains('nav-cat'); el=el.nextElementSibling){
      if(el.style.display!=='none') any=true;
    }
    cat.style.display=any?'':'none';
  });
});
function initCompare(sheet){
  // A sectioned sheet has many independent compare widgets; wire each on its own
  // so a slider drag or a side-by-side toggle only touches its own stage.
  sheet.querySelectorAll('.compare').forEach(compare=>{
    const stage=compare.querySelector('.stage');
    if(!stage||stage.dataset.wired)return; stage.dataset.wired='1';
    const handle=compare.querySelector('.handle');
    // clip-path is a % of the element, so a single --split drives the clip and the
    // handle with no width bookkeeping — and nothing to break in side-by-side.
    const set=x=>{const r=stage.getBoundingClientRect();
      const p=Math.min(100,Math.max(0,((x-r.left)/r.width)*100));
      stage.style.setProperty('--split',p+'%');};
    let drag=false;
    handle.addEventListener('pointerdown',e=>{drag=true;handle.setPointerCapture(e.pointerId);});
    stage.addEventListener('pointermove',e=>{if(drag)set(e.clientX);});
    addEventListener('pointerup',()=>{drag=false;});
    compare.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
      compare.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
      stage.classList.toggle('sbs',btn.dataset.mode==='sbs');
    }));
  });
}
const initial=decodeURIComponent(location.hash.slice(1))||FIRST;
if(initial)show(initial);
// Prose links to another panel (a sheet citing the shared-causes notes) navigate
// by hash, and the back button does too. Without this the URL changes and the
// page does not.
addEventListener('hashchange',()=>{
  const type=decodeURIComponent(location.hash.slice(1));
  if(type&&sheets.some(s=>s.dataset.type===type))show(type);
});
`;

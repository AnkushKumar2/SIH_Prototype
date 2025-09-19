/* ---------- Core model ---------- */
const now = () => performance.now();
const sim = {
  playing:true, speed:1.0, pxPerKm:800/80, lastTs: now(),
  geo:{
    trackY:{up:120, mid1:180, mid2:240, mid3:260, down:300}, // Updated track positions
    x0:160, x1:1040
  },
  blocks:{
    up:[{x0:160,x1:400,ok:true},{x0:400,x1:560,ok:true},{x0:560,x1:800,ok:true},{x0:800,x1:1040,ok:true}],
    mid1:[{x0:160,x1:1040,ok:true}],
    mid2:[{x0:160,x1:1040,ok:true}],
    mid3:[{x0:160,x1:1040,ok:true}],
    down:[{x0:160,x1:400,ok:true},{x0:400,x1:560,ok:true},{x0:560,x1:800,ok:true},{x0:800,x1:1040,ok:true}]
  },
  corridors:[
    {name:'left', x0:360, x1:440},
    {name:'mid',  x0:520, x1:640},
    {name:'right',x0:760, x1:840}
  ],
  alerts:[], rec:null, policy:'Aggressive'
};
function kmhToPxPerSec(kmh){ return (kmh*sim.pxPerKm)/3600; }
function addAlert(severity, message){ sim.alerts.unshift({severity,message,ts:new Date()}); if(sim.alerts.length>12)sim.alerts.pop(); renderAlerts(); }

/* ---------- Trains ---------- */
// Two trains on mid1 and mid2 will conflict at the mid crossover (x=520-640)
const trains = [
  { id:"12001", name:"12001 Shatabdi", dir:"up",   track:"up",   priority:"High",   x:180, vKmh:130, dwell:6, state:"Running", delayMin:0, color:"#4cc2ff" },
  { id:"19345", name:"19345 Express",  dir:"down", track:"down", priority:"High",   x:980, vKmh:130, dwell:6, state:"Running", delayMin:0, color:"#69d0ff" },
  { id:"22177", name:"22177 Superfast",dir:"up",   track:"mid1", priority:"Medium", x:510, vKmh:80, dwell:5, state:"Running", delayMin:0, color:"#77f39b" },
  { id:"9F201", name:"9F201 Freight",  dir:"down", track:"mid2", priority:"Medium", x:630, vKmh:80, dwell:5, state:"Running", delayMin:0, color:"#59d789" }
];

/* ---------- DOM ---------- */
const alertsEl = document.getElementById('alerts');
const trainsLayer = document.getElementById('trains');
const trainTableBody = document.querySelector('#trainTable tbody');
const aiRecEl = document.getElementById('aiRec');
const aiNoteEl = document.getElementById('aiNote');
const applyRecBtn = document.getElementById('applyRec');
const dismissRecBtn = document.getElementById('dismissRec');
const welcomeEl = document.querySelector('.welcome-container');
const headerEl = document.querySelector('header');

/* ---------- Utilities ---------- */
const pRank = {High:3, Medium:2, Low:1};
function blockIndex(track, x){
  const arr = sim.blocks[track];
  for (let i=0;i<arr.length;i++){ if (x>=arr[i].x0 && x < arr[i].x1) return i; }
  return arr.length-1;
}
function isBlockOk(track, idx){ return sim.blocks[track][idx].ok; }
function isBlockFree(track, idx, forTrain=null){
  const blk = sim.blocks[track][idx];
  if (!blk.ok) return false;
  for (const t of trains){
    if (t===forTrain) continue;
    if (t.track!==track) continue;
    if (blockIndex(track, t.x)===idx) return false;
  }
  return true;
}
function anyTrainInRange(track, x0, x1){
  return trains.some(t => t.track===track && t.x >= Math.min(x0,x1) && t.x <= Math.max(x0,x1));
}

/* ---------- Render ---------- */
function renderAlerts(){
  alertsEl.innerHTML = sim.alerts.map(a=>{
    const color = a.severity==='critical'?'red':a.severity==='warn'?'yellow':'green';
    return `<div class="alert"><span class="dot ${color}"></span><div class="msg">${a.message}</div><div class="ts">${a.ts.toLocaleTimeString()}</div></div>`;
  }).join('');
}
function ensureTrainNodes(){
  trains.forEach(t=>{
    if (!t.node){
      const g = document.createElementNS("http://www.w3.org/2000/svg","g");
      g.setAttribute('filter','url(#glow)');
      const halo = document.createElementNS("http://www.w3.org/2000/svg","circle");
      halo.setAttribute('r','13'); halo.setAttribute('fill', t.track==='up' ? 'rgba(76,194,255,0.12)' : t.track==='down' ? 'rgba(119,243,155,0.12)' : 'rgba(183,221,255,0.12)');
      const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
      circle.setAttribute('r','10'); circle.setAttribute('stroke','#0d110f'); circle.setAttribute('stroke-width','1.5'); circle.setAttribute('fill', t.color);
      const label = document.createElementNS("http://www.w3.org/2000/svg","text");
      label.setAttribute('font-size','25'); label.setAttribute('fill','#ffffff'); label.setAttribute('text-anchor','middle'); 
      label.setAttribute('font-family','monospace'); label.setAttribute('font-weight','bold');
      label.setAttribute('stroke','#000000'); label.setAttribute('stroke-width','0.5');
      label.setAttribute('text-shadow','0 0 4px rgba(0,0,0,0.8)');
      label.textContent = t.id;
      g.appendChild(halo); g.appendChild(circle); g.appendChild(label); trainsLayer.appendChild(g);
      t.node = g; t.label = label; t.halo = halo;
    }
  });
}
function updateTrainNodes(){
  trains.forEach(t=>{
    const y = sim.geo.trackY[t.track];
    const x = t.x;
    t.node.setAttribute('transform', `translate(${x},${y})`);
    t.label.setAttribute('x','0'); t.label.setAttribute('y','-16');
    // tint halo by track
    t.halo.setAttribute('fill', t.track==='up' ? 'rgba(76,194,255,0.12)' : t.track==='down' ? 'rgba(119,243,155,0.12)' : 'rgba(183,221,255,0.12)');
  });
}
function estimateETA(t){
  const g = { x0: sim.geo.x0, x1: sim.geo.x1 };
  const distPx = t.dir==='up' ? (g.x1 - t.x) : (t.x - g.x0);
  const v = Math.max(5, kmhToPxPerSec(t.vKmh));
  const seconds = distPx / v + t.dwell*60;
  return `${(seconds/60).toFixed(1)}m`;
}
function renderTrainTable(){
  trainTableBody.innerHTML = trains.map(t=>{
    // Status with icon
    const statusClass = t.state==='Held' ? 'status-held' : 
                       t.route?.active ? 'status-wrong-line' : 
                       'status-running';
    const statusText = t.state==='Held' ? 'Held' :
                      t.route?.active ? 'Wrong-line' :
                      'Running';
    
    // Platform information
    const platformText = t.track === 'up' ? 'Platform 1' :
                        t.track === 'down' ? 'Platform 2' :
                        t.track === 'mid1' ? 'Platform 3' :
                        t.track === 'mid2' ? 'Platform 4' :
                        t.track === 'mid3' ? 'Platform 5' :
                        'Platform 6';
    
    // Priority styling
    const priorityClass = `pill priority-${t.priority.toLowerCase()}`;
    
    // Delay styling
    const delayClass = t.delayMin === 0 ? 'delay-on-time' : 
                      t.delayMin > 0 ? 'delay-late' : 'delay-early';
    const delayText = t.delayMin === 0 ? 'On Time' : 
                     t.delayMin > 0 ? `+${t.delayMin.toFixed(0)}m` : 
                     `${t.delayMin.toFixed(0)}m`;
    
    // Action buttons
    const actionButtons = t.state==='Held' ? 
      `<button class="action-btn primary" onclick="holdTrain('${t.id}')">Release</button>` :
      `<button class="action-btn" onclick="holdTrain('${t.id}')">Hold</button>`;
    
    return `<tr data-train-id="${t.id}">
      <td><strong>${t.id}</strong></td>
      <td><span class="${statusClass}">${statusText}</span></td>
      <td><span class="platform-info">${platformText}</span></td>
      <td>${t.dir==='up'?'Up':'Down'}</td>
      <td>${estimateETA(t)}</td>
      <td><span class="${delayClass}">${delayText}</span></td>
      <td><span class="${priorityClass}">${t.priority}</span></td>
      <td>
        <div class="action-buttons">
          ${actionButtons}
          <button class="action-btn" onclick="manualReroute('${t.id}')">Reroute</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ---------- Controller actions ---------- */
function holdTrain(id){
  const t = trains.find(x=>x.id===id); if(!t) return;
  if (t.state==='Held'){ t.state='Running'; t.holdUntil=null; addAlert('green',`Released ${t.id}`); }
  else { t.state='Held'; t.holdUntil=performance.now()+90000/sim.speed; addAlert('warn',`Holding ${t.id} for ~1.5 min`); }
  renderTrainTable();
}
function manualReroute(id){
  const t = trains.find(x=>x.id===id); if(!t) return;
  const ok = tryPlanCorridor(t);
  if (ok) { addAlert('warn',`Manual reroute: ${t.id} via ${t.route.via} ${t.route.corridor.name} (${t.route.enter}-${t.route.exit})`); }
  else { addAlert('yellow',`Cannot reroute ${t.id}: no safe corridor available now`); }
  renderTrainTable();
}
window.holdTrain = holdTrain;
window.manualReroute = manualReroute;

/* ---------- Disruptions ---------- */
function setSigColor(id, ok){ /* not used for mid tracks */ }
function failBlock(track, idx){
  sim.blocks[track][idx].ok = false;
  addAlert('critical', `Failure: ${track.toUpperCase()} Block ${idx+1} failed. Consider corridor bypass.`);
}
function clearAllFailures(){
  for (let k in sim.blocks) for (let i=0;i<sim.blocks[k].length;i++) sim.blocks[k][i].ok = true;
  addAlert('green', 'All failures cleared.');
}

/* ---------- Corridor planning (multi-corridor, bi-directional) ---------- */
function corridorsForBlock(track, idx){
  if (idx===0) return ['left','mid'];
  if (idx===1) return ['left','mid'];
  if (idx===2) return ['mid','right'];
  if (idx===3) return ['right','mid'];
  return ['mid'];
}
function corridorByName(name){ return sim.corridors.find(c=>c.name===name); }
function chooseAvailableCorridor(oppoTrack, names){
  for (const nm of names){
    const c = corridorByName(nm);
    if (!c) continue;
    const idxEnter = blockIndex(oppoTrack, c.x0+1);
    const idxExit  = blockIndex(oppoTrack, c.x1-1);
    if (!isBlockOk(oppoTrack, idxEnter) || !isBlockOk(oppoTrack, idxExit)) continue;
    if (!anyTrainInRange(oppoTrack, c.x0, c.x1)) return c;
  }
  return null;
}
function tryPlanCorridor(train, forcedPolicy=null){
  const track = train.track;
  const dir = train.dir;
  const oppo = (track==='up') ? 'down' : 'up';
  const nextX = dir==='up' ? train.x + 1 : train.x - 1;
  const nextIdx = blockIndex(track, nextX);
  let failedIdx = -1;
  for (let k=0;k<sim.blocks[track].length;k++){
    const b = sim.blocks[track][k];
    const ahead = (dir==='up') ? (b.x1 > train.x) : (b.x0 < train.x);
    if (ahead && !b.ok){ failedIdx = k; break; }
  }
  if (failedIdx<0) return false;
  const candidates = corridorsForBlock(track, failedIdx);
  const corridor = chooseAvailableCorridor(oppo, candidates);
  if (!corridor) return false;
  const policy = forcedPolicy || sim.policy;
  if (policy==='NoWrongLine') return false;
  train.route = { via: oppo, enter: corridor.x0, exit: corridor.x1, active:true, phase:'pre', corridor };
  return true;
}


/* ---------- AI recommendation ---------- */
function computeRecommendation(){
  let rec = null;
  // Detect conflict at mid crossover (x=520-640) between mid1 and mid2
  const t1 = trains.find(t => t.track === 'mid1' && t.x >= 520 && t.x <= 640);
  const t2 = trains.find(t => t.track === 'mid2' && t.x >= 520 && t.x <= 640);
  if (t1 && t2) {
    rec = {
      text: `Potential conflict detected at mid crossover between ${t1.id} and ${t2.id}. Recommend holding ${t2.id} until ${t1.id} clears the corridor.`,
      note: `AI detected both trains approaching the same crossover. Holding one prevents collision.`,
      plans: [{type:'hold', holds:[t2.id], where:'at mid crossover'}],
      apply: ()=>{
        const t = trains.find(x=>x.id===t2.id);
        if (t) { t.state='Held'; t.holdUntil=performance.now()+90000/sim.speed; }
        addAlert('yellow', `AI: Holding ${t2.id} to avoid conflict at crossover.`);
      }
    };
  } else {
    // Fallback to original logic for failures
    const failed = [];
    sim.blocks.up.forEach((b,i)=>{ if(!b.ok) failed.push({track:'up', idx:i}); });
    sim.blocks.down.forEach((b,i)=>{ if(!b.ok) failed.push({track:'down', idx:i}); });
    if (failed.length){
      const actions = [];
      const chosenPlans = [];
      for (const f of failed){
        const approaching = trains.filter(t => t.track===f.track && (
          (t.dir==='up' && t.x < sim.blocks[f.track][f.idx].x0 && (sim.blocks[f.track][f.idx].x0 - t.x) < 220) ||
          (t.dir==='down' && t.x > sim.blocks[f.track][f.idx].x1 && (t.x - sim.blocks[f.track][f.idx].x1) < 220)
        ));
        approaching.sort((a,b)=>{
          const pr = pRank[b.priority]-pRank[a.priority];
          if (pr!==0) return pr;
          const da = (a.dir==='up') ? (sim.blocks[f.track][f.idx].x0 - a.x) : (a.x - sim.blocks[f.track][f.idx].x1);
          const db = (b.dir==='up') ? (sim.blocks[f.track][f.idx].x0 - b.x) : (b.x - sim.blocks[f.track][f.idx].x1);
          return da - db;
        });
        if (approaching.length){
          const lead = approaching[0];
          const candidateCorrs = corridorsForBlock(f.track, f.idx);
          const corridor = chooseAvailableCorridor(lead.track==='up'?'down':'up', candidateCorrs);
          if (corridor && sim.policy!=='NoWrongLine'){
            const holds = trains.filter(t=>{
              if (t===lead) return false;
              const condBehind = (t.dir===lead.dir && t.track===lead.track &&
                ((lead.dir==='up' && t.x < lead.x) || (lead.dir==='down' && t.x > lead.x)) &&
                pRank[t.priority] <= pRank[lead.priority]);
              const oppoCond = (t.track!==(lead.track) && t.x >= corridor.x0 && t.x <= corridor.x1);
              return condBehind || oppoCond;
            }).map(t=>t.id);
            chosenPlans.push({type:'reroute', lead:lead.id, via:(lead.track==='up'?'down':'up'), corridor:corridor.name, holds});
          } else {
            const holds = approaching.map(t=>t.id);
            chosenPlans.push({type:'hold', holds, where:`before ${f.track.toUpperCase()} Blk${f.idx+1}`});
          }
        }
      }
      if (chosenPlans.length){
        const parts = [];
        for (const p of chosenPlans){
          if (p.type==='reroute'){
            parts.push(`Reroute ${p.lead} via ${p.via} line through ${p.corridor} corridor; hold ${p.holds.join(', ') || 'none'}.`);
          } else {
            parts.push(`Hold ${p.holds.join(', ')} ${p.where}.`);
          }
        }
        rec = {
          text: parts.join(' '),
          note: `Justification: minimize total delay using corridor bypasses where safe; respect priorities (${sim.policy} policy).`,
          plans: chosenPlans,
          apply: ()=>{
            for (const p of chosenPlans){
              if (p.type==='reroute'){
                const lead = trains.find(t=>t.id===p.lead);
                if (lead) {
                  for (const id of p.holds){
                    const t = trains.find(x=>x.id===id); if (t){ t.state='Held'; t.holdUntil=performance.now()+120000/sim.speed; }
                  }
                  const corridor = corridorByName(p.corridor);
                  lead.route = { via:(lead.track==='up'?'down':'up'), enter:corridor.x0, exit:corridor.x1, active:true, phase:'pre', corridor };
                  addAlert('warn', `AI: Rerouting ${lead.id} through ${p.corridor} corridor.`);
                }
              } else if (p.type==='hold'){
                for (const id of p.holds){
                  const t = trains.find(x=>x.id===id); if (t){ t.state='Held'; t.holdUntil=performance.now()+120000/sim.speed; }
                }
                addAlert('yellow', `AI: Holding ${p.holds.join(', ')} ${p.where}.`);
              }
            }
          }
        };
      }
    }
  }
  sim.rec = rec;
  //  if (rec) {
  //   localStorage.setItem('aiRecommendation', JSON.stringify(rec));
  // } else {
  //   localStorage.removeItem('aiRecommendation');
  // }
  if (rec){
    aiRecEl.textContent = rec.text;
    aiNoteEl.textContent = rec.note;
    applyRecBtn.disabled = false;
    dismissRecBtn.disabled = false;
  } else {
    aiRecEl.textContent = 'All clear. No conflicts predicted.';
    aiNoteEl.textContent = 'When disruptions occur, AI proposes corridor-based wrong-line reroutes and holding strategies by priority.';
    applyRecBtn.disabled = true;
    dismissRecBtn.disabled = true;
  }
  
}


/* ---------- Movement & rules ---------- */
function advanceWithinBlocks(t, dx){
  const nextX = t.x + dx;
  const currIdx = blockIndex(t.track, t.x);
  const nextIdx = blockIndex(t.track, nextX);
  if (nextIdx !== currIdx){
    if (!isBlockFree(t.track, nextIdx, t)) return false;
  }
  if (!isBlockOk(t.track, nextIdx)){
    const failed = sim.blocks[t.track][nextIdx];
    if (t.dir==='up'){
      if (t.x < failed.x0 && nextX >= failed.x0) return false;
    } else {
      if (t.x > failed.x1 && nextX <= failed.x1) return false;
    }
  }
  t.x = nextX;
  return true;
}
function handleTerminus(t){
  const xMin = sim.geo.x0, xMax = sim.geo.x1;
  const reached = t.dir==='up' ? (t.x >= xMax) : (t.x <= xMin);
  if (reached){
    t.x = t.dir==='up' ? xMax : xMin;
    if (!t._arrivedAt || performance.now()-t._arrivedAt > (t.dwell*1000)){
      t._arrivedAt = performance.now();
      setTimeout(()=>{
        t.dir = (t.dir==='up')?'down':'up';
        t.track = t.dir; // reset to normal track
        t.x = (t.dir==='up'? xMin+2 : xMax-2);
        t.state='Running';
        addAlert('green', `${t.id} departed after dwell`);
        renderTrainTable();
      }, t.dwell*1000);
      t.state='Held';
      addAlert('green', `${t.id} arrived terminal. Dwell ${t.dwell}s`);
    }
  }
}
function step(dtMs){
  const dt = dtMs * sim.speed;
  for (const t of trains){
    if (t.state==='Held'){
      if (t.holdUntil && performance.now()>=t.holdUntil){ t.state='Running'; t.holdUntil=null; }
      else { t.delayMin += dt/60000; continue; }
    }
    const v = kmhToPxPerSec(t.vKmh);
    let dx = v*(dt/1000);
    if (t.dir==='down') dx = -dx;
    if (t.route?.active){
      const { via, enter, exit, phase } = t.route;
      if (phase==='pre'){
        const target = enter;
        const nextX = t.x + dx;
        if ((t.dir==='up' && nextX >= target) || (t.dir==='down' && nextX <= target)){
          t.x = target;
          t.track = via;
          t.route.phase='corridor';
          addAlert('yellow', `${t.id} entered wrong-line (${via}) at ${target}.`);
        } else {
          if (!advanceWithinBlocks(t, dx)) t.delayMin += dt/60000;
        }
        continue;
      }
      if (phase==='corridor'){
        const nextX = t.x + dx;
        const idxNext = blockIndex(t.track, nextX);
        if (!isBlockFree(t.track, idxNext, t)) { t.delayMin += dt/60000; continue; }
        t.x = nextX;
        const target = exit;
        if ((t.dir==='up' && t.x >= target) || (t.dir==='down' && t.x <= target)){
          t.x = target;
          t.track = t.dir;
          t.route.phase='post';
          addAlert('green', `${t.id} exited corridor at ${target}.`);
        }
        continue;
      }
      if (phase==='post'){
        t.route.active=false; t.route=null;
      }
    }
    if (!advanceWithinBlocks(t, dx)) t.delayMin += dt/60000;
    handleTerminus(t);
  }
}

/* ---------- UI wiring ---------- */
document.getElementById('speed').addEventListener('input',(e)=>{ sim.speed=parseFloat(e.target.value); document.getElementById('speedVal').textContent=sim.speed.toFixed(1); });
document.getElementById('togglePlay').addEventListener('click',()=>{ sim.playing=!sim.playing; document.getElementById('togglePlay').textContent = sim.playing?'Pause':'Play'; });
document.getElementById('stepOnce').addEventListener('click',()=>{ step(200); update(); });
document.getElementById('failUp2').addEventListener('click',()=>{ failBlock('up',1); computeRecommendation(); renderTrainTable(); });
document.getElementById('failDown2').addEventListener('click',()=>{ failBlock('down',1); computeRecommendation(); renderTrainTable(); });
document.getElementById('clearAll').addEventListener('click',()=>{ clearAllFailures(); computeRecommendation(); renderTrainTable(); });
applyRecBtn.addEventListener('click',()=>{ if(sim.rec?.apply) sim.rec.apply(); computeRecommendation(); renderTrainTable(); });
dismissRecBtn.addEventListener('click',()=>{ sim.rec=null; computeRecommendation(); });
document.getElementById('replan').addEventListener('click',()=>{
  let changed = false;
  for (const t of trains){
    if (tryPlanCorridor(t)) changed = true;
  }
  if (changed) addAlert('warn','Re-plan: Applied corridor routes where available.');
  else addAlert('yellow','Re-plan: No corridor available at the moment.');
  computeRecommendation(); renderTrainTable();
});
document.getElementById('polHoldAll').addEventListener('click',()=>{
  sim.policy = 'Conservative';
  addAlert('yellow','Policy set: Conservative — prefer holding near failures.');
  computeRecommendation();
});
document.getElementById('polKeepLines').addEventListener('click',()=>{
  sim.policy = 'NoWrongLine';
  addAlert('yellow','Policy set: No wrong-line — keep normal lines, no corridor reroutes.');
  computeRecommendation();
});
document.getElementById('polAggressive').addEventListener('click',()=>{
  sim.policy = 'Aggressive';
  addAlert('yellow','Policy set: Aggressive — prioritize highest priority using corridors.');
  computeRecommendation();
});

/* ---------- Loop ---------- */
function update(){ ensureTrainNodes(); updateTrainNodes(); renderTrainTable(); computeRecommendation(); }
function tick(){
  const t = now(); const dt = t - sim.lastTs; sim.lastTs = t;
  if (sim.playing) step(dt);
  update(); requestAnimationFrame(tick);
}

/* ---------- Table sorting and selection ---------- */
let currentSort = { field: 'id', direction: 'asc' };
let selectedTrainId = null;

function sortTable(field) {
  if (currentSort.field === field) {
    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort.field = field;
    currentSort.direction = 'asc';
  }
  
  // Update sort indicators
  document.querySelectorAll('.train-status-table th.sortable').forEach(th => {
    th.classList.remove('asc', 'desc');
    if (th.dataset.sort === field) {
      th.classList.add(currentSort.direction);
    }
  });
  
  // Sort trains
  trains.sort((a, b) => {
    let aVal = a[currentSort.field];
    let bVal = b[currentSort.field];
    
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (currentSort.direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
  
  renderTrainTable();
}

function selectTrain(trainId) {
  selectedTrainId = trainId;
  document.querySelectorAll('.train-status-table tbody tr').forEach(tr => {
    tr.classList.remove('selected');
    if (tr.dataset.trainId === trainId) {
      tr.classList.add('selected');
    }
  });
}

/* ---------- Init ---------- */
function init(){
  addAlert('green','Simulation started. All signals clear.');
  
  // Add table sorting
  document.querySelectorAll('.train-status-table th.sortable').forEach(th => {
    th.addEventListener('click', () => sortTable(th.dataset.sort));
  });
  
  // Add row selection
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.train-status-table tbody tr');
    if (row && !e.target.closest('.action-btn')) {
      selectTrain(row.dataset.trainId);
    }
  });
  
  // Blur hero on scroll and keep header space accounted for
  function onScroll(){
    const y = window.scrollY || document.documentElement.scrollTop;
    if (welcomeEl){
      if (y > 40) welcomeEl.classList.add('is-blurred');
      else welcomeEl.classList.remove('is-blurred');
    }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
  tick();
}
init();
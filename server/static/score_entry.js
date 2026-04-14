const data = window.T_DATA;
const tournamentId = window.T_ID;
const dirty = new Set();
const floating = document.getElementById('save-floating');

function sortMatches(matches){
  return [...matches].sort((a,b)=>{
    const ad = a.score_a != null && a.score_b != null;
    const bd = b.score_a != null && b.score_b != null;
    if (ad === bd) return (a.id > b.id ? 1 : -1);
    return ad ? 1 : -1;
  });
}

function makeAccordion(container, matches, phase){
  container.innerHTML = '';
  sortMatches(matches).forEach((m)=>{
    const done = m.score_a != null && m.score_b != null;
    const el = document.createElement('div');
    el.className = 'accordion-item';
    el.dataset.matchId = m.id;
    el.innerHTML = `
      <div class="accordion-head">${m.a} vs ${m.b} ${done ? '✅' : '⏳'}</div>
      <div class="accordion-body">
        <label>${m.a} <input type="number" data-field="score_a" value="${m.score_a ?? ''}"></label>
        <label>${m.b} <input type="number" data-field="score_b" value="${m.score_b ?? ''}"></label>
      </div>`;
    el.querySelector('.accordion-head').addEventListener('click', ()=> el.classList.toggle('open'));
    el.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        dirty.add(`${phase}:${m.id}`);
        floating.classList.remove('hidden');
      });
    });
    container.appendChild(el);
  });
}

function renderPoules(){
  const p = document.getElementById('poule-select').value;
  makeAccordion(document.getElementById('poule-accordion'), data.poules[p] || [], 'poule');
}

function renderKO(){
  const board = Number(document.getElementById('board-select').value);
  makeAccordion(document.getElementById('ko-accordion'), data.knockout.filter(m=>m.board===board), 'ko');
}

async function saveAll(){
  for (const key of [...dirty]){
    const [phase, matchId] = key.split(':');
    const host = phase === 'poule' ? document.getElementById('poule-accordion') : document.getElementById('ko-accordion');
    const card = host.querySelector(`[data-match-id="${matchId}"]`);
    if (!card) continue;
    const scoreA = Number(card.querySelector('input[data-field="score_a"]').value);
    const scoreB = Number(card.querySelector('input[data-field="score_b"]').value);
    await fetch(`/api/tournament/${tournamentId}/score`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({phase: phase === 'ko' ? 'ko' : 'poule', match_id: matchId, score_a: scoreA, score_b: scoreB})
    });
    // mutate local in-memory data
    const target = phase === 'poule'
      ? Object.values(data.poules).flat().find(m=>m.id===matchId)
      : data.knockout.find(m=>m.id===matchId);
    if (target){ target.score_a = scoreA; target.score_b = scoreB; }
    dirty.delete(key);
  }
  floating.classList.add('hidden');
  renderPoules();
  renderKO();
}

document.getElementById('menu-btn').addEventListener('click', ()=> document.getElementById('public-menu').classList.toggle('hidden'));
document.getElementById('poule-select').addEventListener('change', renderPoules);
document.getElementById('board-select').addEventListener('change', renderKO);
document.getElementById('save-floating').addEventListener('click', saveAll);
renderPoules();
renderKO();

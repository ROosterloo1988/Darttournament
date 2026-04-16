document.getElementById('admin-menu-btn')?.addEventListener('click', ()=> {
  document.getElementById('admin-menu')?.classList.toggle('hidden');
});

const LAST_ANCHOR_KEY = 'admin_last_anchor';

document.querySelectorAll('#admin-menu a[href^="#"]').forEach((link) => {
  link.addEventListener('click', () => {
    localStorage.setItem(LAST_ANCHOR_KEY, link.getAttribute('href'));
  });
});

window.addEventListener('load', () => {
  if (location.hash) {
    localStorage.setItem(LAST_ANCHOR_KEY, location.hash);
    return;
  }
  const saved = localStorage.getItem(LAST_ANCHOR_KEY);
  if (saved) {
    const target = document.querySelector(saved);
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
});

document.querySelectorAll('input[data-toggle-present]').forEach((checkbox) => {
  checkbox.addEventListener('change', async () => {
    const form = checkbox.closest('form');
    if (!form) return;
    const fd = new FormData(form);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error('toggle failed');
      const payload = await res.json();
      const label = form.querySelector('.present-label');
      if (label) label.textContent = payload.present ? 'aanwezig' : 'afwezig';
      const presentCounter = document.getElementById('present-counter');
      const total = document.getElementById('player-total');
      if (presentCounter) presentCounter.textContent = payload.present_count;
      if (total) total.textContent = payload.total_players;
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      alert('Kon aanwezigheid niet opslaan. Probeer opnieuw.');
    }
  });
});

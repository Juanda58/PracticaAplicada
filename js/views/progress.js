// views/progress.js — Fase 2: progreso personal, metas e impacto
'use strict';

const ProgressView = {
  render(container) {
    clear(container);
    const user = currentUser();
    const wrap = el('div', { class: 'view view--progress' });
    const prefs = user.preferences || { weeklyGoalKwh: 45 };
    const activities = this.activities(user);
    const weekKwh = this.weekKwh(activities);
    const goal = Number(prefs.weeklyGoalKwh) || 45;
    const goalPct = Math.min(100, Math.round((weekKwh / goal) * 100));
    const streak = this.streak(activities);

    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('p', { class: 'eyebrow' }, 'Tu avance · Fase 2'),
      el('h1', {}, 'Progreso que se siente'),
      el('p', { class: 'muted' }, 'Cada carga suma. Mira tu impacto, mantén tu ritmo y decide cuál es tu siguiente objetivo.'),
    ]));

    wrap.appendChild(el('div', { class: 'progress-hero' }, [
      el('div', {}, [el('p', { class: 'eyebrow' }, 'Objetivo de esta semana'), el('h2', {}, `${formatKwh(weekKwh)} de ${formatKwh(goal)}`), el('p', {}, goalPct >= 100 ? '¡Meta cumplida! Puedes proponerte un nuevo reto.' : `Te faltan ${formatKwh(Math.max(0, goal - weekKwh))} para completar tu meta.`)]),
      el('div', { class: 'progress-hero__ring', style: `--progress:${goalPct * 3.6}deg` }, [el('strong', {}, `${goalPct}%`), el('span', {}, 'meta')]),
    ]));

    wrap.appendChild(el('div', { class: 'progress-stat-grid' }, [
      progressStat('bolt', formatKwh(user.stats.kwhConsumed), 'Energía acumulada', 'Desde tu primera carga'),
      progressStat('leaf', `${user.stats.co2AvoidedKg} kg`, 'CO₂ evitado', 'Frente a un vehículo convencional'),
      progressStat('calendar', String(streak), 'Días de racha', streak ? 'Sigue cargando con constancia' : 'Registra una carga para comenzar'),
      progressStat('star', String(user.stats.totalCharges), 'Cargas realizadas', 'Tu historial completo'),
    ]));

    const content = el('div', { class: 'progress-layout' });
    const chartCard = el('div', { class: 'card progress-chart-card' }, [
      el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Actividad reciente'), el('h2', {}, 'Tu energía semana a semana')]), el('span', { class: 'badge badge--teal' }, `${activities.length} registros`)]),
    ]);
    const canvas = el('canvas', { width: 720, height: 260, class: 'progress-chart' });
    chartCard.appendChild(canvas);
    chartCard.appendChild(el('p', { class: 'muted small progress-caption' }, 'La gráfica combina tus sesiones de carga y registros manuales.'));
    content.appendChild(chartCard);

    const side = el('div', { class: 'progress-side' });
    side.appendChild(this.milestones(user));
    side.appendChild(this.nextStep(user, goalPct));
    content.appendChild(side);
    wrap.appendChild(content);

    wrap.appendChild(this.manualLog(user));
    container.appendChild(wrap);
    this.drawChart(canvas, activities);
  },

  activities(user) {
    return [...userActivity(user.id), ...(state.data.weightLog || []).filter(item => item.userId === user.id)].map(item => ({ date: item.date, kwh: Number(item.kwh || 0), station: item.station || 'Registro manual' }));
  },

  weekKwh(activities) {
    const cutoff = Date.now() - 7 * 86400000;
    return activities.filter(item => new Date(item.date).getTime() >= cutoff).reduce((sum, item) => sum + item.kwh, 0);
  },

  streak(activities) {
    const days = new Set(activities.map(item => new Date(item.date).toISOString().slice(0, 10)));
    let count = 0;
    const cursor = new Date();
    while (days.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
    return count;
  },

  milestones(user) {
    const charges = user.stats.totalCharges;
    const items = [
      { done: charges >= 1, title: 'Primera carga', detail: 'Completaste tu primera sesión' },
      { done: charges >= 10, title: 'Ritmo constante', detail: 'Alcanzaste 10 cargas' },
      { done: user.stats.co2AvoidedKg >= 100, title: 'Impacto positivo', detail: 'Evitaste 100 kg de CO₂' },
    ];
    return el('div', { class: 'card milestone-card' }, [el('p', { class: 'eyebrow' }, 'Hitos desbloqueados'), el('h2', {}, 'Tu camino'), el('div', { class: 'milestone-list' }, items.map(item => el('div', { class: `milestone ${item.done ? 'is-done' : ''}` }, [el('span', { class: 'milestone__icon' }, item.done ? '✓' : '○'), el('div', {}, [el('strong', {}, item.title), el('span', { class: 'muted small' }, item.detail)])])))]);
  },

  nextStep(user, goalPct) {
    const message = goalPct >= 100 ? 'Sube tu meta semanal desde Mi garaje y sigue avanzando.' : 'Programa una carga en Plan para acercarte a tu objetivo.';
    return el('div', { class: 'card next-step-card' }, [el('p', { class: 'eyebrow' }, 'Siguiente paso'), el('h2', {}, 'Tú decides el ritmo'), el('p', { class: 'muted' }, message), el('button', { class: 'btn btn--primary btn--small', onclick: () => setUI({ tab: goalPct >= 100 ? 'garaje' : 'plan' }) }, goalPct >= 100 ? 'Ajustar mi meta' : 'Ir a mi Plan')]);
  },

  manualLog(user) {
    const card = el('div', { class: 'card manual-log-card' });
    card.appendChild(el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Registro personal'), el('h2', {}, 'Añadir una carga')]), el('span', { class: 'badge badge--ink' }, 'Opcional')]));
    const form = el('form', { class: 'form form--inline' });
    const dateInput = el('input', { type: 'date', value: localDateKey(new Date()), max: localDateKey(new Date()), required: true });
    const kwhInput = el('input', { type: 'number', min: '0.1', step: '0.1', placeholder: 'Ej. 18', required: true });
    form.append(el('label', {}, ['Fecha', dateInput]), el('label', {}, ['Energía (kWh)', kwhInput]), el('button', { class: 'btn btn--primary', type: 'submit' }, 'Registrar carga'));
    form.addEventListener('submit', event => { event.preventDefault(); const kwh = Number(kwhInput.value); if (!kwh || kwh <= 0 || !dateInput.value) return; setData(data => { data.weightLog.push({ id: uid('log'), userId: user.id, date: dateInputToLocalISO(dateInput.value), kwh }); const current = data.users.find(item => item.id === user.id); current.stats.kwhConsumed = Math.round((current.stats.kwhConsumed + kwh) * 10) / 10; current.stats.co2AvoidedKg = Math.round((current.stats.co2AvoidedKg + co2AvoidedFromKwh(kwh)) * 10) / 10; }); showToast('Carga agregada a tu progreso.', 'teal'); form.reset(); dateInput.value = localDateKey(new Date()); });
    card.appendChild(form);
    return card;
  },

  drawChart(canvas, activities) {
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const weeks = groupByWeek(activities).slice(-8);
    const dpr = window.devicePixelRatio || 1; const cssW = canvas.clientWidth || 720; const cssH = 260;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, cssW, cssH);
    const styles = getComputedStyle(document.documentElement); const grid = styles.getPropertyValue('--color-line-200').trim() || '#dde2e0'; const line = styles.getPropertyValue('--color-blue-600').trim() || '#2f6fed'; const fill = styles.getPropertyValue('--color-blue-100').trim() || '#e4ecfd'; const text = styles.getPropertyValue('--color-ink-600').trim() || '#4b555b';
    const padL = 42, padB = 30, padT = 20, padR = 18, w = cssW - padL - padR, h = cssH - padT - padB;
    if (!weeks.length) { ctx.fillStyle = text; ctx.font = '14px Inter, sans-serif'; ctx.fillText('Registra tu primera carga para comenzar a ver tu evolución.', padL, cssH / 2); return; }
    const max = Math.max(...weeks.map(item => item[1]), 1) * 1.2;
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.font = '11px Inter, sans-serif';
    for (let i = 0; i <= 3; i++) { const y = padT + (h / 3) * i; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke(); ctx.fillStyle = text; ctx.fillText(`${Math.round(max - (max / 3) * i)}`, 4, y + 4); }
    const step = weeks.length > 1 ? w / (weeks.length - 1) : 0; const points = weeks.map(([label, value], index) => ({ x: padL + step * index, y: padT + h - (value / max) * h, label, value }));
    ctx.beginPath(); ctx.moveTo(points[0].x, padT + h); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.lineTo(points[points.length - 1].x, padT + h); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    points.forEach(point => { ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill(); ctx.fillStyle = text; ctx.textAlign = 'center'; ctx.fillText(point.label.replace(/^\d+-/, ''), point.x, cssH - 8); }); ctx.textAlign = 'left';
  },
};

function progressStat(iconName, value, label, detail) {
  return el('div', { class: 'progress-stat' }, [el('span', { class: 'progress-stat__icon', html: ICONS[iconName] || ICONS.bolt }), el('div', {}, [el('strong', {}, value), el('span', {}, label), el('small', {}, detail)])]);
}

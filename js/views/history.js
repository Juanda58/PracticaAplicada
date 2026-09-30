// views/history.js — pestaña "Historial" (sesiones pasadas + cumplimiento de plan)
'use strict';

const HistoryView = {
  render(container) {
    clear(container);
    const user = currentUser();
    const wrap = el('div', { class: 'view view--history' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, 'Historial'),
      el('p', { class: 'muted' }, 'Tus sesiones de carga pasadas y qué tan bien sigues tu plan semanal.'),
    ]));

    wrap.appendChild(this.complianceCard(user));

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Sesiones de carga'));
    const activity = [...userActivity(user.id)].sort((a, b) => new Date(b.date) - new Date(a.date));
    const list = el('ul', { class: 'activity-list activity-list--history' });
    if (!activity.length) list.appendChild(el('li', { class: 'muted' }, 'Aún no registras cargas.'));
    activity.forEach(a => list.appendChild(el('li', { class: 'activity-row' }, [
      el('span', { class: 'activity-row__icon', html: ICONS.bolt }),
      el('div', { class: 'activity-row__body' }, [
        el('p', {}, a.station),
        el('p', { class: 'muted small' }, `${formatDate(a.date)} · ${a.durationMin ? a.durationMin + ' min' : ''}`),
      ]),
      el('div', { class: 'activity-row__end' }, [
        el('p', { class: 'activity-row__kwh' }, formatKwh(a.kwh)),
        el('p', { class: 'muted small' }, formatCOP(a.costCOP || 0)),
      ]),
    ])));
    wrap.appendChild(list);

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Reservas completadas'));
    const completed = Reservations.forUser(user.id).filter(r => r.status === 'completada');
    const resList = el('ul', { class: 'activity-list' });
    if (!completed.length) resList.appendChild(el('li', { class: 'muted' }, 'Aún no completas reservas.'));
    completed.forEach(r => {
      const s = getStation(r.stationId);
      resList.appendChild(el('li', { class: 'activity-row' }, [
        el('span', { class: 'activity-row__icon', html: ICONS.check }),
        el('div', { class: 'activity-row__body' }, [el('p', {}, s ? s.name : ''), el('p', { class: 'muted small' }, `${formatDateShort(r.date)} · ${r.hour}`)]),
      ]));
    });
    wrap.appendChild(resList);

    container.appendChild(wrap);
  },

  complianceCard(user) {
    const activity = userActivity(user.id);
    const plannedDays = WEEKDAYS.filter(d => state.data.plan[d]);
    let met = 0;
    plannedDays.forEach(day => {
      const entry = state.data.plan[day];
      const station = getStation(entry.stationId);
      const matched = activity.some(a => station && a.station === station.name);
      if (matched) met += 1;
    });
    const pct = plannedDays.length ? Math.round((met / plannedDays.length) * 100) : 0;

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'compliance__row' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow' }, 'Cumplimiento del plan'),
        el('p', { class: 'muted small' }, `${met} de ${plannedDays.length} días planeados con carga registrada`),
      ]),
      el('p', { class: 'compliance__pct' }, `${pct}%`),
    ]));
    const bar = el('div', { class: 'progress-bar' }, [el('div', { class: 'progress-bar__fill', style: `width:${pct}%` })]);
    card.appendChild(bar);
    return card;
  },
};

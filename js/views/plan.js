// views/plan.js — pestaña "Plan" (plan semanal de carga por día)
'use strict';

const PlanView = {
  render(container) {
    clear(container);
    const wrap = el('div', { class: 'view view--plan' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, 'Plan de carga semanal'),
      el('p', { class: 'muted' }, 'Programa en qué electrolinera y a qué hora planeas cargar cada día.'),
    ]));

    const list = el('div', { class: 'plan-list' });
    WEEKDAYS.forEach(day => list.appendChild(this.dayRow(day)));
    wrap.appendChild(list);
    container.appendChild(wrap);
  },

  dayRow(day) {
    const entry = state.data.plan[day];
    const isToday = day === todayWeekdayName();
    const row = el('div', { class: `card plan-row ${isToday ? 'plan-row--today' : ''}` });
    row.appendChild(el('div', { class: 'plan-row__day' }, [
      el('p', { class: 'eyebrow' }, day),
      isToday ? el('span', { class: 'badge badge--teal' }, 'Hoy') : null,
    ]));

    if (entry) {
      const station = getStation(entry.stationId);
      row.appendChild(el('div', { class: 'plan-row__body' }, [
        el('p', {}, station ? station.name : 'Estación eliminada'),
        el('p', { class: 'muted small' }, `${entry.hour} · Meta ${formatKwh(entry.targetKwh)}`),
      ]));
      row.appendChild(el('div', { class: 'plan-row__actions' }, [
        el('button', { class: 'btn btn--icon', title: 'Editar', onclick: () => this.openForm(day, entry) }, icon('edit')),
        el('button', { class: 'btn btn--icon btn--danger', title: 'Quitar', onclick: () => this.removeEntry(day) }, icon('trash')),
      ]));
    } else {
      row.appendChild(el('div', { class: 'plan-row__body' }, [el('p', { class: 'muted' }, 'Sin carga planeada')]));
      row.appendChild(el('div', { class: 'plan-row__actions' }, [
        el('button', { class: 'btn btn--ghost btn--small', onclick: () => this.openForm(day, null) }, [icon('plus'), ' Agregar']),
      ]));
    }
    return row;
  },

  removeEntry(day) {
    setData(d => { d.plan[day] = null; });
    showToast(`Se quitó el plan del ${day}.`);
  },

  openForm(day, entry) {
    const stations = Stations.all();
    const form = el('form', { class: 'form' });
    const stationSelect = el('select', { name: 'stationId', required: true },
      stations.map(s => el('option', { value: s.id, selected: entry && entry.stationId === s.id ? 'selected' : null }, s.name)));
    const hourInput = el('input', { type: 'time', name: 'hour', value: entry ? entry.hour : '08:00', required: true });
    const kwhInput = el('input', { type: 'number', name: 'targetKwh', min: '1', step: '0.5', value: entry ? entry.targetKwh : 15, required: true });

    form.append(
      el('label', {}, ['Electrolinera', stationSelect]),
      el('label', {}, ['Hora', hourInput]),
      el('label', {}, ['Meta de energía (kWh)', kwhInput]),
    );

    Modal.open({
      title: `Plan del ${day}`,
      body: form,
      actions: [
        { label: 'Cancelar', variant: 'ghost', onClick: () => Modal.close() },
        {
          label: 'Guardar', variant: 'primary', onClick: () => {
            const payload = { stationId: stationSelect.value, hour: hourInput.value, targetKwh: Number(kwhInput.value) };
            setData(d => { d.plan[day] = payload; });
            showToast(`Plan del ${day} guardado.`);
            Modal.close();
          },
        },
      ],
    });
  },
};

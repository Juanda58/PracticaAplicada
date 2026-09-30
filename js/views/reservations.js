// views/reservations.js — pestaña "Reservas" (catálogo + panel admin, equivalente a Market)
'use strict';

const ReservationsView = {
  render(container) {
    clear(container);
    const user = currentUser();
    const wrap = el('div', { class: 'view view--reservations' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, 'Reservas'),
      el('p', { class: 'muted' }, 'Reserva horario y conector con pago anticipado. En esta versión el pago es una simulación de la pasarela.'),
    ]));

    if (isAdmin()) { wrap.appendChild(this.adminPanel()); container.appendChild(wrap); return; }

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Solicitar un cupo de carga'));
    wrap.appendChild(this.requestForm(user));

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Tus reservas'));
    const list = el('div', { class: 'reservation-list' });
    const mine = Reservations.forUser(user.id);
    if (!mine.length) list.appendChild(el('p', { class: 'muted' }, 'Todavía no tienes reservas.'));
    mine.forEach(r => list.appendChild(this.userRow(r)));
    wrap.appendChild(list);

    container.appendChild(wrap);
  },

  requestForm(user) {
    const card = el('div', { class: 'card payment-flow-card' });
    const form = el('form', { class: 'form' });
    const stationSelect = el('select', { name: 'stationId', required: true }, Stations.all().map(s => el('option', { value: s.id, selected: state.ui.reservationStationId === s.id ? 'selected' : null }, s.name)));
    const connectorSelect = el('select', { name: 'connectorType', required: true });
    const dateInput = el('input', { type: 'date', name: 'date', value: localDateKey(new Date()), min: localDateKey(new Date()), required: true });
    const hourInput = el('input', { type: 'time', name: 'hour', value: '09:00', required: true });
    const kwhInput = el('input', { type: 'number', name: 'targetKwh', min: '1', step: '0.5', value: '10', required: true });
    const paymentSelect = el('select', { name: 'paymentMethod', required: true }, PAYMENT_METHODS.map(method => el('option', { value: method }, method)));
    const estimate = el('p', { class: 'reservation-estimate muted small' });
    const updateEstimate = () => { const station = Stations.find(stationSelect.value); estimate.textContent = station ? `Pago anticipado estimado: ${formatCOP(Number(kwhInput.value || 0) * station.pricePerKwh)}` : ''; };

    const fillConnectors = () => {
      clear(connectorSelect);
      const station = Stations.find(stationSelect.value);
      (station ? station.connectors : []).forEach(c => connectorSelect.appendChild(
        el('option', { value: c.type }, `${c.type} · ${c.available}/${c.total} libres`)
      ));
    };
    fillConnectors();
    stationSelect.addEventListener('change', fillConnectors);
    stationSelect.addEventListener('change', updateEstimate);
    kwhInput.addEventListener('input', updateEstimate);
    updateEstimate();

    card.appendChild(el('div', { class: 'payment-flow__intro' }, [
      el('div', { class: 'payment-flow__icon', html: ICONS.lock || ICONS.bolt }),
      el('div', {}, [el('strong', {}, 'Reserva con pago anticipado'), el('p', { class: 'muted small' }, 'Elige tu horario, revisa el valor estimado y asegura tu cupo en una sola operación.')]),
      el('span', { class: 'badge badge--teal' }, 'Pago protegido'),
    ]));
    form.append(
      el('label', {}, ['Electrolinera', stationSelect]),
      el('label', {}, ['Conector', connectorSelect]),
      el('div', { class: 'form-row' }, [
        el('label', {}, ['Fecha', dateInput]),
        el('label', {}, ['Hora', hourInput]),
      ]),
      el('div', { class: 'form-row' }, [
        el('label', {}, ['Energía estimada (kWh)', kwhInput]),
        el('label', {}, ['Método de pago', paymentSelect]),
      ]),
      estimate,
      el('div', { class: 'policy-note' }, [el('strong', {}, 'Política de cumplimiento'), el('span', {}, 'Si no cumples una reserva confirmada, se aplicará una multa del 20% del valor anticipado.')]),
      el('button', { class: 'btn btn--primary', type: 'submit' }, [icon('lock'), ' Pagar y solicitar reserva']),
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const result = Reservations.request({
        userId: user.id, stationId: stationSelect.value, connectorType: connectorSelect.value,
        date: dateInputToLocalISO(dateInput.value), hour: hourInput.value, targetKwh: Number(kwhInput.value), paymentMethod: paymentSelect.value,
      });
      if (!result.ok) { showToast(result.error, 'danger'); return; }
      addNotification('Reserva enviada', 'Tu solicitud quedó pendiente de aprobación.', 'copper');
      showToast('Solicitud enviada. Queda pendiente de aprobación.');
      state.ui.reservationStationId = null;
      ReservationsView.render($('#view-container'));
    });

    card.appendChild(form);
    return card;
  },

  userRow(r) {
    const station = getStation(r.stationId);
    const status = Reservations.statusMeta(r.status);
    const row = el('div', { class: 'card reservation-row' }, [
      el('div', {}, [
        el('p', {}, station ? station.name : 'Estación eliminada'),
        el('p', { class: 'muted small' }, `${r.connectorType} · ${formatDateShort(r.date)} ${r.hour} · ${formatCOP(r.estimatedCost || 0)} pagados`),
      ]),
      el('span', { class: `badge badge--${status.tone}` }, status.label),
    ]);
    const actions = el('div', { class: 'reservation-row__actions' });
    if (r.status === 'confirmada') {
      actions.appendChild(el('button', { class: 'btn btn--small btn--primary', onclick: () => { Reservations.complete(r.id); showToast('Reserva marcada como completada.'); ReservationsView.render($('#view-container')); } }, 'Marcar completada'));
    }
    if (r.status === 'pendiente' || r.status === 'confirmada') {
      actions.appendChild(el('button', { class: 'btn btn--small btn--ghost', onclick: () => { Reservations.cancel(r.id); showToast('Reserva cancelada.'); ReservationsView.render($('#view-container')); } }, 'Cancelar'));
    }
    if (r.status === 'no cumplida') actions.appendChild(el('span', { class: 'badge badge--danger' }, `Multa: ${formatCOP(r.penaltyCOP || 0)}`));
    if (actions.children.length) row.appendChild(actions);
    return row;
  },

  adminPanel() {
    const wrap = el('div', {});
    wrap.appendChild(el('h2', { class: 'section-title' }, 'Solicitudes pendientes'));
    const pendingList = el('div', { class: 'reservation-list' });
    const pending = Reservations.pending();
    if (!pending.length) pendingList.appendChild(el('p', { class: 'muted' }, 'No hay solicitudes pendientes.'));
    pending.forEach(r => pendingList.appendChild(this.adminRow(r)));
    wrap.appendChild(pendingList);

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Todas las reservas'));
    const allList = el('div', { class: 'reservation-list' });
    Reservations.all().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(r => allList.appendChild(this.adminRow(r, true)));
    wrap.appendChild(allList);
    return wrap;
  },

  adminRow(r, readonly) {
    const station = getStation(r.stationId);
    const user = state.data.users.find(u => u.id === r.userId);
    const status = Reservations.statusMeta(r.status);
    const row = el('div', { class: 'card reservation-row' }, [
      el('div', {}, [
        el('p', {}, `${user ? user.name : 'Usuario'} · ${station ? station.name : ''}`),
        el('p', { class: 'muted small' }, `${r.connectorType} · ${formatDateShort(r.date)} ${r.hour} · ${formatCOP(r.estimatedCost || 0)} pagados`),
      ]),
      el('span', { class: `badge badge--${status.tone}` }, status.label),
    ]);
    if (!readonly && r.status === 'pendiente') {
      row.appendChild(el('div', { class: 'reservation-row__actions' }, [
        el('button', { class: 'btn btn--icon btn--danger', title: 'Rechazar', onclick: () => { Reservations.reject(r.id); ReservationsView.render($('#view-container')); } }, icon('x')),
        el('button', { class: 'btn btn--icon btn--success', title: 'Aprobar', onclick: () => { Reservations.approve(r.id); ReservationsView.render($('#view-container')); } }, icon('check')),
      ]));
    }
    if (!readonly && r.status === 'confirmada') {
      row.appendChild(el('button', { class: 'btn btn--small btn--danger', onclick: () => { Reservations.markNoShow(r.id); showToast('Reserva marcada como no cumplida.', 'danger'); ReservationsView.render($('#view-container')); } }, 'Marcar no cumplida'));
    }
    return row;
  },
};

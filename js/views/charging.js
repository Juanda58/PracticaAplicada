// views/charging.js — carga guiada paso a paso (usada desde "Hoy"), equivalente a workout.js
'use strict';

const ChargingView = {
  _step: 1, // 1 conector, 2 confirmar, 3 en curso, 4 resumen
  _connectorType: null,
  _startedAt: null,
  _timer: null,
  _kwh: 0,
  _reservationId: null,

  render(container) {
    // El contenedor puede haber quedado obsoleto si un cambio de estado (p. ej.
    // ajustar disponibilidad de un conector) disparó un re-render completo del shell
    // entre pasos; siempre se busca el contenedor vivo actual antes de dibujar.
    const target = $('#view-container') || container;
    clear(target);
    const station = getStation(state.ui.chargingStationId);
    if (!station) { setUI({ tab: 'hoy', chargingStationId: null }); return; }

    if (this._step === 1) return this.renderStep1(target, station);
    if (this._step === 2) return this.renderStep2(target, station);
    if (this._step === 3) return this.renderStep3(target, station);
    return this.renderStep4(target, station);
  },

  reset() {
    // Si se abandona una carga en curso, se libera el cupo del conector reservado.
    if (this._step === 3 && state.ui.chargingStationId && this._connectorType) {
      Stations.setConnectorAvailability(state.ui.chargingStationId, this._connectorType, 1);
    }
    this._step = 1; this._connectorType = null; this._startedAt = null; this._kwh = 0; this._reservationId = null;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  },

  exit() {
    this.reset();
    setUI({ tab: 'hoy', chargingStationId: null });
  },

  wrapper(station, title, subtitle, body) {
    const wrap = el('div', { class: 'view view--charging' });
    wrap.appendChild(el('button', { class: 'btn btn--ghost btn--small charging__exit', onclick: () => this.exit() }, [icon('x'), ' Salir']));
    wrap.appendChild(el('div', { class: 'charging__progress' }, [1, 2, 3, 4].map(n =>
      el('span', { class: `charging__dot ${n <= this._step ? 'is-active' : ''}` })
    )));
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('p', { class: 'eyebrow' }, station.name),
      el('h1', {}, title),
      subtitle ? el('p', { class: 'muted' }, subtitle) : null,
    ]));
    wrap.appendChild(body);
    return wrap;
  },

  renderStep1(container, station) {
    const list = el('div', { class: 'connector-pick' }, station.connectors.map(c => {
      const disabled = c.available <= 0;
      const btn = el('button', {
        type: 'button', class: `connector-pick__item ${disabled ? 'is-disabled' : ''}`, disabled: disabled ? 'disabled' : null,
      }, [
        el('div', {}, [el('p', {}, c.type), el('p', { class: 'muted small' }, c.power)]),
        el('span', { class: 'muted small' }, disabled ? 'Sin cupo' : `${c.available}/${c.total} libres`),
      ]);
      btn.addEventListener('click', () => { this._connectorType = c.type; this._step = 2; this.render(container); });
      return btn;
    }));
    const body = el('div', {}, [list]);
    clear(container);
    container.appendChild(this.wrapper(station, 'Elige tu conector', 'Selecciona el conector que usarás en esta sesión.', body));
  },

  renderStep2(container, station) {
    const connector = station.connectors.find(c => c.type === this._connectorType);
    const body = el('div', { class: 'card charging__confirm' }, [
      el('p', {}, `Conector: ${connector.type} (${connector.power})`),
      el('p', { class: 'muted' }, 'Dirígete a la estación elegida con la información del cargador ya confirmada.'),
      el('p', { class: 'price-line' }, `Tarifa estimada: ${formatCOP(station.pricePerKwh)} / kWh`),
      el('button', { class: 'btn btn--primary btn--block', onclick: () => this.beginCharging(container, station, connector) }, [icon('play'), ' Iniciar carga']),
    ]);
    clear(container);
    container.appendChild(this.wrapper(station, 'Confirma y llega', null, body));
  },

  beginCharging(container, station, connector) {
    if (connector.available <= 0) { showToast('Ese conector ya no tiene cupo disponible.', 'danger'); this._step = 1; this.render(container); return; }
    Stations.setConnectorAvailability(station.id, connector.type, -1);
    this._startedAt = Date.now();
    this._kwh = 0;
    this._step = 3;
    this.render(container);
    // Seguimiento local del consumo durante la sesión activa.
    this._timer = setInterval(() => {
      this._kwh = Math.round((this._kwh + 0.12) * 100) / 100;
      this.updateProgressUI();
    }, 400);
  },

  renderStep3(container, station) {
    const body = el('div', { class: 'card charging__live', id: 'charging-live' }, [
      el('div', { class: 'charging__ring' }, [el('span', { html: ICONS.bolt })]),
      el('p', { class: 'charging__kwh', id: 'charging-kwh' }, formatKwh(this._kwh)),
      el('p', { class: 'muted', id: 'charging-time' }, 'Tiempo: 0:00'),
      el('button', { class: 'btn btn--primary btn--block', onclick: () => this.finishCharging(container, station) }, 'Detener carga'),
    ]);
    clear(container);
    container.appendChild(this.wrapper(station, 'Carga en curso', 'Puedes detener la carga cuando quieras.', body));
  },

  updateProgressUI() {
    const kwhEl = $('#charging-kwh');
    const timeEl = $('#charging-time');
    if (!kwhEl || !timeEl) return;
    kwhEl.textContent = formatKwh(this._kwh);
    const secs = Math.floor((Date.now() - this._startedAt) / 1000);
    timeEl.textContent = `Tiempo: ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  },

  finishCharging(container, station) {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    Stations.setConnectorAvailability(station.id, this._connectorType, 1);
    const durationMin = Math.max(1, Math.round((Date.now() - this._startedAt) / 60000));
    const user = currentUser();
    const activityEntry = {
      id: dbUid(), userId: user.id, stationId: station.id, station: station.name,
      date: new Date().toISOString(), kwh: this._kwh, costCOP: Math.round(this._kwh * station.pricePerKwh), durationMin,
    };
    setData(d => {
      d.activity.unshift(activityEntry);
      const u = d.users.find(x => x.id === user.id);
      u.stats.totalCharges += 1;
      u.stats.kwhConsumed = Math.round((u.stats.kwhConsumed + this._kwh) * 10) / 10;
      u.stats.co2AvoidedKg = Math.round((u.stats.co2AvoidedKg + co2AvoidedFromKwh(this._kwh)) * 10) / 10;
    });
    this._lastEntry = activityEntry;
    this._step = 4;
    this.render(container);
  },

  renderStep4(container, station) {
    const entry = this._lastEntry;
    const body = el('div', { class: 'card charging__summary' }, [
      el('span', { class: 'charging__summary-icon', html: ICONS.check }),
      el('h3', {}, '¡Carga completada!'),
      el('div', { class: 'charging__summary-grid' }, [
        summaryStat('Energía', formatKwh(entry.kwh)),
        summaryStat('Duración', `${entry.durationMin} min`),
        summaryStat('Costo estimado', formatCOP(entry.costCOP)),
        summaryStat('CO₂ evitado', `${co2AvoidedFromKwh(entry.kwh)} kg`),
      ]),
      el('button', { class: 'btn btn--primary btn--block', onclick: () => this.exit() }, 'Volver a Hoy'),
    ]);
    clear(container);
    container.appendChild(this.wrapper(station, 'Resumen de la sesión', null, body));
  },
};

function summaryStat(label, value) {
  return el('div', { class: 'charging__summary-item' }, [el('p', { class: 'muted small' }, label), el('p', {}, value)]);
}

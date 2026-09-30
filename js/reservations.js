// reservations.js — lógica de Reservas: solicitudes, stock/disponibilidad (equivalente a Market)
'use strict';

const Reservations = {
  all() { return state.data.reservations; },

  forUser(userId) {
    return state.data.reservations
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  pending() { return state.data.reservations.filter(r => r.status === 'pendiente'); },

  statusMeta(status) { return RESERVATION_STATUS[status] || { label: status, tone: 'ink' }; },

  // Disponibilidad: ¿hay cupo del conector solicitado en la estación?
  hasAvailability(stationId, connectorType) {
    const station = Stations.find(stationId);
    if (!station) return false;
    const connector = station.connectors.find(c => c.type === connectorType);
    return !!connector && connector.available > 0;
  },

  hasConflict({ userId, stationId, date, hour }) {
    const requestedDay = localDateKey(date);
    return this.all().some(r => r.userId === userId && r.stationId === stationId && r.hour === hour && localDateKey(r.date) === requestedDay && ['pendiente', 'confirmada'].includes(r.status));
  },

  // Solicitar una reserva (usuario) — "producto" solicitado: un cupo de carga
  request({ userId, stationId, connectorType, date, hour, targetKwh = 10, paymentMethod = PAYMENT_METHODS[0] }) {
    if (!date || !hour || new Date(date).getTime() < startOfToday().getTime()) {
      return { ok: false, error: 'Selecciona una fecha de hoy o posterior.' };
    }
    if (this.hasConflict({ userId, stationId, date, hour })) {
      return { ok: false, error: 'Ya tienes una reserva activa para ese horario.' };
    }
    if (!this.hasAvailability(stationId, connectorType)) {
      return { ok: false, error: 'No hay cupos disponibles para ese conector en este momento.' };
    }
    const station = Stations.find(stationId);
    const reservation = {
      id: dbUid(), userId, stationId, connectorType, date, hour, targetKwh: Number(targetKwh),
      estimatedCost: Math.round(Number(targetKwh) * station.pricePerKwh), paymentMethod,
      paymentStatus: 'pagado', status: 'pendiente', createdAt: new Date().toISOString(),
    };
    setData(d => d.reservations.push(reservation));
    recordAudit('Reserva solicitada', `${station.name} · ${date} ${hour}`, 'copper');
    return { ok: true, reservation };
  },

  // Panel admin: aprobar solicitud (descuenta stock/disponibilidad)
  approve(id) {
    setData(d => {
      const r = d.reservations.find(x => x.id === id);
      if (!r || r.status !== 'pendiente') return;
      const s = d.stations.find(x => x.id === r.stationId);
      const c = s && s.connectors.find(c => c.type === r.connectorType);
      if (c && c.available > 0) {
        c.available -= 1;
        r.status = 'confirmada';
      } else {
        r.status = 'rechazada';
      }
    });
    const reservation = this.all().find(item => item.id === id);
    if (reservation && reservation.status === 'confirmada') {
      addNotification('Reserva confirmada', 'Tu horario de carga ya fue aprobado.', 'teal');
      recordAudit('Reserva aprobada', `${reservation.id} · conector ${reservation.connectorType}`, 'teal');
    } else if (reservation) {
      recordAudit('Reserva rechazada', `${reservation.id} · sin disponibilidad`, 'danger');
    }
  },

  reject(id) {
    setData(d => {
      const r = d.reservations.find(x => x.id === id);
      if (r) r.status = 'rechazada';
    });
    addNotification('Reserva rechazada', 'Revisa la disponibilidad de la red y solicita otro horario.', 'danger');
    recordAudit('Reserva rechazada', id, 'danger');
  },

  // Al completar una carga reservada, se libera el cupo de nuevo
  complete(id) {
    setData(d => {
      const r = d.reservations.find(x => x.id === id);
      if (!r) return;
      const wasConfirmed = r.status === 'confirmada';
      r.status = 'completada';
      if (wasConfirmed) {
        const s = d.stations.find(x => x.id === r.stationId);
        const c = s && s.connectors.find(c => c.type === r.connectorType);
        if (c) c.available = Math.min(c.total, c.available + 1);
      }
    });
    recordAudit('Reserva completada', id, 'teal');
  },

  cancel(id) {
    setData(d => {
      const reservation = d.reservations.find(r => r.id === id);
      if (!reservation) return;
      if (reservation.status === 'confirmada') this.releaseConnector(d, reservation);
      d.reservations = d.reservations.filter(r => r.id !== id);
    });
    SupabaseAPI.remove('reservations', id).catch(() => showToast('La reserva se canceló en pantalla, pero no pudo sincronizarse.', 'danger'));
    recordAudit('Reserva cancelada', id, 'ink');
  },

  markNoShow(id) {
    setData(d => {
      const r = d.reservations.find(x => x.id === id);
      if (r && (r.status === 'confirmada' || r.status === 'pendiente')) {
        if (r.status === 'confirmada') this.releaseConnector(d, r);
        r.status = 'no cumplida'; r.penaltyCOP = Math.round((r.estimatedCost || 0) * 0.2);
      }
    });
    const reservation = this.all().find(item => item.id === id);
    recordAudit('Incumplimiento registrado', `${id} · multa ${formatCOP(reservation?.penaltyCOP || 0)}`, 'danger');
  },

  releaseConnector(data, reservation) {
    const station = data.stations.find(s => s.id === reservation.stationId);
    const connector = station && station.connectors.find(c => c.type === reservation.connectorType);
    if (connector) connector.available = Math.min(connector.total, connector.available + 1);
  },
};

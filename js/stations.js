// stations.js — catálogo de electrolineras: lectura, formato, CRUD (admin)
'use strict';

const Stations = {
  all() { return state.data.stations; },

  find(id) { return state.data.stations.find(s => s.id === id) || null; },

  filter({ query = '', status = 'todas', connector = 'todos' } = {}) {
    const q = query.trim().toLowerCase();
    return state.data.stations.filter(s => {
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q) || s.city.toLowerCase().includes(q);
      const matchesStatus = status === 'todas' || s.status === status;
      const matchesConnector = connector === 'todos' || s.connectors.some(c => c.type === connector);
      return matchesQuery && matchesStatus && matchesConnector;
    });
  },

  totalAvailableConnectors(station) {
    return sum(station.connectors, c => c.available);
  },

  totalConnectors(station) {
    return sum(station.connectors, c => c.total);
  },

  primaryConnector(station) { return station.connectors[0] || null; },

  statusMeta(status) { return STATION_STATUS[status] || { label: status, tone: 'ink' }; },

  // --- CRUD (admin) ---
  create(payload) {
    const station = {
      id: dbUid(),
      name: payload.name,
      address: payload.address,
      city: payload.city,
      distanceKm: Number(payload.distanceKm) || 0,
      status: payload.status || 'disponible',
      connectors: payload.connectors && payload.connectors.length
        ? payload.connectors
        : [{ type: 'Tipo 2 (AC)', power: '22 kW', available: 1, total: 1 }],
      pricePerKwh: Number(payload.pricePerKwh) || 0,
      rating: Number(payload.rating) || 4.5,
      amenities: payload.amenities || [],
      notes: payload.notes || '',
    };
    setData(d => d.stations.push(station));
    recordAudit('Estación creada', `${station.name} · ${station.city}`, 'teal');
    return station;
  },

  update(id, patch) {
    setData(d => {
      const s = d.stations.find(x => x.id === id);
      if (s) Object.assign(s, patch);
    });
    const station = this.find(id);
    if (station) recordAudit('Estación actualizada', `${station.name} · cambios guardados`, 'teal');
  },

  remove(id) {
    const station = this.find(id);
    setData(d => { d.stations = d.stations.filter(s => s.id !== id); });
    SupabaseAPI.remove('stations', id).catch(() => showToast('La estación se quitó localmente, pero no pudo sincronizarse.', 'danger'));
    if (station) recordAudit('Estación eliminada', station.name, 'danger');
  },

  setConnectorAvailability(stationId, connectorType, delta) {
    setData(d => {
      const s = d.stations.find(x => x.id === stationId);
      if (!s) return;
      const c = s.connectors.find(x => x.type === connectorType);
      if (!c) return;
      c.available = Math.max(0, Math.min(c.total, c.available + delta));
    });
  },
};

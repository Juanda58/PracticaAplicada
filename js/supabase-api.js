// supabase-api.js — autenticación y persistencia remota para Electrolineras JAMB
'use strict';

const SupabaseAPI = {
  session: null,
  get base() { return `${SUPABASE_CONFIG.url}/rest/v1`; },
  get authBase() { return `${SUPABASE_CONFIG.url}/auth/v1`; },

  headers(extra = {}, authenticated = true) {
    const headers = { apikey: SUPABASE_CONFIG.anonKey, 'Content-Type': 'application/json', ...extra };
    const token = this.session?.access_token;
    if (authenticated && token) headers.Authorization = `Bearer ${token}`;
    return headers;
  },

  async request(path, options = {}) {
    const response = await fetch(`${this.base}/${path}`, {
      ...options,
      headers: this.headers(options.headers || {}, options.authenticated !== false),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase ${response.status}: ${detail || response.statusText}`);
    }
    if (response.status === 204) return null;
    return response.json();
  },

  async remove(table, id) {
    if (!this.isUUID(id)) return;
    return this.request(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  },

  async signIn(email, password) {
    const response = await fetch(`${this.authBase}/token?grant_type=password`, {
      method: 'POST',
      headers: this.headers({}, false),
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error('Correo o contraseña incorrectos.');
    this.session = await response.json();
    sessionStorage.setItem('jamb:supabase-session', JSON.stringify(this.session));
    return this.session;
  },

  async signUp({ name, email, password }) {
    const response = await fetch(`${this.authBase}/signup`, {
      method: 'POST',
      headers: this.headers({}, false),
      body: JSON.stringify({ email, password, data: { name } }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || payload.msg || 'No fue posible crear la cuenta.');
    if (payload.access_token) {
      this.session = payload;
      sessionStorage.setItem('jamb:supabase-session', JSON.stringify(payload));
    }
    return payload;
  },

  async signOut() {
    if (this.session?.access_token) {
      await fetch(`${this.authBase}/logout`, { method: 'POST', headers: this.headers({}, true) }).catch(() => {});
    }
    this.session = null;
    sessionStorage.removeItem('jamb:supabase-session');
  },

  restoreSession() {
    try { this.session = JSON.parse(sessionStorage.getItem('jamb:supabase-session') || 'null'); } catch { this.session = null; }
    return this.session;
  },

  async loadState() {
    if (!this.session?.user?.id) return null;
    const [profiles, stations, connectors, reservations, activity, audit] = await Promise.all([
      this.request('profiles?select=*'),
      this.request('stations?select=*'),
      this.request('station_connectors?select=*'),
      this.request('reservations?select=*'),
      this.request('activity?select=*'),
      this.request('audit_logs?select=*&order=created_at.desc&limit=100'),
    ]);
    const users = profiles.map(profile => this.profileToUser(profile));
    const stationRows = stations.map(station => ({
      ...this.stationToView(station),
      connectors: connectors.filter(connector => connector.station_id === station.id).map(this.connectorToView),
    }));
    return {
      __v: STORAGE_VERSION,
      users,
      stations: stationRows,
      activity: activity.map(this.activityToView),
      plan: JSON.parse(JSON.stringify(SEED_PLAN)),
      reservations: reservations.map(this.reservationToView),
      weightLog: [],
      audit: audit.map(this.auditToView),
      notifications: [],
      session: this.session.user.id,
    };
  },

  profileToUser(profile) {
    return {
      id: profile.id, name: profile.name, email: profile.email || '', password: '', role: profile.role,
      plan: profile.plan, vehicle: profile.vehicle_brand || profile.vehicle_model ? { brand: profile.vehicle_brand || '', model: profile.vehicle_model || '', connector: profile.connector_type || 'Tipo 2 (AC)', batteryCapacityKwh: Number(profile.battery_capacity_kwh || 0) } : null,
      stats: { totalCharges: Number(profile.total_charges || 0), kwhConsumed: Number(profile.kwh_consumed || 0), co2AvoidedKg: Number(profile.co2_avoided_kg || 0), favoriteStationId: profile.preferences?.favoriteStationIds?.[0] || null },
      preferences: profile.preferences || { weeklyGoalKwh: 45, notifications: true, favoriteStationIds: [] },
    };
  },

  stationToView(station) {
    return { id: station.id, name: station.name, address: station.address, city: station.city, distanceKm: Number(station.distance_km || 0), status: station.status, pricePerKwh: Number(station.price_per_kwh || 0), rating: Number(station.rating || 0), amenities: station.amenities || [], notes: station.notes || '', activeVehicles: Number(station.active_vehicles || 0), waitingVehicles: Number(station.waiting_vehicles || 0), avgWaitMin: Number(station.avg_wait_min || 0) };
  },

  connectorToView(connector) {
    return { id: connector.id, type: connector.connector_type, power: connector.power, available: Number(connector.available || 0), total: Number(connector.total || 0) };
  },

  reservationToView(row) {
    return { id: row.id, userId: row.user_id, stationId: row.station_id, connectorType: row.connector_type, date: row.reservation_date, hour: String(row.reservation_hour || '').slice(0, 5), targetKwh: Number(row.target_kwh || 0), estimatedCost: Number(row.estimated_cost || 0), paymentMethod: row.payment_method, paymentStatus: row.payment_status, status: row.status, penaltyCOP: row.penalty_cop, createdAt: row.created_at };
  },

  activityToView(row) {
    return { id: row.id, userId: row.user_id, stationId: row.station_id, station: row.station_name, date: row.activity_date, kwh: Number(row.kwh || 0), costCOP: Number(row.cost_cop || 0), durationMin: Number(row.duration_min || 0) };
  },

  auditToView(row) { return { id: row.id, actorId: row.actor_id, action: row.action, detail: row.detail, tone: row.tone, createdAt: row.created_at }; },

  async persist(data) {
    if (!this.session?.user?.id) return;
    const currentUser = data.users.find(user => user.id === this.session.user.id);
    if (currentUser) await this.upsertProfile(currentUser);
    const stations = data.stations.filter(station => this.isUUID(station.id));
    if (stations.length) {
      await this.request('stations', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(stations.map(this.stationToRow)) });
      const connectors = stations.flatMap(station => station.connectors.filter(connector => this.isUUID(connector.id)).map(connector => this.connectorToRow(connector, station.id)));
      if (connectors.length) await this.request('station_connectors', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(connectors) });
    }
    const reservations = data.reservations.filter(item => this.isUUID(item.id) && this.isUUID(item.userId) && this.isUUID(item.stationId));
    if (reservations.length) await this.request('reservations', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(reservations.map(this.reservationToRow)) });
    const activity = data.activity.filter(item => this.isUUID(item.id) && this.isUUID(item.userId));
    if (activity.length) await this.request('activity', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(activity.map(this.activityToRow)) });
    const audit = (data.audit || []).filter(item => this.isUUID(item.id));
    if (audit.length && currentUser?.role === ROLES.ADMIN) await this.request('audit_logs', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(audit.map(this.auditToRow)) });
  },

  async upsertProfile(user) {
    return this.request('profiles', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([this.profileToRow(user)]) });
  },

  stationToRow(station) { return { id: station.id, name: station.name, address: station.address, city: station.city, distance_km: station.distanceKm || 0, status: station.status, price_per_kwh: station.pricePerKwh || 0, rating: station.rating || 0, amenities: station.amenities || [], notes: station.notes || '', active_vehicles: station.activeVehicles || 0, waiting_vehicles: station.waitingVehicles || 0, avg_wait_min: station.avgWaitMin || 0 }; },
  connectorToRow(connector, stationId) { return { id: connector.id, station_id: stationId, connector_type: connector.type, power: connector.power, available: connector.available, total: connector.total }; },
  reservationToRow(row) { return { id: row.id, user_id: row.userId, station_id: row.stationId, connector_type: row.connectorType, reservation_date: row.date, reservation_hour: row.hour, target_kwh: row.targetKwh || 10, estimated_cost: row.estimatedCost || 0, payment_method: row.paymentMethod || PAYMENT_METHODS[0], payment_status: row.paymentStatus || 'pagado', status: row.status, penalty_cop: row.penaltyCOP || null, created_at: row.createdAt || new Date().toISOString() }; },
  activityToRow(row) { return { id: row.id, user_id: row.userId, station_id: row.stationId || null, station_name: row.station, activity_date: row.date, kwh: row.kwh || 0, cost_cop: row.costCOP || 0, duration_min: row.durationMin || 0 }; },
  auditToRow(row) { return { id: row.id, actor_id: row.actorId || null, action: row.action, detail: row.detail || '', tone: row.tone || 'ink', created_at: row.createdAt || new Date().toISOString() }; },
  profileToRow(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan, vehicle_brand: user.vehicle?.brand || null, vehicle_model: user.vehicle?.model || null, connector_type: user.vehicle?.connector || null, battery_capacity_kwh: user.vehicle?.batteryCapacityKwh || null, total_charges: user.stats?.totalCharges || 0, kwh_consumed: user.stats?.kwhConsumed || 0, co2_avoided_kg: user.stats?.co2AvoidedKg || 0, preferences: user.preferences || {} }; },
  isUUID(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); },
};

function emptyRemoteState() { return { __v: STORAGE_VERSION, users: [], stations: [], activity: [], plan: JSON.parse(JSON.stringify(SEED_PLAN)), reservations: [], weightLog: [], audit: [], notifications: [], session: null }; }

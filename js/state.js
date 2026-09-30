// state.js — estado global en memoria (state.data, state.ui)
'use strict';

const state = {
  data: null, // se llena en init()
  ui: {
    tab: 'hoy',
    authMode: 'login', // 'login' | 'register'
    chargingStationId: null, // sesión de carga guiada en curso
    editingStationId: null, // admin: estación en edición
    toast: null,
    lastSync: null,
    notificationsOpen: false,
    reservationStationId: null,
  },
  _listeners: [],
};

async function init() {
  state.data = await Storage.load();
  // Compatibilidad con estados creados antes de asociar cada actividad a un usuario.
  let repaired = false;
  const seedUser = state.data.users && state.data.users.find(user => user.id === 'u-demo');
  if (seedUser && (seedUser.email !== SEED_USER.email || seedUser.password !== SEED_USER.password)) {
    Object.assign(seedUser, { email: SEED_USER.email, password: SEED_USER.password, name: SEED_USER.name });
    repaired = true;
  }
  (state.data.users || []).forEach(user => {
    if (user.role !== ROLES.USER || user.preferences) return;
    user.preferences = { weeklyGoalKwh: 45, notifications: true, favoriteStationIds: user.stats?.favoriteStationId ? [user.stats.favoriteStationId] : [] };
    repaired = true;
  });
  state.data.stations = (state.data.stations || []).map(station => {
    const seed = SEED_STATIONS.find(item => item.id === station.id);
    if (!seed) return station;
    if (!station._liveSeeded) {
      repaired = true;
      return { ...station, activeVehicles: seed.activeVehicles, waitingVehicles: seed.waitingVehicles, avgWaitMin: seed.avgWaitMin, _liveSeeded: true };
    }
    const merged = { ...station,
      activeVehicles: Number.isFinite(station.activeVehicles) ? station.activeVehicles : seed.activeVehicles,
      waitingVehicles: Number.isFinite(station.waitingVehicles) ? station.waitingVehicles : seed.waitingVehicles,
      avgWaitMin: Number.isFinite(station.avgWaitMin) ? station.avgWaitMin : seed.avgWaitMin,
    };
    if (station.activeVehicles === undefined || station.waitingVehicles === undefined || station.avgWaitMin === undefined) repaired = true;
    return merged;
  });
  state.data.reservations = (state.data.reservations || []).map(reservation => {
    if (reservation.paymentStatus) return reservation;
    const station = state.data.stations.find(item => item.id === reservation.stationId);
    repaired = true;
    return { targetKwh: 10, estimatedCost: Math.round(10 * (station ? station.pricePerKwh : 0)), paymentMethod: PAYMENT_METHODS[0], paymentStatus: 'pagado', ...reservation };
  });
  state.data.activity = (state.data.activity || []).map(activity => {
    if (activity.userId) return activity;
    repaired = true;
    return { ...activity, userId: 'u-demo' };
  });
  state.data.weightLog = (state.data.weightLog || []).map(log => {
    if (log.userId) return log;
    repaired = true;
    return { ...log, userId: 'u-demo' };
  });
  state.data.notifications = state.data.notifications || [
    { id: 'nt-1', title: 'Red JAMB operativa', message: 'Todas las estaciones reportan disponibilidad.', date: new Date().toISOString(), read: false, tone: 'teal' },
  ];
  state.data.audit = state.data.audit || [];
  state.ui.lastSync = new Date();
  if (repaired) await Storage.save(state.data);
}

function subscribe(fn) { state._listeners.push(fn); return () => { state._listeners = state._listeners.filter(f => f !== fn); }; }

function notify() { state._listeners.forEach(fn => fn(state)); }

function persist() { return Storage.save(state.data); }

function setUI(patch) { Object.assign(state.ui, patch); notify(); }

function setData(mutator) {
  mutator(state.data);
  persist();
  notify();
}

function showToast(message, tone = 'ink') {
  setUI({ toast: { message, tone, id: uid('toast') } });
  const currentId = state.ui.toast.id;
  setTimeout(() => { if (state.ui.toast && state.ui.toast.id === currentId) setUI({ toast: null }); }, 2600);
}

function unreadNotifications() {
  return (state.data.notifications || []).filter(notification => !notification.read);
}

function addNotification(title, message, tone = 'ink') {
  setData(data => {
    data.notifications = data.notifications || [];
    data.notifications.unshift({ id: uid('nt'), title, message, date: new Date().toISOString(), read: false, tone });
    data.notifications = data.notifications.slice(0, 30);
  });
}

function recordAudit(action, detail, tone = 'ink') {
  if (!state.data) return;
  setData(data => {
    data.audit = data.audit || [];
    data.audit.unshift({ id: dbUid(), action, detail, tone, actorId: data.session || null, createdAt: new Date().toISOString() });
    data.audit = data.audit.slice(0, 100);
  });
}

function markNotificationsRead() {
  setData(data => (data.notifications || []).forEach(notification => { notification.read = true; }));
}

function simulateLiveUpdate() {
  if (!state.data || state.ui.tab === '__charging__') return;
  const changed = [];
  state.data.stations.forEach(station => {
    station.connectors.forEach(connector => {
      const delta = Math.random() > 0.55 ? (Math.random() > 0.5 ? 1 : -1) : 0;
      const next = Math.max(0, Math.min(connector.total, connector.available + delta));
      if (next !== connector.available) { connector.available = next; changed.push(station); }
    });
    station.activeVehicles = Math.max(0, Math.min(12, station.activeVehicles + (Math.random() > 0.5 ? 1 : -1)));
    station.waitingVehicles = Math.max(0, Math.min(8, station.waitingVehicles + (Math.random() > 0.65 ? 1 : -1)));
    station.avgWaitMin = station.waitingVehicles ? Math.max(5, station.waitingVehicles * 7 + Math.round(Math.random() * 5)) : 0;
  });
  state.ui.lastSync = new Date();
  persist();
  if (state.ui.tab === 'hoy') notify();
  else if (state.ui.tab === 'biblioteca' && typeof LibraryView !== 'undefined') LibraryView.refreshGrid();
  if (changed.length && Math.random() > 0.65) showToast('Disponibilidad actualizada en la red.', 'teal');
}

// --- Getters derivados ---
function currentUser() {
  if (!state.data.session) return null;
  return state.data.users.find(u => u.id === state.data.session) || null;
}

function isAdmin() { const u = currentUser(); return !!u && u.role === ROLES.ADMIN; }

function getStation(id) { return state.data.stations.find(s => s.id === id) || null; }

function userActivity(userId) {
  return state.data.activity.filter(a => a.userId === userId);
}

function userReservations(userId) {
  return state.data.reservations.filter(r => r.userId === userId);
}

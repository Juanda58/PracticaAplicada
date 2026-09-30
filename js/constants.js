// constants.js — enums, catálogo semilla y constantes globales
'use strict';

const APP_NAME = 'Electrolineras JAMB';
const STORAGE_KEY = 'jamb:v1';
const STORAGE_VERSION = 1;

const ROLES = { USER: 'usuario', ADMIN: 'admin' };

const STATION_STATUS = {
  disponible: { label: 'Disponible', tone: 'teal' },
  ocupada: { label: 'Ocupada', tone: 'copper' },
  mantenimiento: { label: 'En mantenimiento', tone: 'ink' },
};

const CONNECTOR_TYPES = ['Tipo 2 (AC)', 'CCS Combo (DC)', 'CHAdeMO (DC)'];

const AMENITIES = [
  'Cafetería', 'Wifi', 'Techado', 'Baños', 'Restaurantes', 'Parqueadero',
  'Carga rápida', 'Seguridad 24/7', 'Zona verde',
];

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const RESERVATION_STATUS = {
  pendiente: { label: 'Pendiente', tone: 'copper' },
  confirmada: { label: 'Confirmada', tone: 'teal' },
  rechazada: { label: 'Rechazada', tone: 'danger' },
  completada: { label: 'Completada', tone: 'ink' },
  'no cumplida': { label: 'No cumplida', tone: 'danger' },
};

const PAYMENT_METHODS = ['Tarjeta débito/crédito', 'PSE', 'Billetera digital'];

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: 'home' },
  { id: 'plan', label: 'Plan', icon: 'calendar' },
  { id: 'progreso', label: 'Progreso', icon: 'chart' },
  { id: 'biblioteca', label: 'Biblioteca', icon: 'book' },
  { id: 'historial', label: 'Historial', icon: 'clock' },
  { id: 'reservas', label: 'Reservas', icon: 'bolt' },
  { id: 'garaje', label: 'Mi garaje', icon: 'car' },
];

const ADMIN_TABS = [
  { id: 'admin-dashboard', label: 'Centro de operaciones', icon: 'home' },
  { id: 'admin-estaciones', label: 'Estaciones', icon: 'pin' },
  { id: 'admin-reservas', label: 'Reservas', icon: 'calendar' },
  { id: 'admin-usuarios', label: 'Usuarios', icon: 'user' },
  { id: 'admin-auditoria', label: 'Auditoría', icon: 'clock' },
];

// --- Catálogo semilla de electrolineras (equivalente al catálogo de ejercicios) ---
const SEED_STATIONS = [
  {
    id: 'st-001', name: 'JAMB Chapinero Norte', address: 'Cra. 13 #63-45, Bogotá',
    city: 'Bogotá', distanceKm: 1.2, status: 'disponible',
    connectors: [
      { type: 'Tipo 2 (AC)', power: '22 kW', available: 3, total: 4 },
      { type: 'CCS Combo (DC)', power: '60 kW', available: 1, total: 2 },
    ],
    pricePerKwh: 780, rating: 4.7, amenities: ['Cafetería', 'Wifi', 'Techado'], activeVehicles: 2, waitingVehicles: 1, avgWaitMin: 12,
    notes: 'Estación insignia de la red, cerca a la Zona G.',
  },
  {
    id: 'st-002', name: 'JAMB Centro Comercial Sopó', address: 'Autopista Norte km 26, Sopó',
    city: 'Sopó', distanceKm: 3.8, status: 'ocupada',
    connectors: [
      { type: 'CHAdeMO (DC)', power: '50 kW', available: 0, total: 2 },
      { type: 'Tipo 2 (AC)', power: '11 kW', available: 2, total: 6 },
    ],
    pricePerKwh: 720, rating: 4.5, amenities: ['Baños', 'Restaurantes', 'Parqueadero'], activeVehicles: 4, waitingVehicles: 2, avgWaitMin: 24,
    notes: 'Dentro del parqueadero del centro comercial, nivel -1.',
  },
  {
    id: 'st-003', name: 'JAMB Terminal Salitre', address: 'Av. Boyacá #22-10, Bogotá',
    city: 'Bogotá', distanceKm: 5.6, status: 'disponible',
    connectors: [
      { type: 'CCS Combo (DC)', power: '120 kW', available: 2, total: 3 },
    ],
    pricePerKwh: 810, rating: 4.8, amenities: ['Carga rápida', 'Seguridad 24/7'], activeVehicles: 1, waitingVehicles: 0, avgWaitMin: 0,
    notes: 'Carga ultrarrápida, ideal antes de viajes largos.',
  },
  {
    id: 'st-004', name: 'JAMB Parque La Colina', address: 'Cl. 145 #103-60, Bogotá',
    city: 'Bogotá', distanceKm: 7.1, status: 'mantenimiento',
    connectors: [
      { type: 'Tipo 2 (AC)', power: '22 kW', available: 0, total: 4 },
    ],
    pricePerKwh: 760, rating: 4.2, amenities: ['Zona verde', 'Parqueadero'], activeVehicles: 0, waitingVehicles: 0, avgWaitMin: 0,
    notes: 'En mantenimiento programado, vuelve a operar el lunes.',
  },
];

// --- Usuario inicial ---
const SEED_USER = {
  id: 'u-demo',
  name: 'Laura',
  email: 'laura@jamb.com',
  password: '1234',
  role: ROLES.USER,
  plan: 'JAMB Básico',
  vehicle: { brand: 'Renault', model: 'Kwid E-Tech', connector: 'Tipo 2 (AC)', batteryCapacityKwh: 26.8 },
  stats: { totalCharges: 18, kwhConsumed: 312, co2AvoidedKg: 96, favoriteStationId: 'st-001' },
  preferences: { weeklyGoalKwh: 45, notifications: true, favoriteStationIds: ['st-001'] },
};

const SEED_ADMIN = {
  id: 'u-admin',
  name: 'Admin JAMB',
  email: 'admin@jamb.com',
  password: 'admin1234',
  role: ROLES.ADMIN,
  plan: 'Operador de gold',
  vehicle: null,
  stats: { totalCharges: 0, kwhConsumed: 0, co2AvoidedKg: 0, favoriteStationId: null },
};

// --- Actividad reciente semilla ---
const SEED_ACTIVITY = [
  { id: 'act-1', userId: 'u-demo', stationId: 'st-001', station: 'JAMB Chapinero Norte', date: daysAgoISO(2), kwh: 14.2, costCOP: 14.2 * 780, durationMin: 42 },
  { id: 'act-2', userId: 'u-demo', stationId: 'st-003', station: 'JAMB Terminal Salitre', date: daysAgoISO(8), kwh: 22.5, costCOP: 22.5 * 810, durationMin: 25 },
  { id: 'act-3', userId: 'u-demo', stationId: 'st-002', station: 'JAMB Centro Comercial Sopó', date: daysAgoISO(15), kwh: 9.8, costCOP: 9.8 * 720, durationMin: 55 },
];

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// --- Plan semanal semilla (equivalente a la rutina semanal) ---
const SEED_PLAN = {
  Lunes: null,
  Martes: { stationId: 'st-001', hour: '07:30', targetKwh: 15 },
  Miércoles: null,
  Jueves: { stationId: 'st-003', hour: '18:00', targetKwh: 20 },
  Viernes: null,
  Sábado: { stationId: 'st-002', hour: '10:00', targetKwh: 10 },
  Domingo: null,
};

// --- Reservas semilla (equivalente al Market: solicitudes + stock) ---
const SEED_RESERVATIONS = [
  {
    id: 'res-1', userId: 'u-demo', stationId: 'st-001', connectorType: 'CCS Combo (DC)',
    date: daysAgoISO(-1), hour: '08:00', status: 'pendiente', createdAt: daysAgoISO(1),
  },
  {
    id: 'res-2', userId: 'u-demo', stationId: 'st-003', connectorType: 'CCS Combo (DC)',
    date: daysAgoISO(-3), hour: '17:30', status: 'confirmada', createdAt: daysAgoISO(2),
  },
];

const PARTNERS = ['Andes Motors', 'GridPoint Colombia', 'Banco Solar', 'Movilidad Andina', 'Rueda Verde Seguros', 'Voltia Energía'];

// utils.js — helpers de DOM, fecha y estadísticas
'use strict';

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
function dbUid() { return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${uid('db')}-0000-0000-0000-000000000000`; }

// --- Fechas ---
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const period = h >= 12 ? 'p.m.' : 'a.m.';
  const h12 = ((h + 11) % 12) + 1;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} · ${h12}:${m} ${period}`;
}

function formatDateShort(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

function todayWeekdayName() {
  const map = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return map[new Date().getDay()];
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA), b = new Date(isoB);
  return Math.round((b - a) / 86400000);
}

function localDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateInputToLocalISO(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return d.toISOString();
}

// --- Formato ---
function formatCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function formatKwh(n) { return `${Number(n).toFixed(1)} kWh`; }
function formatKm(n) { return `${Number(n).toFixed(1)} km`; }
function formatRatingStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// --- Estadísticas ---
function sum(arr, fn) { return arr.reduce((acc, x) => acc + (fn ? fn(x) : x), 0); }
function avg(arr, fn) { return arr.length ? sum(arr, fn) / arr.length : 0; }

function co2AvoidedFromKwh(kwh) {
  // Estimación de CO2 evitado por kWh frente a un vehículo de combustión.
  return Math.round(kwh * 0.31 * 10) / 10;
}

function groupByWeek(activities) {
  // Devuelve un mapa { 'YYYY-Www': totalKwh } ordenado cronológicamente
  const map = new Map();
  for (const a of activities) {
    const d = new Date(a.date);
    const week = isoWeekLabel(d);
    map.set(week, (map.get(week) || 0) + a.kwh);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function isoWeekLabel(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-S${String(weekNo).padStart(2, '0')}`;
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

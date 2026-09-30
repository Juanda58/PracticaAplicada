// views/today.js — pestaña "Hoy" (flujo de usuario + actividad de admin)
'use strict';

const TodayView = {
  render(container) {
    clear(container);
    const user = currentUser();
    if (isAdmin()) { container.appendChild(this.renderAdmin(user)); return; }
    container.appendChild(this.renderUser(user));
  },

  renderUser(user) {
    const wrap = el('div', { class: 'view view--today' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, `Hola, ${user.name.split(' ')[0]}`),
      el('p', { class: 'muted' }, 'Esto es lo que necesitas saber antes de salir a cargar hoy.'),
      el('div', { class: 'quick-actions' }, [
        el('button', { class: 'btn btn--primary', onclick: () => setUI({ tab: 'biblioteca' }) }, [icon('search'), ' Encontrar estación']),
        el('button', { class: 'btn btn--ghost', onclick: () => setUI({ tab: 'reservas' }) }, [icon('calendar'), ' Reservar horario']),
      ]),
    ]));
    wrap.appendChild(el('div', { class: 'network-banner' }, [
      el('span', { class: 'network-banner__icon', html: ICONS.pin }),
      el('div', {}, [el('strong', {}, 'Red JAMB activa'), el('span', {}, `${Stations.all().length} estaciones · sincronizada ${state.ui.lastSync ? formatDate(state.ui.lastSync.toISOString()) : 'ahora'}`)]),
      el('span', { class: 'badge badge--teal' }, 'En línea'),
      el('button', { class: 'btn btn--small btn--ghost network-banner__refresh', onclick: () => { simulateLiveUpdate(); showToast('Disponibilidad sincronizada.', 'teal'); } }, [icon('refresh'), ' Actualizar']),
    ]));

    wrap.appendChild(this.nearestStation(user));

    // Stats rápidas
    const stats = el('div', { class: 'stat-grid' }, [
      statCard('bolt', formatKwh(user.stats.kwhConsumed), 'Energía Total'),
      statCard('leaf', `${user.stats.co2AvoidedKg} kg`, 'CO₂ evitado'),
      statCard('clock', String(user.stats.totalCharges), 'Cargas realizadas'),
    ]);
    wrap.appendChild(stats);

    // Plan de hoy
    const todayName = todayWeekdayName();
    const planEntry = state.data.plan[todayName];
    const planCard = el('div', { class: 'card highlight-card' });
    if (planEntry) {
      const station = getStation(planEntry.stationId);
      planCard.appendChild(el('div', { class: 'highlight-card__row' }, [
        el('div', {}, [
          el('p', { class: 'eyebrow' }, `Plan de hoy · ${todayName}`),
          el('h3', {}, station ? station.name : 'Estación no disponible'),
          el('p', { class: 'muted' }, `${planEntry.hour} · Meta: ${formatKwh(planEntry.targetKwh)}`),
        ]),
        el('button', { class: 'btn btn--primary', onclick: () => startCharging(planEntry.stationId) }, [icon('play'), ' Empezar carga']),
      ]));
    } else {
      planCard.appendChild(el('div', {}, [
        el('p', { class: 'eyebrow' }, `Plan de hoy · ${todayName}`),
        el('p', { class: 'muted' }, 'No tienes una carga planeada para hoy. Ve a la pestaña Plan para agregar una.'),
        el('button', { class: 'btn btn--ghost', onclick: () => setUI({ tab: 'plan' }) }, 'Ir a Plan'),
      ]));
    }
    wrap.appendChild(planCard);
    wrap.appendChild(this.networkMap());

    // Estaciones cercanas
    wrap.appendChild(el('h2', { class: 'section-title' }, 'Electrolineras cerca de ti'));
    const grid = el('div', { class: 'station-grid' });
    Stations.all().slice().sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3).forEach(s => grid.appendChild(stationCard(s)));
    wrap.appendChild(grid);

    // Actividad reciente
    wrap.appendChild(el('h2', { class: 'section-title' }, 'Actividad reciente'));
    const list = el('ul', { class: 'activity-list' });
    userActivity(user.id).slice(0, 4).forEach(a => list.appendChild(activityRow(a)));
    if (!userActivity(user.id).length) list.appendChild(el('li', { class: 'muted' }, 'Aún no registras cargas.'));
    wrap.appendChild(list);

    wrap.appendChild(this.impactAndPartners(user));

    return wrap;
  },

  nearestStation(user) {
    const station = Stations.all().slice().sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (!station) return el('div', {});
    const available = Stations.totalAvailableConnectors(station);
    const status = Stations.statusMeta(station.status);
    return el('section', { class: 'nearest-card' }, [
      el('div', { class: 'nearest-card__copy' }, [
        el('p', { class: 'eyebrow' }, 'Recomendación para ti'),
        el('h2', {}, 'Tu estación más cercana'),
        el('p', { class: 'nearest-card__station' }, station.name),
        el('p', { class: 'muted small' }, [el('span', { class: 'nearest-card__pin', html: ICONS.pin }), ` ${formatKm(station.distanceKm)} · ${station.address}`]),
      ]),
      el('div', { class: 'nearest-card__status' }, [
        el('span', { class: `badge badge--${status.tone}` }, status.label),
        el('strong', {}, `${available} conectores libres`),
        el('span', { class: 'muted small' }, station.avgWaitMin ? `Espera aproximada: ${station.avgWaitMin} min` : 'Sin espera reportada'),
      ]),
      el('div', { class: 'nearest-card__actions' }, [
        el('button', { class: 'btn btn--primary btn--small', onclick: () => { setUI({ tab: 'reservas', reservationStationId: station.id }); } }, [icon('calendar'), ' Reservar aquí']),
        el('button', { class: 'btn btn--ghost btn--small', onclick: () => LibraryView.openDetail(station.id) }, 'Ver estación'),
      ]),
    ]);
  },

  impactAndPartners(user) {
    return el('section', { class: 'impact-partners-grid' }, [
      el('div', { class: 'impact-strip' }, [
        el('span', { class: 'impact-strip__icon', html: ICONS.leaf }),
        el('div', {}, [el('p', { class: 'eyebrow' }, 'Tu aporte cuenta'), el('strong', {}, `${user.stats.co2AvoidedKg} kg de CO₂ evitados`), el('p', { class: 'muted small' }, 'Cada carga eléctrica ayuda a construir una movilidad más limpia.')]),
      ]),
      el('div', { class: 'sponsors-card' }, [
        el('div', {}, [el('p', { class: 'eyebrow' }, 'Red aliada'), el('h3', {}, 'Impulsado por marcas que creen en la movilidad eléctrica')]),
        el('div', { class: 'sponsor-row', 'aria-label': 'Marcas patrocinadoras' }, PARTNERS.slice(0, 4).map((partner, index) => el('span', { class: 'sponsor-pill', style: `--i:${index}` }, partner))),
      ]),
    ]);
  },

  networkMap() {
    const map = el('section', { class: 'card network-map-card' }, [
      el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Vista de red'), el('h2', {}, 'Encuentra tu próximo punto de carga')]), el('button', { class: 'link-btn', onclick: () => setUI({ tab: 'biblioteca' }) }, 'Ver lista completa')]),
    ]);
    const canvas = el('div', { class: 'network-map', role: 'img', 'aria-label': 'Mapa visual de estaciones JAMB' });
    Stations.all().forEach((station, index) => {
      const available = Stations.totalAvailableConnectors(station);
      const marker = el('button', { class: `map-marker map-marker--${station.status}`, style: `--x:${18 + ((index * 23) % 68)}%;--y:${23 + ((index * 31) % 55)}%`, title: `${station.name}: ${available} conectores disponibles`, onclick: () => LibraryView.openDetail(station.id) }, [el('span', {}, String(index + 1))]);
      canvas.appendChild(marker);
    });
    canvas.appendChild(el('div', { class: 'map-label map-label--one' }, 'Bogotá y alrededores'));
    map.appendChild(canvas);
    map.appendChild(el('div', { class: 'map-legend' }, [el('span', {}, [el('i', { class: 'legend-dot legend-dot--available' }), ' Disponible']), el('span', {}, [el('i', { class: 'legend-dot legend-dot--busy' }), ' Ocupada']), el('span', {}, [el('i', { class: 'legend-dot legend-dot--maintenance' }), ' Mantenimiento'])]));
    return map;
  },

  renderAdmin(admin) {
    const wrap = el('div', { class: 'view view--today-admin' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, `Hola, ${admin.name}`),
      el('p', { class: 'muted' }, 'Resumen operativo de la red JAMB en tiempo real.'),
    ]));

    const stations = Stations.all();
    const totalConnectors = sum(stations, s => Stations.totalConnectors(s));
    const availableConnectors = sum(stations, s => Stations.totalAvailableConnectors(s));
    const pending = Reservations.pending().length;

    const stats = el('div', { class: 'stat-grid' }, [
      statCard('pin', String(stations.length), 'Estaciones en la red'),
      statCard('bolt', `${availableConnectors}/${totalConnectors}`, 'Conectores disponibles'),
      statCard('calendar', String(pending), 'Solicitudes pendientes'),
    ]);
    wrap.appendChild(stats);

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Solicitudes pendientes'));
    const list = el('div', { class: 'reservation-list' });
    const pendingRes = Reservations.pending();
    if (!pendingRes.length) list.appendChild(el('p', { class: 'muted' }, 'No hay solicitudes pendientes por revisar.'));
    pendingRes.forEach(r => list.appendChild(reservationAdminRow(r)));
    wrap.appendChild(list);

    wrap.appendChild(el('h2', { class: 'section-title' }, 'Estado de la red'));
    const grid = el('div', { class: 'station-grid' });
    stations.forEach(s => grid.appendChild(stationCard(s, { admin: true })));
    wrap.appendChild(grid);

    return wrap;
  },
};

function statCard(iconName, value, label) {
  return el('div', { class: 'stat-card' }, [
    el('span', { class: 'stat-card__icon', html: ICONS[iconName] }),
    el('div', {}, [el('p', { class: 'stat-card__value' }, value), el('p', { class: 'stat-card__label' }, label)]),
  ]);
}

function stationCard(station, opts = {}) {
  const status = Stations.statusMeta(station.status);
  const primary = Stations.primaryConnector(station);
  const card = el('div', { class: 'card station-card' });
  card.appendChild(el('div', { class: 'station-card__top' }, [
    el('h3', {}, station.name),
    el('span', { class: `badge badge--${status.tone}` }, status.label),
  ]));
  card.appendChild(el('p', { class: 'muted' }, station.address));
  card.appendChild(el('div', { class: 'station-card__meta' }, [
    el('span', {}, formatKm(station.distanceKm)),
    el('span', {}, primary ? primary.type : '—'),
    el('span', {}, primary ? `${primary.available}/${primary.total} libres` : ''),
  ]));
  card.appendChild(el('div', { class: 'station-card__live' }, [
    el('span', {}, `${station.activeVehicles || 0} cargando`),
    el('span', {}, `${station.waitingVehicles || 0} en espera`),
  ]));
  const actions = el('div', { class: 'station-card__actions' });
  actions.appendChild(el('button', { class: 'btn btn--ghost btn--small', onclick: () => { setUI({ tab: 'biblioteca' }); setTimeout(() => LibraryView.openDetail && LibraryView.openDetail(station.id), 0); } }, 'Ver detalle'));
  if (!opts.admin) actions.appendChild(el('button', { class: 'btn btn--primary btn--small', onclick: () => startCharging(station.id) }, 'Cargar aquí'));
  card.appendChild(actions);
  return card;
}

function activityRow(a) {
  return el('li', { class: 'activity-row' }, [
    el('span', { class: 'activity-row__icon', html: ICONS.bolt }),
    el('div', { class: 'activity-row__body' }, [
      el('p', {}, a.station),
      el('p', { class: 'muted small' }, formatDate(a.date)),
    ]),
    el('span', { class: 'activity-row__kwh' }, formatKwh(a.kwh)),
  ]);
}

function reservationAdminRow(r) {
  const station = getStation(r.stationId);
  const user = state.data.users.find(u => u.id === r.userId);
  return el('div', { class: 'card reservation-row' }, [
    el('div', {}, [
      el('p', {}, `${user ? user.name : 'Usuario'} · ${station ? station.name : ''}`),
      el('p', { class: 'muted small' }, `${r.connectorType} · ${formatDateShort(r.date)} ${r.hour}`),
    ]),
    el('div', { class: 'reservation-row__actions' }, [
      el('button', { class: 'btn btn--icon btn--danger', title: 'Rechazar', onclick: () => Reservations.reject(r.id) }, icon('x')),
      el('button', { class: 'btn btn--icon btn--success', title: 'Aprobar', onclick: () => Reservations.approve(r.id) }, icon('check')),
    ]),
  ]);
}

function startCharging(stationId) {
  setUI({ chargingStationId: stationId, tab: '__charging__' });
}

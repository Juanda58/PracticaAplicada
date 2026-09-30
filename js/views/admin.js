// views/admin.js — panel operativo para administradores
'use strict';

const AdminView = {
  renderDashboard(container) {
    clear(container);
    const wrap = this.shell('Centro de operaciones', 'Controla la red, las reservas y la actividad de JAMB desde un solo lugar.');
    const stations = Stations.all();
    const reservations = Reservations.all();
    const users = state.data.users.filter(user => user.role === ROLES.USER);
    const connectors = sum(stations, station => Stations.totalConnectors(station));
    const available = sum(stations, station => Stations.totalAvailableConnectors(station));
    const pending = reservations.filter(item => item.status === 'pendiente').length;
    const revenue = sum(reservations.filter(item => ['pendiente', 'confirmada', 'completada'].includes(item.status)), item => item.estimatedCost || 0);

    wrap.appendChild(el('div', { class: 'admin-action-bar' }, [
      el('div', {}, [el('span', { class: 'live-strip' }, [el('span', { class: 'live-dot' }), 'Monitoreo activo']), el('p', { class: 'muted small' }, 'Los datos de disponibilidad se actualizan automáticamente cada 12 segundos.')]),
      el('div', { class: 'admin-action-bar__actions' }, [
        el('button', { class: 'btn btn--ghost btn--small', onclick: () => { simulateLiveUpdate(); showToast('Red sincronizada.', 'teal'); } }, [icon('refresh'), ' Sincronizar']),
        el('button', { class: 'btn btn--primary btn--small', onclick: () => setUI({ tab: 'admin-estaciones' }) }, [icon('plus'), ' Nueva estación']),
      ]),
    ]));

    wrap.appendChild(el('div', { class: 'admin-stat-grid' }, [
      adminStat('pin', stations.length, 'Estaciones', `${stations.filter(s => s.status === 'disponible').length} operativas`),
      adminStat('bolt', `${available}/${connectors}`, 'Conectores libres', `${Math.round((available / Math.max(connectors, 1)) * 100)}% de capacidad`),
      adminStat('calendar', pending, 'Reservas pendientes', pending ? 'Requieren revisión' : 'Todo al día'),
      adminStat('user', users.length, 'Usuarios registrados', `${users.filter(u => u.preferences?.notifications !== false).length} con notificaciones`),
      adminStat('chart', formatCOP(revenue), 'Valor reservado', 'Acumulado de reservas'),
      adminStat('clock', sum(stations, s => s.waitingVehicles || 0), 'Personas en espera', 'Estado en tiempo real'),
    ]));

    const alert = pending ? el('div', { class: 'admin-alert admin-alert--warning' }, [el('strong', {}, `${pending} solicitud${pending === 1 ? '' : 'es'} pendiente${pending === 1 ? '' : 's'}`), el('span', {}, 'Revisa disponibilidad y confirma los horarios antes de aprobar.'), el('button', { class: 'link-btn', onclick: () => setUI({ tab: 'admin-reservas' }) }, 'Revisar ahora')]) : el('div', { class: 'admin-alert admin-alert--success' }, [el('strong', {}, 'Operación al día'), el('span', {}, 'No hay solicitudes de reserva pendientes.')]);
    wrap.appendChild(alert);

    const content = el('div', { class: 'admin-dashboard-grid' });
    const liveCard = el('section', { class: 'card admin-table-card' }, [el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Red en vivo'), el('h2', {}, 'Estado de las estaciones')]), el('button', { class: 'link-btn', onclick: () => setUI({ tab: 'admin-estaciones' }) }, 'Gestionar red')])]);
    const table = el('div', { class: 'admin-station-table' });
    stations.forEach(station => table.appendChild(this.stationRow(station)));
    liveCard.appendChild(table);
    content.appendChild(liveCard);

    const activityCard = el('section', { class: 'card admin-activity-card' }, [el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Trazabilidad'), el('h2', {}, 'Actividad reciente')]), el('button', { class: 'link-btn', onclick: () => setUI({ tab: 'admin-auditoria' }) }, 'Ver auditoría')])]);
    const audit = (state.data.audit || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 7);
    if (!audit.length) activityCard.appendChild(el('p', { class: 'muted small' }, 'Aún no hay eventos administrativos registrados.'));
    audit.forEach(item => activityCard.appendChild(this.auditRow(item)));
    content.appendChild(activityCard);
    wrap.appendChild(content);
    container.appendChild(wrap);
  },

  renderStations(container) {
    clear(container);
    const wrap = this.shell('Gestión de estaciones', 'Administra disponibilidad, tarifas, conectores y estado operativo de cada punto.');
    const search = el('input', { type: 'search', class: 'admin-search', placeholder: 'Buscar por nombre, ciudad o dirección' });
    const status = el('select', { class: 'admin-filter' }, [el('option', { value: 'todas' }, 'Todos los estados'), ...Object.entries(STATION_STATUS).map(([key, meta]) => el('option', { value: key }, meta.label))]);
    const grid = el('div', { class: 'admin-card-grid' });
    const fill = () => { clear(grid); Stations.filter({ query: search.value, status: status.value }).forEach(station => grid.appendChild(this.stationAdminCard(station))); if (!grid.children.length) grid.appendChild(el('p', { class: 'muted' }, 'No hay estaciones que coincidan con el filtro.')); };
    search.addEventListener('input', debounce(fill, 150));
    status.addEventListener('change', fill);
    wrap.appendChild(el('div', { class: 'admin-toolbar' }, [el('div', { class: 'search-box' }, [icon('search'), search]), status, el('button', { class: 'btn btn--primary btn--small', onclick: () => LibraryView.openForm(null) }, [icon('plus'), ' Nueva estación'])]));
    wrap.appendChild(grid);
    fill();
    container.appendChild(wrap);
  },

  renderReservations(container) {
    clear(container);
    const wrap = this.shell('Control de reservas', 'Aprueba horarios, revisa pagos anticipados y registra incumplimientos.');
    const filter = el('select', { class: 'admin-filter' }, [el('option', { value: 'todas' }, 'Todas'), ...Object.entries(RESERVATION_STATUS).map(([key, meta]) => el('option', { value: key }, meta.label))]);
    const list = el('div', { class: 'admin-reservation-list' });
    const fill = () => { clear(list); const rows = Reservations.all().filter(item => filter.value === 'todas' || item.status === filter.value).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); if (!rows.length) list.appendChild(el('p', { class: 'muted' }, 'No hay reservas con este estado.')); rows.forEach(item => list.appendChild(this.reservationRow(item))); };
    filter.addEventListener('change', fill);
    wrap.appendChild(el('div', { class: 'admin-toolbar' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Flujo operativo'), el('strong', {}, 'Pago anticipado y cumplimiento')]), filter]));
    wrap.appendChild(list);
    fill();
    container.appendChild(wrap);
  },

  renderUsers(container) {
    clear(container);
    const wrap = this.shell('Usuarios y clientes', 'Consulta el estado de las cuentas y el uso de la red.');
    const search = el('input', { type: 'search', class: 'admin-search', placeholder: 'Buscar por nombre o correo' });
    const grid = el('div', { class: 'admin-user-grid' });
    const fill = () => { clear(grid); state.data.users.filter(user => user.role === ROLES.USER && `${user.name} ${user.email}`.toLowerCase().includes(search.value.toLowerCase())).forEach(user => grid.appendChild(this.userCard(user))); if (!grid.children.length) grid.appendChild(el('p', { class: 'muted' }, 'No hay usuarios que coincidan con la búsqueda.')); };
    search.addEventListener('input', debounce(fill, 150));
    wrap.appendChild(el('div', { class: 'admin-toolbar' }, [el('div', { class: 'search-box' }, [icon('search'), search]), el('span', { class: 'badge badge--teal' }, `${state.data.users.filter(user => user.role === ROLES.USER).length} clientes`) ]));
    wrap.appendChild(grid);
    fill();
    container.appendChild(wrap);
  },

  renderAudit(container) {
    clear(container);
    const wrap = this.shell('Auditoría del sistema', 'Registro de acciones administrativas y cambios importantes de la operación.');
    const audit = (state.data.audit || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const list = el('div', { class: 'audit-list' });
    if (!audit.length) list.appendChild(el('p', { class: 'muted' }, 'Todavía no hay eventos para mostrar.'));
    audit.forEach(item => list.appendChild(this.auditRow(item, true)));
    wrap.appendChild(list);
    container.appendChild(wrap);
  },

  shell(title, description) {
    const configured = typeof isSupabaseConfigured === 'function' && isSupabaseConfigured();
    return el('div', { class: 'view view--admin' }, [el('header', { class: 'view-header' }, [el('p', { class: 'eyebrow' }, 'Administración JAMB'), el('h1', {}, title), el('p', { class: 'muted' }, description), el('span', { class: `badge ${configured ? 'badge--teal' : 'badge--copper'} admin-connection-badge` }, `Supabase: ${configured ? 'Configurado' : 'Pendiente de configurar'}`)])]);
  },

  stationRow(station) {
    const status = Stations.statusMeta(station.status);
    const available = Stations.totalAvailableConnectors(station);
    return el('div', { class: 'admin-station-row' }, [el('div', { class: 'admin-station-row__name' }, [el('span', { class: `status-dot status-dot--${status.tone}` }), el('strong', {}, station.name), el('small', { class: 'muted' }, station.city)]), el('span', { class: 'badge badge--' + status.tone }, status.label), el('span', { class: 'admin-live-number' }, `${available}/${Stations.totalConnectors(station)} libres`), el('span', { class: 'muted small' }, `${station.activeVehicles || 0} cargando · ${station.waitingVehicles || 0} espera`)]);
  },

  stationAdminCard(station) {
    const status = Stations.statusMeta(station.status);
    const card = el('article', { class: 'card admin-station-card' }, [el('div', { class: 'station-card__top' }, [el('div', {}, [el('p', { class: 'eyebrow' }, station.city), el('h3', {}, station.name)]), el('span', { class: `badge badge--${status.tone}` }, status.label)]), el('p', { class: 'muted small' }, station.address), el('div', { class: 'admin-station-metrics' }, [el('div', {}, [el('strong', {}, `${Stations.totalAvailableConnectors(station)}/${Stations.totalConnectors(station)}`), el('span', {}, 'conectores libres')]), el('div', {}, [el('strong', {}, String(station.waitingVehicles || 0)), el('span', {}, 'en espera')]), el('div', {}, [el('strong', {}, formatCOP(station.pricePerKwh)), el('span', {}, 'por kWh')])]), el('div', { class: 'station-card__actions' }, [el('button', { class: 'btn btn--ghost btn--small', onclick: () => LibraryView.openForm(station.id) }, [icon('edit'), ' Editar']), el('button', { class: 'btn btn--danger btn--small', onclick: () => LibraryView.deleteStation(station.id) }, [icon('trash'), ' Eliminar'])])]);
    return card;
  },

  reservationRow(reservation) {
    const station = getStation(reservation.stationId);
    const user = state.data.users.find(item => item.id === reservation.userId);
    const meta = Reservations.statusMeta(reservation.status);
    const actions = [];
    if (reservation.status === 'pendiente') { actions.push(el('button', { class: 'btn btn--success btn--small', onclick: () => { Reservations.approve(reservation.id); showToast('Reserva confirmada.', 'teal'); setUI({ tab: 'admin-reservas' }); } }, [icon('check'), ' Aprobar'])); actions.push(el('button', { class: 'btn btn--danger btn--small', onclick: () => { Reservations.reject(reservation.id); showToast('Reserva rechazada.', 'danger'); setUI({ tab: 'admin-reservas' }); } }, [icon('x'), ' Rechazar'])); }
    if (reservation.status === 'confirmada') actions.push(el('button', { class: 'btn btn--danger btn--small', onclick: () => { Reservations.markNoShow(reservation.id); showToast('Incumplimiento registrado.', 'danger'); setUI({ tab: 'admin-reservas' }); } }, 'Marcar no cumplida'));
    return el('article', { class: 'card admin-reservation-row' }, [el('div', { class: 'admin-reservation-row__main' }, [el('div', { class: 'admin-reservation-avatar' }, (user?.name || 'U').charAt(0)), el('div', {}, [el('strong', {}, user ? user.name : 'Usuario'), el('p', { class: 'muted small' }, `${station ? station.name : 'Estación eliminada'} · ${reservation.connectorType}`), el('p', { class: 'muted small' }, `${formatDateShort(reservation.date)} a las ${reservation.hour} · ${formatCOP(reservation.estimatedCost || 0)} · ${reservation.paymentMethod || 'Pago en línea'}`)])]), el('div', { class: 'admin-reservation-row__side' }, [el('span', { class: `badge badge--${meta.tone}` }, meta.label), reservation.penaltyCOP ? el('small', { class: 'form-error' }, `Multa: ${formatCOP(reservation.penaltyCOP)}`) : null, ...actions])]);
  },

  userCard(user) {
    const reservations = Reservations.forUser(user.id);
    const charges = user.stats?.totalCharges || 0;
    return el('article', { class: 'card admin-user-card' }, [el('div', { class: 'admin-user-card__top' }, [el('div', { class: 'admin-user-avatar' }, user.name.charAt(0)), el('div', {}, [el('strong', {}, user.name), el('p', { class: 'muted small' }, user.email)]), el('span', { class: 'badge badge--teal' }, 'Activo')]), el('div', { class: 'admin-user-stats' }, [el('span', {}, [el('strong', {}, String(charges)), ' cargas']), el('span', {}, [el('strong', {}, formatKwh(user.stats?.kwhConsumed || 0)), ' consumidos']), el('span', {}, [el('strong', {}, String(reservations.length)), ' reservas'])]), el('p', { class: 'muted small' }, `${user.vehicle?.brand || ''} ${user.vehicle?.model || 'Vehículo sin registrar'}`)]);
  },

  auditRow(item, detailed = false) {
    return el('div', { class: 'audit-row' }, [el('span', { class: 'audit-row__icon' }, icon(item.tone === 'danger' ? 'x' : item.tone === 'teal' ? 'check' : 'bolt')), el('div', {}, [el('strong', {}, item.action), el('p', { class: 'muted small' }, item.detail || 'Sin detalle')]), el('time', { class: 'muted small', datetime: item.createdAt }, detailed ? formatDate(item.createdAt) : formatDateShort(item.createdAt))]);
  },
};

function adminStat(iconName, value, label, hint) {
  return el('div', { class: 'admin-stat' }, [el('span', { class: 'admin-stat__icon', html: ICONS[iconName] }), el('div', {}, [el('strong', {}, value), el('span', {}, label), el('small', {}, hint)])]);
}

function adminRerender() { setUI({ tab: state.ui.tab }); }

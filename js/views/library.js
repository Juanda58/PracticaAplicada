// views/library.js — pestaña "Biblioteca" (catálogo de electrolineras)
'use strict';

const LibraryView = {
  _filters: { query: '', status: 'todas', connector: 'todos', sort: 'distance', favoritesOnly: false },
  _detailId: null,

  render(container) {
    clear(container);
    if (this._liveTimer) clearInterval(this._liveTimer);
    const wrap = el('div', { class: 'view view--library' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('h1', {}, 'Biblioteca de electrolineras'),
      el('p', { class: 'muted' }, 'Consulta conectores, ocupación y espera antes de reservar tu espacio.'),
    ]));
    wrap.appendChild(el('div', { class: 'live-strip' }, [el('span', { class: 'live-dot' }), 'Disponibilidad simulada en tiempo real · Actualizada ahora']));

    wrap.appendChild(this.renderFilters());

    if (isAdmin()) {
      wrap.appendChild(el('div', { class: 'view-actions' }, [
        el('button', { class: 'btn btn--primary', onclick: () => this.openForm(null) }, [icon('plus'), ' Nueva estación']),
      ]));
    }

    const grid = el('div', { class: 'station-grid', id: 'library-grid' });
    this.fillGrid(grid);
    wrap.appendChild(grid);

    container.appendChild(wrap);
    this._liveTimer = setInterval(() => {
      if (state.ui.tab === 'biblioteca') this.refreshGrid();
    }, 20000);
  },

  renderFilters() {
    const bar = el('div', { class: 'filter-bar' });
    const search = el('input', { type: 'search', placeholder: 'Busca una electrolinera', value: this._filters.query });
    search.addEventListener('input', debounce((e) => { this._filters.query = e.target.value; this.refreshGrid(); }, 200));

    const statusSelect = el('select', {}, [
      el('option', { value: 'todas' }, 'Todas'),
      ...Object.entries(STATION_STATUS).map(([k, v]) => el('option', { value: k, selected: this._filters.status === k ? 'selected' : null }, v.label)),
    ]);
    statusSelect.value = this._filters.status;
    statusSelect.addEventListener('change', (e) => { this._filters.status = e.target.value; this.refreshGrid(); });

    const connectorSelect = el('select', {}, [
      el('option', { value: 'todos' }, 'Todos los conectores'),
      ...CONNECTOR_TYPES.map(c => el('option', { value: c }, c)),
    ]);
    connectorSelect.value = this._filters.connector;
    connectorSelect.addEventListener('change', (e) => { this._filters.connector = e.target.value; this.refreshGrid(); });

    const sortSelect = el('select', {}, [el('option', { value: 'distance' }, 'Más cercanas'), el('option', { value: 'availability' }, 'Más disponibilidad'), el('option', { value: 'rating' }, 'Mejor calificadas'), el('option', { value: 'price' }, 'Menor tarifa')]);
    sortSelect.value = this._filters.sort;
    sortSelect.addEventListener('change', (e) => { this._filters.sort = e.target.value; this.refreshGrid(); });
    const favorites = !isAdmin() ? el('label', { class: 'filter-check' }, [el('input', { type: 'checkbox', checked: this._filters.favoritesOnly ? 'checked' : null }), ' Solo favoritas']) : null;
    if (favorites) favorites.querySelector('input').addEventListener('change', (e) => { this._filters.favoritesOnly = e.target.checked; this.refreshGrid(); });

    return el('div', { class: 'filter-bar__row' }, [
      el('div', { class: 'search-box' }, [el('span', { html: ICONS.search }), search]),
      statusSelect, connectorSelect, sortSelect, favorites,
    ]);
  },

  refreshGrid() {
    const grid = $('#library-grid');
    if (grid) this.fillGrid(grid);
  },

  fillGrid(grid) {
    clear(grid);
    let results = Stations.filter(this._filters);
    if (this._filters.favoritesOnly && !isAdmin()) {
      const ids = currentUser().preferences?.favoriteStationIds || [];
      results = results.filter(station => ids.includes(station.id));
    }
    results.sort((a, b) => {
      if (this._filters.sort === 'availability') return Stations.totalAvailableConnectors(b) - Stations.totalAvailableConnectors(a);
      if (this._filters.sort === 'rating') return b.rating - a.rating;
      if (this._filters.sort === 'price') return a.pricePerKwh - b.pricePerKwh;
      return a.distanceKm - b.distanceKm;
    });
    if (!results.length) { grid.appendChild(el('p', { class: 'muted' }, 'No hay electrolineras con este filtro.')); return; }
    results.forEach(s => grid.appendChild(this.card(s)));
  },

  card(station) {
    const status = Stations.statusMeta(station.status);
    const card = el('div', { class: 'card station-card' });
    card.appendChild(el('div', { class: 'station-card__top' }, [
      el('h3', {}, station.name),
      el('span', { class: `badge badge--${status.tone}` }, status.label),
    ]));
    card.appendChild(el('p', { class: 'muted' }, station.address));
    card.appendChild(el('div', { class: 'rating' }, [el('span', {}, formatRatingStars(station.rating)), el('span', { class: 'muted small' }, ` ${station.rating.toFixed(1)}`)]));
    card.appendChild(el('div', { class: 'station-card__meta' }, [
      el('span', {}, formatKm(station.distanceKm)),
      el('span', {}, `${Stations.totalAvailableConnectors(station)}/${Stations.totalConnectors(station)} libres`),
      el('span', {}, formatCOP(station.pricePerKwh) + '/kWh'),
    ]));
    card.appendChild(el('div', { class: 'station-card__live' }, [
      el('span', {}, `${station.activeVehicles || 0} cargando`),
      el('span', {}, `${station.waitingVehicles || 0} en espera`),
      station.avgWaitMin ? el('span', {}, `Espera ~${station.avgWaitMin} min`) : el('span', {}, 'Sin espera'),
    ]));
    const actions = el('div', { class: 'station-card__actions' }, [
      el('button', { class: 'btn btn--ghost btn--small', onclick: () => this.openDetail(station.id) }, ['Ver detalle ', icon('chevronRight')]),
    ]);
    if (!isAdmin()) {
      const user = currentUser();
      const favorites = user.preferences?.favoriteStationIds || [];
      const favorite = favorites.includes(station.id);
      actions.appendChild(el('button', { class: `btn btn--small ${favorite ? 'btn--favorite-active' : 'btn--ghost'}`, onclick: () => { setData(d => { const current = d.users.find(u => u.id === user.id); current.preferences = current.preferences || { favoriteStationIds: [] }; const ids = current.preferences.favoriteStationIds || []; current.preferences.favoriteStationIds = ids.includes(station.id) ? ids.filter(id => id !== station.id) : [...ids, station.id]; }); this.refreshGrid(); showToast(favorite ? 'Estación quitada de favoritas.' : 'Estación guardada en favoritas.', 'teal'); } }, [el('span', {}, favorite ? '★' : '☆'), favorite ? ' Favorita' : ' Guardar']));
    }
    if (isAdmin()) {
      actions.appendChild(el('button', { class: 'btn btn--icon', title: 'Editar', onclick: () => this.openForm(station.id) }, icon('edit')));
      actions.appendChild(el('button', { class: 'btn btn--icon btn--danger', title: 'Eliminar', onclick: () => this.deleteStation(station.id) }, icon('trash')));
    }
    card.appendChild(actions);
    return card;
  },

  openDetail(id) {
    this._detailId = id;
    const station = Stations.find(id);
    if (!station) { showToast('No encontramos esta electrolinera.', 'danger'); return; }
    const status = Stations.statusMeta(station.status);
    const body = el('div', { class: 'station-detail' }, [
      el('div', { class: 'station-detail__top' }, [
        el('span', { class: `badge badge--${status.tone}` }, status.label),
        el('div', { class: 'rating' }, [el('span', {}, formatRatingStars(station.rating)), el('span', { class: 'muted small' }, ` ${station.rating.toFixed(1)}`)]),
      ]),
      el('p', { class: 'muted' }, station.address),
      el('p', {}, station.notes || ''),
      el('h4', {}, 'Conectores'),
      el('ul', { class: 'connector-list' }, station.connectors.map(c => el('li', {}, [
        el('span', {}, c.type), el('span', { class: 'muted' }, c.power), el('span', {}, `${c.available}/${c.total} libres`),
      ]))),
      el('h4', {}, 'Servicios en el sitio'),
      el('div', { class: 'chip-row' }, station.amenities.map(a => el('span', { class: 'chip' }, a))),
      el('p', { class: 'price-line' }, `Tarifa estimada: ${formatCOP(station.pricePerKwh)} / kWh`),
      el('p', { class: 'muted small' }, `${station.activeVehicles || 0} vehículos cargando · ${station.waitingVehicles || 0} en espera · espera promedio ${station.avgWaitMin || 0} min`),
    ]);

    Modal.open({
      title: station.name,
      body,
      actions: [
        { label: 'Cerrar', variant: 'ghost', onClick: () => { this._detailId = null; Modal.close(); } },
        ...(!isAdmin() ? [{ label: 'Reservar horario', variant: 'ghost', onClick: () => { this._detailId = null; Modal.close(); setUI({ reservationStationId: station.id, tab: 'reservas' }); } }] : []),
        { label: 'Cargar aquí', variant: 'primary', onClick: () => { this._detailId = null; Modal.close(); setUI({ chargingStationId: station.id, tab: '__charging__' }); } },
      ],
    });
  },

  openForm(id) {
    const station = id ? Stations.find(id) : null;
    const form = el('form', { class: 'form' });
    const name = el('input', { name: 'name', required: true, value: station ? station.name : '', placeholder: 'Ej. JAMB Centro' });
    const address = el('input', { name: 'address', required: true, value: station ? station.address : '' });
    const city = el('input', { name: 'city', required: true, value: station ? station.city : '' });
    const distance = el('input', { type: 'number', step: '0.1', name: 'distanceKm', value: station ? station.distanceKm : 1 });
    const price = el('input', { type: 'number', step: '10', name: 'pricePerKwh', value: station ? station.pricePerKwh : 750 });
    const rating = el('input', { type: 'number', step: '0.1', min: '1', max: '5', name: 'rating', value: station ? station.rating : 4.5 });
    const statusSelect = el('select', { name: 'status' }, Object.entries(STATION_STATUS).map(([k, v]) => el('option', { value: k, selected: station && station.status === k ? 'selected' : null }, v.label)));
    const amenitiesWrap = el('div', { class: 'chip-row chip-row--pick' },
      AMENITIES.map(a => {
        const active = station && station.amenities.includes(a);
        const chip = el('button', { type: 'button', class: `chip chip--pickable ${active ? 'is-active' : ''}` }, a);
        chip.dataset.value = a;
        chip.addEventListener('click', () => chip.classList.toggle('is-active'));
        return chip;
      })
    );

    form.append(
      el('label', {}, ['Nombre', name]),
      el('label', {}, ['Dirección', address]),
      el('label', {}, ['Ciudad', city]),
      el('div', { class: 'form-row' }, [
        el('label', {}, ['Distancia (km)', distance]),
        el('label', {}, ['Tarifa (COP/kWh)', price]),
        el('label', {}, ['Calificación', rating]),
      ]),
      el('label', {}, ['Estado', statusSelect]),
      el('label', {}, ['Servicios', amenitiesWrap]),
    );

    Modal.open({
      title: station ? 'Editar electrolinera' : 'Nueva electrolinera',
      body: form,
      actions: [
        { label: 'Cancelar', variant: 'ghost', onClick: () => Modal.close() },
        {
          label: 'Guardar', variant: 'primary', onClick: () => {
            if (!name.value || !address.value || !city.value) { showToast('Completa los campos obligatorios.', 'danger'); return; }
            const amenities = $$('.chip--pickable.is-active', amenitiesWrap).map(c => c.dataset.value);
            const payload = {
              name: name.value, address: address.value, city: city.value,
              distanceKm: Number(distance.value), pricePerKwh: Number(price.value),
              rating: Number(rating.value), status: statusSelect.value, amenities,
            };
            if (station) Stations.update(station.id, payload);
            else Stations.create(payload);
            showToast('Electrolinera guardada.');
            Modal.close();
            if ($('#library-grid')) this.refreshGrid();
            else if (state.ui.tab === 'admin-estaciones') setUI({ tab: 'admin-estaciones' });
          },
        },
      ],
    });
  },

  deleteStation(id) {
    Modal.confirm({
      title: 'Eliminar electrolinera',
      message: '¿Seguro que quieres eliminarla? Esta acción no se puede deshacer.',
      onConfirm: () => { Stations.remove(id); showToast('Electrolinera eliminada.'); if ($('#library-grid')) this.refreshGrid(); else if (state.ui.tab === 'admin-estaciones') setUI({ tab: 'admin-estaciones' }); },
    });
  },
};

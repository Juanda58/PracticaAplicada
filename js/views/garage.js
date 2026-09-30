// views/garage.js — Fase 2: perfil, vehículo, objetivos y favoritos
'use strict';

const GarageView = {
  render(container) {
    clear(container);
    const user = currentUser();
    if (!user || isAdmin()) {
      container.appendChild(el('div', { class: 'empty-state card' }, [el('h2', {}, 'Mi garaje'), el('p', { class: 'muted' }, 'Esta sección está disponible para perfiles de usuario.') ]));
      return;
    }
    user.preferences = { weeklyGoalKwh: 45, notifications: true, favoriteStationIds: [], accent: 'blue', ...(user.preferences || {}) };
    const wrap = el('div', { class: 'view view--garage' });
    wrap.appendChild(el('header', { class: 'view-header' }, [
      el('p', { class: 'eyebrow' }, 'Fase 2 · Tu espacio personal'),
      el('h1', {}, 'Mi garaje'),
      el('p', { class: 'muted' }, 'Configura tu vehículo y toma decisiones de carga hechas para ti.'),
    ]));

    const weekly = this.weeklyKwh(user);
    const goal = Number(user.preferences.weeklyGoalKwh) || 45;
    const pct = Math.min(100, Math.round((weekly / goal) * 100));
    wrap.appendChild(el('div', { class: 'garage-hero' }, [
      el('div', { class: 'garage-hero__icon', html: ICONS.car }),
      el('div', {}, [el('p', { class: 'eyebrow' }, 'Tu objetivo semanal'), el('h2', {}, `${formatKwh(weekly)} de ${formatKwh(goal)}`), el('div', { class: 'progress-bar' }, [el('div', { class: 'progress-bar__fill', style: `width:${pct}%` })]), el('p', { class: 'muted small' }, pct >= 100 ? 'Objetivo cumplido. Tu constancia mueve el cambio.' : `Te faltan ${formatKwh(Math.max(0, goal - weekly))} para alcanzar tu meta.`)]),
      el('span', { class: 'garage-hero__pct' }, `${pct}%`),
    ]));

    const grid = el('div', { class: 'garage-grid' });
    grid.appendChild(this.vehicleCard(user));
    grid.appendChild(this.impactCard(user));
    wrap.appendChild(grid);
    wrap.appendChild(this.preferencesCard(user));
    wrap.appendChild(this.favoritesCard(user));
    container.appendChild(wrap);
  },

  weeklyKwh(user) {
    const cutoff = Date.now() - 7 * 86400000;
    return [...userActivity(user.id), ...(state.data.weightLog || [])].filter(item => new Date(item.date).getTime() >= cutoff).reduce((sum, item) => sum + Number(item.kwh || 0), 0);
  },

  vehicleCard(user) {
    const vehicle = user.vehicle || {};
    const card = el('div', { class: 'card garage-card' }, [el('div', { class: 'garage-card__heading' }, [el('div', { class: 'stat-card__icon', html: ICONS.car }), el('div', {}, [el('p', { class: 'eyebrow' }, 'Vehículo conectado'), el('h2', {}, vehicle.model || 'Mi vehículo')])])]);
    card.appendChild(el('div', { class: 'vehicle-specs' }, [
      el('span', {}, `${vehicle.brand || 'Marca pendiente'}`), el('span', {}, vehicle.connector || 'Conector pendiente'), el('span', {}, `${vehicle.batteryCapacityKwh || 0} kWh`),
    ]));
    card.appendChild(el('button', { class: 'btn btn--ghost btn--small', onclick: () => this.editVehicle(user) }, [icon('edit'), ' Editar vehículo']));
    return card;
  },

  impactCard(user) {
    return el('div', { class: 'card garage-card impact-card' }, [el('p', { class: 'eyebrow' }, 'Tu impacto'), el('h2', {}, `${user.stats.co2AvoidedKg} kg`), el('p', { class: 'muted' }, 'de CO₂ evitado al elegir movilidad eléctrica.'), el('div', { class: 'impact-card__detail' }, [el('span', {}, `${user.stats.totalCharges} cargas`), el('span', {}, `${formatKwh(user.stats.kwhConsumed)} acumulados`)])]);
  },

  preferencesCard(user) {
    const prefs = user.preferences;
    const card = el('div', { class: 'card' }, [el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Control personal'), el('h2', {}, 'Mis preferencias')])])]);
    const form = el('form', { class: 'form form--inline garage-preferences' });
    const goal = el('input', { type: 'number', min: '5', step: '5', value: prefs.weeklyGoalKwh });
    const notifications = el('input', { type: 'checkbox', checked: prefs.notifications ? 'checked' : null });
    const accents = ['blue', 'copper', 'teal', 'violet'];
    const accentPicker = el('div', { class: 'accent-picker', role: 'radiogroup', 'aria-label': 'Color de perfil' }, accents.map(accent => el('button', {
      type: 'button',
      class: `accent-swatch accent-swatch--${accent} ${prefs.accent === accent ? 'is-selected' : ''}`,
      'aria-label': `Usar acento ${accent}`,
      'aria-pressed': String(prefs.accent === accent),
      onclick: event => {
        $$('.accent-swatch', accentPicker).forEach(item => { item.classList.remove('is-selected'); item.setAttribute('aria-pressed', 'false'); });
        event.currentTarget.classList.add('is-selected');
        event.currentTarget.setAttribute('aria-pressed', 'true');
      },
    })));
    form.append(el('label', {}, ['Meta semanal (kWh)', goal]), el('label', { class: 'checkbox-label garage-notifications' }, [notifications, ' Recibir recordatorios']), el('div', { class: 'accent-setting' }, [el('span', { class: 'small muted' }, 'Color de tu espacio'), accentPicker]), el('button', { class: 'btn btn--primary', type: 'submit' }, 'Guardar preferencias'));
    form.addEventListener('submit', event => { event.preventDefault(); const selected = $('.accent-swatch.is-selected', accentPicker)?.className.match(/accent-swatch--(\w+)/)?.[1] || 'blue'; setData(data => { const current = data.users.find(item => item.id === user.id); current.preferences = { ...current.preferences, weeklyGoalKwh: Number(goal.value) || 45, notifications: notifications.checked, accent: selected }; }); showToast('Preferencias actualizadas.'); });
    card.appendChild(form);
    return card;
  },

  favoritesCard(user) {
    const ids = user.preferences.favoriteStationIds || [];
    const favorites = Stations.all().filter(station => ids.includes(station.id));
    const card = el('div', { class: 'card' }, [el('div', { class: 'section-heading' }, [el('div', {}, [el('p', { class: 'eyebrow' }, 'Tus atajos'), el('h2', {}, 'Estaciones favoritas')]), el('button', { class: 'link-btn', onclick: () => setUI({ tab: 'biblioteca' }) }, 'Explorar todas')])]);
    const list = el('div', { class: 'favorite-list' });
    if (!favorites.length) list.appendChild(el('p', { class: 'muted' }, 'Aún no tienes favoritas. Explora la Biblioteca y guarda la que más uses.'));
    favorites.forEach(station => list.appendChild(el('div', { class: 'favorite-row' }, [el('span', { class: 'favorite-row__star' }, '★'), el('div', {}, [el('strong', {}, station.name), el('span', { class: 'muted small' }, `${formatKm(station.distanceKm)} · ${station.waitingVehicles || 0} en espera`)]), el('button', { class: 'btn btn--small btn--primary', onclick: () => startCharging(station.id) }, 'Cargar')])))
    card.appendChild(list);
    return card;
  },

  editVehicle(user) {
    const form = el('form', { class: 'form' });
    const brand = el('input', { value: user.vehicle?.brand || '', required: true });
    const model = el('input', { value: user.vehicle?.model || '', required: true });
    const connector = el('select', {}, CONNECTOR_TYPES.map(type => el('option', { value: type, selected: user.vehicle?.connector === type ? 'selected' : null }, type)));
    const battery = el('input', { type: 'number', min: '1', step: '0.1', value: user.vehicle?.batteryCapacityKwh || 40 });
    form.append(el('label', {}, ['Marca', brand]), el('label', {}, ['Modelo', model]), el('label', {}, ['Conector', connector]), el('label', {}, ['Batería (kWh)', battery]));
    Modal.open({ title: 'Editar mi vehículo', body: form, actions: [{ label: 'Cancelar', variant: 'ghost', onClick: () => Modal.close() }, { label: 'Guardar', variant: 'primary', onClick: () => { setData(data => { const current = data.users.find(item => item.id === user.id); current.vehicle = { brand: brand.value, model: model.value, connector: connector.value, batteryCapacityKwh: Number(battery.value) || 0 }; }); Modal.close(); showToast('Vehículo actualizado.'); } }] });
  },
};

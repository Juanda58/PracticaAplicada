// app.js — render raíz, login, navegación, shell de la app
'use strict';

const VIEWS = {
  hoy: TodayView, plan: PlanView, progreso: ProgressView,
  biblioteca: LibraryView, historial: HistoryView, reservas: ReservationsView,
  garaje: GarageView,
};

const ADMIN_VIEWS = {
  'admin-dashboard': 'renderDashboard',
  'admin-estaciones': 'renderStations',
  'admin-reservas': 'renderReservations',
  'admin-usuarios': 'renderUsers',
  'admin-auditoria': 'renderAudit',
};

// --- Modal genérico reutilizado por las vistas ---
const Modal = {
  open({ title, body, actions = [] }) {
    this.close();
    const overlay = el('div', { class: 'modal-overlay', id: 'modal-overlay' });
    const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    dialog.appendChild(el('div', { class: 'modal__header' }, [
      el('h2', {}, title),
      el('button', { class: 'btn btn--icon', 'aria-label': 'Cerrar ventana', onclick: () => this.close() }, icon('x')),
    ]));
    dialog.appendChild(el('div', { class: 'modal__body' }, body));
    if (actions.length) {
      dialog.appendChild(el('div', { class: 'modal__actions' }, actions.map(a =>
        el('button', { class: `btn btn--${a.variant || 'ghost'}`, onclick: a.onClick }, a.label)
      )));
    }
    overlay.appendChild(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
    overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    document.body.appendChild(overlay);
    dialog.querySelector('button')?.focus();
  },
  confirm({ title, message, onConfirm }) {
    this.open({
      title,
      body: el('p', {}, message),
      actions: [
        { label: 'Cancelar', variant: 'ghost', onClick: () => this.close() },
        { label: 'Eliminar', variant: 'danger', onClick: () => { onConfirm(); this.close(); } },
      ],
    });
  },
  close() {
    const overlay = $('#modal-overlay');
    if (overlay) overlay.remove();
  },
};

// --- Raíz de la aplicación ---
function renderRoot() {
  const root = $('#root');
  clear(root);
  const user = currentUser();
  if (user?.role === ROLES.ADMIN && !ADMIN_VIEWS[state.ui.tab]) state.ui.tab = 'admin-dashboard';
  if (!user) root.appendChild(renderAuth());
  else root.appendChild(renderShell(user));
  renderToast();
}

function renderToast() {
  const existing = $('#toast'); if (existing) existing.remove();
  if (!state.ui.toast) return;
  const t = el('div', { id: 'toast', class: `toast toast--${state.ui.toast.tone}`, role: 'status', 'aria-live': 'polite' }, state.ui.toast.message);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
}

// --- Autenticación local ---
function renderAuth() {
  const wrap = el('div', { class: 'auth-layout' });
  const panel = el('div', { class: 'auth-layout__panel' }, [
    el('div', { class: 'auth-layout__logo' }, [icon('bolt'), el('span', {}, APP_NAME)]),
    el('h2', {}, 'Carga eléctrica, sin adivinar.'),
    el('p', {}, 'Encuentra electrolineras cercanas, revisa sus conectores y su disponibilidad antes de salir.'),
    el('p', { class: 'muted small' }, 'Gestiona tus cargas, reservas y estaciones desde un solo lugar.'),
  ]);
  const content = el('div', { class: 'auth-layout__content' });
  content.appendChild(state.ui.authMode === 'login' ? loginForm() : registerForm());
  wrap.append(panel, content);
  return wrap;
}

function loginForm() {
  const card = el('div', { class: 'auth-card' });
  card.appendChild(el('h1', {}, 'Inicia sesión'));
  card.appendChild(el('p', { class: 'muted' }, 'Entra a tu cuenta para ver tu historial de carga y tus electrolineras favoritas.'));

  const form = el('form', { class: 'form' });
  const email = el('input', { type: 'email', name: 'email', required: true, placeholder: 'tu@correo.com' });
  const password = el('input', { type: 'password', name: 'password', required: true, placeholder: '••••••••' });
  const remember = el('input', { type: 'checkbox', name: 'remember', checked: 'checked' });
  const error = el('p', { class: 'form-error', style: 'display:none' });

  form.append(
    el('label', {}, ['Correo electrónico', email]),
    el('label', {}, ['Contraseña', password]),
    el('label', { class: 'checkbox-label' }, [remember, ' Recordarme']),
    error,
    el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Iniciar sesión'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    error.style.display = 'none';
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    SupabaseAPI.signIn(email.value.trim(), password.value)
      .then(() => hydrateRemoteState())
      .then(() => setUI({ tab: isAdmin() ? 'admin-dashboard' : 'hoy' }))
      .catch(err => { error.textContent = err.message; error.style.display = 'block'; })
      .finally(() => { submit.disabled = false; });
  });
  card.appendChild(form);

  card.appendChild(el('p', { class: 'auth-switch' }, [
    '¿No tienes cuenta? ',
    el('button', { class: 'link-btn', onclick: () => setUI({ authMode: 'register' }) }, 'Regístrate'),
  ]));
  return card;
}

function registerForm() {
  const card = el('div', { class: 'auth-card' });
  card.appendChild(el('h1', {}, 'Crea tu cuenta'));
  card.appendChild(el('p', { class: 'muted' }, 'Regístrate con tu correo y cuéntanos qué vehículo eléctrico conduces.'));

  const form = el('form', { class: 'form' });
  const name = el('input', { name: 'name', required: true, placeholder: 'Tu nombre' });
  const email = el('input', { type: 'email', name: 'email', required: true, placeholder: 'tu@correo.com' });
  const password = el('input', { type: 'password', name: 'password', required: true, minlength: '8', placeholder: 'Mínimo 8 caracteres' });
  const vehicleModel = el('input', { name: 'model', placeholder: 'Ej. Renault Kwid E-Tech' });
  const terms = el('input', { type: 'checkbox', name: 'terms', required: true });
  const error = el('p', { class: 'form-error', style: 'display:none' });

  form.append(
    el('label', {}, ['Nombre completo', name]),
    el('label', {}, ['Correo electrónico', email]),
    el('label', {}, ['Contraseña', password]),
    el('label', {}, ['Vehículo eléctrico', vehicleModel]),
    el('label', { class: 'checkbox-label' }, [terms, ' Acepto los términos y condiciones']),
    error,
    el('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Crear cuenta gratis'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateEmail(email.value)) { error.textContent = 'Ingresa un correo válido.'; error.style.display = 'block'; return; }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    SupabaseAPI.signUp({ name: name.value.trim(), email: email.value.trim(), password: password.value })
      .then(payload => payload.access_token ? hydrateRemoteState() : Promise.reject(new Error('Revisa tu correo para confirmar la cuenta y luego inicia sesión.')))
      .then(() => setUI({ tab: 'hoy' }))
      .catch(err => { error.textContent = err.message; error.style.display = 'block'; })
      .finally(() => { submit.disabled = false; });
  });
  card.appendChild(form);

  card.appendChild(el('p', { class: 'auth-switch' }, [
    '¿Ya tienes cuenta? ',
    el('button', { class: 'link-btn', onclick: () => setUI({ authMode: 'login' }) }, 'Inicia sesión'),
  ]));
  return card;
}

// --- Shell principal ---
function renderShell(user) {
  const accent = user.preferences?.accent || 'blue';
  const shell = el('div', { class: `app-shell app-shell--${accent}` });
  const main = el('main', { class: 'app-shell__main' });
  main.appendChild(renderTopbar(user));
  const viewContainer = el('div', { id: 'view-container', class: 'view-container' });
  main.appendChild(viewContainer);
  shell.appendChild(main);

  renderActiveView(viewContainer);
  return shell;
}

function renderNavigation(user) {
  const tabs = isAdmin() ? ADMIN_TABS : TABS;
  const nav = el('nav', { class: 'app-shell__nav', 'aria-label': 'Aplicación' },
    el('ul', {}, tabs.map(t => el('li', {}, [
      el('button', {
        class: `nav-link ${state.ui.tab === t.id ? 'is-active' : ''}`,
        onclick: () => { if (state.ui.tab === '__charging__') ChargingView.reset(); setUI({ tab: t.id, chargingStationId: null }); },
      }, [el('span', { html: ICONS[t.icon] }), t.label]),
    ])))
  );
  return nav;
}

function renderTopbar(user) {
  const tabCatalog = isAdmin() ? ADMIN_TABS : TABS;
  const currentTab = tabCatalog.find(tab => tab.id === state.ui.tab);
  return el('header', { class: 'app-shell__topbar' }, [
    el('div', { class: 'app-shell__brand' }, [el('div', { class: 'app-shell__logo' }, [icon('bolt'), el('span', {}, APP_NAME)]), el('span', { class: 'app-shell__brand-plan' }, user.plan)]),
    renderNavigation(user),
    el('div', { class: 'app-shell__topbar-context' }, [
      el('span', { class: 'topbar-context__section' }, currentTab ? currentTab.label : 'Mi cuenta'),
      el('span', { class: 'topbar-context__status' }, [el('span', { class: 'live-dot' }), 'Red operativa']),
    ]),
    el('button', { class: 'topbar-notifications', 'aria-label': 'Ver notificaciones', onclick: openNotifications }, [icon('bell'), unreadNotifications().length ? el('span', { class: 'notification-count' }, String(unreadNotifications().length)) : null]),
    el('button', { class: 'btn btn--ghost btn--small app-shell__logout', onclick: logout }, [icon('logout'), ' Salir']),
  ]);
}

function renderActiveView(container) {
  if (isAdmin() && ADMIN_VIEWS[state.ui.tab]) {
    AdminView[ADMIN_VIEWS[state.ui.tab]](container);
    container.classList.remove('view-container--enter');
    void container.offsetWidth;
    container.classList.add('view-container--enter');
    return;
  }
  if (state.ui.tab === '__charging__') {
    ChargingView.render(container);
    container.classList.remove('view-container--enter');
    void container.offsetWidth;
    container.classList.add('view-container--enter');
    return;
  }
  const view = VIEWS[state.ui.tab] || TodayView;
  view.render(container);
  // Reinicia la animación al cambiar de pestaña o al actualizar datos en vivo.
  container.classList.remove('view-container--enter');
  void container.offsetWidth;
  container.classList.add('view-container--enter');
}

function logout() {
  ChargingView.reset();
  SupabaseAPI.signOut().finally(() => { state.data = emptyRemoteState(); setUI({ tab: 'hoy', authMode: 'login' }); });
}

async function hydrateRemoteState() {
  state.data = await Storage.load();
  state.ui.lastSync = new Date();
  renderRoot();
}

// --- Arranque ---
document.addEventListener('DOMContentLoaded', () => {
  init().then(() => {
    subscribe(renderRoot);
    renderRoot();
  }).catch(error => {
    const root = $('#root');
    clear(root);
    root.appendChild(el('div', { class: 'empty-state card app-error' }, [el('h1', {}, 'No se pudo conectar'), el('p', { class: 'muted' }, error.message), el('button', { class: 'btn btn--primary', onclick: () => window.location.reload() }, 'Reintentar')]));
  });
});

function openNotifications() {
  const notifications = state.data.notifications || [];
  const body = el('div', { class: 'notification-list' }, notifications.length ? notifications.map(notification => el('button', { class: `notification-item ${notification.read ? '' : 'is-unread'}`, onclick: () => { markNotificationsRead(); Modal.close(); } }, [
    el('span', { class: `notification-item__dot notification-item__dot--${notification.tone || 'ink'}` }),
    el('span', {}, [el('strong', {}, notification.title), el('small', { class: 'muted' }, `${notification.message} · ${formatDate(notification.date)}`)]),
  ])) : [el('p', { class: 'muted' }, 'No tienes notificaciones nuevas.')]);
  Modal.open({ title: 'Notificaciones', body, actions: [{ label: 'Marcar todas como leídas', variant: 'primary', onClick: () => { markNotificationsRead(); Modal.close(); } }] });
}

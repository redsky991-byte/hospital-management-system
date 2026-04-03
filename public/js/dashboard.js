const WIDGET_DEFS = [
  { id: 'w-patients',   label: 'widget_patients',        default: true },
  { id: 'w-appts',      label: 'widget_appointments',    default: true },
  { id: 'w-bills',      label: 'widget_bills',           default: true },
  { id: 'w-users',      label: 'widget_users',           default: true },
  { id: 'w-appt-table', label: 'widget_appt_table',      default: true },
  { id: 'w-chart',      label: 'widget_chart',           default: true },
  { id: 'w-quick',      label: 'widget_quick_actions',   default: true }
];

function getWidgetPrefs() {
  try { return JSON.parse(localStorage.getItem('hms_dashboard_widgets') || 'null') || null; } catch { return null; }
}

function saveWidgetPrefs(prefs) {
  localStorage.setItem('hms_dashboard_widgets', JSON.stringify(prefs));
}

function applyWidgetPrefs() {
  const prefs = getWidgetPrefs();
  if (!prefs) return;
  WIDGET_DEFS.forEach(w => {
    const el = document.getElementById(w.id);
    if (!el) return;
    const visible = prefs[w.id] !== false;
    el.classList.toggle('widget-hidden', !visible);
  });
}

function openCustomizePanel() {
  const prefs = getWidgetPrefs() || {};
  const overlay = document.createElement('div');
  overlay.id = 'customize-overlay';
  overlay.innerHTML = `
    <div id="customize-panel">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0"><i class="fas fa-sliders-h me-2 text-primary"></i>${t('customize_dashboard')}</h6>
        <button class="btn-close" onclick="closeCustomizePanel()"></button>
      </div>
      ${WIDGET_DEFS.map(w => {
        const visible = prefs[w.id] !== false;
        return `<div class="widget-toggle-row">
          <span>${t(w.label) || w.label}</span>
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" id="chk-${w.id}"${visible ? ' checked' : ''}>
          </div>
        </div>`;
      }).join('')}
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-primary btn-sm flex-fill" onclick="saveCustomize()">
          <i class="fas fa-save me-1"></i>${t('save_layout')}
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick="resetWidgets()">
          <i class="fas fa-undo me-1"></i>${t('restore_defaults')}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCustomizePanel(); });
}

function closeCustomizePanel() {
  const overlay = document.getElementById('customize-overlay');
  if (overlay) overlay.remove();
}

function saveCustomize() {
  const prefs = {};
  WIDGET_DEFS.forEach(w => {
    const chk = document.getElementById('chk-' + w.id);
    prefs[w.id] = chk ? chk.checked : true;
  });
  saveWidgetPrefs(prefs);
  applyWidgetPrefs();
  closeCustomizePanel();
}

function resetWidgets() {
  localStorage.removeItem('hms_dashboard_widgets');
  WIDGET_DEFS.forEach(w => {
    const el = document.getElementById(w.id);
    if (el) el.classList.remove('widget-hidden');
  });
  closeCustomizePanel();
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  window._activeNav = 'dashboard';
  renderNav('dashboard');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  applyWidgetPrefs();

  try {
    const [patients, appointments, billing, users] = await Promise.all([
      apiGet('/patients', { limit: 1 }),
      apiGet('/appointments/today'),
      apiGet('/billing', { status: 'draft', limit: 1 }),
      user.role === 'admin' ? apiGet('/users') : Promise.resolve([])
    ]);

    document.getElementById('stat-patients').textContent = patients.total || 0;
    document.getElementById('stat-appointments').textContent = Array.isArray(appointments) ? appointments.length : 0;
    document.getElementById('stat-bills').textContent = billing.total || 0;
    const usersEl = document.getElementById('stat-users');
    if (usersEl) usersEl.textContent = Array.isArray(users) ? users.length : '-';

    const tbody = document.getElementById('recent-appointments');
    if (tbody && Array.isArray(appointments)) {
      tbody.innerHTML = appointments.slice(0, 10).map(a => `
        <tr>
          <td>${a.patient_name || 'N/A'}</td>
          <td>${a.doctor_name || 'N/A'}</td>
          <td>${a.department_name || 'N/A'}</td>
          <td>${a.appointment_time}</td>
          <td><span class="badge bg-${a.status==='scheduled'?'primary':a.status==='completed'?'success':'danger'}">${t(a.status) || a.status}</span></td>
        </tr>`).join('') || `<tr><td colspan="5" class="text-center text-muted">${t('no_appointments')}</td></tr>`;
    }

    // Chart
    const ctx = document.getElementById('apptChart');
    if (ctx && typeof Chart !== 'undefined') {
      const allAppts = await apiGet('/appointments', { limit: 100 });
      const statuses = { scheduled: 0, completed: 0, cancelled: 0 };
      (allAppts.appointments || []).forEach(a => { if (statuses[a.status] !== undefined) statuses[a.status]++; });
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: [t('scheduled'), t('completed'), t('cancelled')],
          datasets: [{ data: [statuses.scheduled, statuses.completed, statuses.cancelled], backgroundColor: ['#1a73e8','#28a745','#dc3545'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
});

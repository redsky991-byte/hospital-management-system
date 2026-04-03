window._activeNav = 'audit';

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (user.role !== 'admin') { window.location.href = '/dashboard.html'; return; }
  renderNav('audit');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await loadAuditLogs();
  document.getElementById('filter-btn')?.addEventListener('click', loadAuditLogs);
});

async function loadAuditLogs() {
  try {
    const from_date = document.getElementById('filter-from')?.value;
    const to_date = document.getElementById('filter-to')?.value;
    const module_filter = document.getElementById('filter-module')?.value;
    const action_filter = document.getElementById('filter-action')?.value;
    const params = { limit: 100 };
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    if (module_filter) params.module = module_filter;
    if (action_filter) params.action = action_filter;
    const data = await apiGet('/audit', params);
    const actionColors = { CREATE: 'success', UPDATE: 'warning', DELETE: 'danger', PATCH: 'info' };
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = (data.logs || []).map(l => `
      <tr>
        <td>${new Date(l.created_at).toLocaleString()}</td>
        <td>${l.user_name || 'System'}</td>
        <td><span class="badge bg-${actionColors[l.action] || 'secondary'}">${l.action || '-'}</span></td>
        <td>${l.module || '-'}</td>
        <td>${l.record_id || '-'}</td>
        <td>${l.ip_address || '-'}</td>
      </tr>`).join('') || `<tr><td colspan="6" class="text-center text-muted">${t('no_data')}</td></tr>`;
  } catch (e) { console.error(e); }
}

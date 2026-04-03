let userEditId = null;
window._activeNav = 'users';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (user.role !== 'admin') { window.location.href = '/dashboard.html'; return; }
  renderNav('users');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await loadSitesForUsers();
  await loadUsers();
  document.getElementById('save-user-btn')?.addEventListener('click', saveUser);
});

async function loadSitesForUsers() {
  try {
    const sites = await apiGet('/settings/sites');
    const sel = document.getElementById('user-site');
    if (sel) sel.innerHTML = `<option value="">-- ${t('site')} --</option>` + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch (e) {}
}

async function loadUsers() {
  try {
    const users = await apiGet('/users');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${escHtml(u.name)}</td>
        <td>${escHtml(u.email)}</td>
        <td><span class="badge bg-${u.role==='admin'?'danger':u.role==='doctor'?'primary':'info'}">${escHtml(u.role)}</span></td>
        <td>${escHtml(u.site_name || '-')}</td>
        <td><span class="badge bg-${u.is_active?'success':'secondary'}">${u.is_active ? t('active') : t('inactive')}</span></td>
        <td><span class="last-login-badge">${u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '-'}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="editUser('${u.id}')" title="${t('edit')}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-${u.is_active ? 'secondary' : 'success'} me-1" onclick="toggleActive('${u.id}', ${u.is_active ? 1 : 0})" title="${u.is_active ? t('deactivate') : t('activate')}">
            <i class="fas fa-${u.is_active ? 'ban' : 'check'}"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')" title="${t('delete')}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || `<tr><td colspan="7" class="text-center text-muted">${t('no_data')}</td></tr>`;
  } catch (e) { console.error(e); }
}

function openAddUser() {
  userEditId = null;
  document.getElementById('user-modal-title').textContent = t('add_new_user');
  document.getElementById('user-form').reset();
  document.getElementById('user-password-group').style.display = 'block';
  new bootstrap.Modal(document.getElementById('userModal')).show();
}

async function editUser(id) {
  try {
    const u = await apiGet('/users/' + id);
    userEditId = id;
    document.getElementById('user-modal-title').textContent = t('edit_user');
    document.getElementById('user-name').value = u.name;
    document.getElementById('user-email').value = u.email;
    document.getElementById('user-role').value = u.role;
    document.getElementById('user-site').value = u.site_id || '';
    document.getElementById('user-active').checked = !!u.is_active;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password-group').style.display = 'block';
    new bootstrap.Modal(document.getElementById('userModal')).show();
  } catch (e) { alert(t('error') + ' loading user'); }
}

async function toggleActive(id, currentActive) {
  try {
    await apiPut('/users/' + id, { is_active: currentActive ? 0 : 1 });
    loadUsers();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function saveUser() {
  const data = {
    name: document.getElementById('user-name').value,
    email: document.getElementById('user-email').value,
    role: document.getElementById('user-role').value,
    site_id: document.getElementById('user-site').value,
    is_active: document.getElementById('user-active').checked ? 1 : 0
  };
  const pwd = document.getElementById('user-password').value;
  if (pwd) data.password = pwd;
  if (!data.name || !data.email) { alert(t('user_name') + ' & ' + t('email') + ' ' + t('required_field')); return; }
  if (!userEditId && !pwd) { alert(t('password') + ' ' + t('required_field')); return; }
  try {
    if (userEditId) { await apiPut('/users/' + userEditId, data); }
    else { await apiPost('/users', data); }
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    loadUsers();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function deleteUser(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/users/' + id); loadUsers(); }
  catch (e) { alert(t('error') + ': ' + e.message); }
}

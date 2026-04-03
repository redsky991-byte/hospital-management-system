let userEditId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (user.role !== 'admin') { window.location.href = '/dashboard.html'; return; }
  renderNav('users');
  renderUserInfo();
  await loadSitesForUsers();
  await loadUsers();
  document.getElementById('save-user-btn')?.addEventListener('click', saveUser);
});

async function loadSitesForUsers() {
  try {
    const sites = await apiGet('/settings/sites');
    const sel = document.getElementById('user-site');
    if (sel) sel.innerHTML = '<option value="">Select Site</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch (e) {}
}

async function loadUsers() {
  try {
    const users = await apiGet('/users');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td><span class="badge bg-${u.role==='admin'?'danger':u.role==='doctor'?'primary':'info'}">${u.role}</span></td>
        <td>${u.site_name || '-'}</td>
        <td><span class="badge bg-${u.is_active?'success':'secondary'}">${u.is_active?'Active':'Inactive'}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
  } catch (e) { console.error(e); }
}

function openAddUser() {
  userEditId = null;
  document.getElementById('user-modal-title').textContent = 'Add New User';
  document.getElementById('user-form').reset();
  document.getElementById('user-password-group').style.display = 'block';
  new bootstrap.Modal(document.getElementById('userModal')).show();
}

async function editUser(id) {
  try {
    const u = await apiGet('/users/' + id);
    userEditId = id;
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('user-name').value = u.name;
    document.getElementById('user-email').value = u.email;
    document.getElementById('user-role').value = u.role;
    document.getElementById('user-site').value = u.site_id || '';
    document.getElementById('user-active').checked = !!u.is_active;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password-group').style.display = 'block';
    new bootstrap.Modal(document.getElementById('userModal')).show();
  } catch (e) { alert('Error loading user'); }
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
  if (!data.name || !data.email) { alert('Name and email are required'); return; }
  if (!userEditId && !pwd) { alert('Password is required for new users'); return; }
  try {
    if (userEditId) { await apiPut('/users/' + userEditId, data); }
    else { await apiPost('/users', data); }
    bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    loadUsers();
  } catch (e) { alert('Error: ' + e.message); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try { await apiDelete('/users/' + id); loadUsers(); }
  catch (e) { alert('Error: ' + e.message); }
}

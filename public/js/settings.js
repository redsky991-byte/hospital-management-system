document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (user.role !== 'admin') { window.location.href = '/dashboard.html'; return; }
  renderNav('settings');
  renderUserInfo();
  await Promise.all([loadSites(), loadWards(), loadDepartments()]);
  document.getElementById('save-site-btn')?.addEventListener('click', saveSite);
  document.getElementById('save-ward-btn')?.addEventListener('click', saveWard);
  document.getElementById('save-dept-btn')?.addEventListener('click', saveDept);
});

let siteEditId = null, wardEditId = null, deptEditId = null;

async function loadSites() {
  const sites = await apiGet('/settings/sites');
  const tbody = document.getElementById('sites-tbody');
  if (tbody) tbody.innerHTML = sites.map(s => `
    <tr>
      <td>${s.name}</td><td>${s.address || '-'}</td><td>${s.phone || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="editSite('${s.id}','${s.name}','${s.address||''}','${s.phone||''}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteSite('${s.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
  const wardSiteSel = document.getElementById('ward-site');
  const deptSiteSel = document.getElementById('dept-site');
  if (wardSiteSel) wardSiteSel.innerHTML = '<option value="">Select Site</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (deptSiteSel) deptSiteSel.innerHTML = '<option value="">Select Site</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function openAddSite() { siteEditId = null; document.getElementById('site-form').reset(); new bootstrap.Modal(document.getElementById('siteModal')).show(); }
function editSite(id, name, address, phone) {
  siteEditId = id;
  document.getElementById('site-name').value = name;
  document.getElementById('site-address').value = address;
  document.getElementById('site-phone').value = phone;
  new bootstrap.Modal(document.getElementById('siteModal')).show();
}
async function saveSite() {
  const data = { name: document.getElementById('site-name').value, address: document.getElementById('site-address').value, phone: document.getElementById('site-phone').value };
  if (!data.name) { alert('Site name required'); return; }
  try {
    if (siteEditId) { await apiPut('/settings/sites/' + siteEditId, data); } else { await apiPost('/settings/sites', data); }
    bootstrap.Modal.getInstance(document.getElementById('siteModal')).hide();
    loadSites();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteSite(id) {
  if (!confirm('Delete this site?')) return;
  try { await apiDelete('/settings/sites/' + id); loadSites(); } catch (e) { alert('Error: ' + e.message); }
}

async function loadWards() {
  const wards = await apiGet('/settings/wards');
  const tbody = document.getElementById('wards-tbody');
  if (tbody) tbody.innerHTML = wards.map(w => `
    <tr>
      <td>${w.name}</td><td>${w.site_name || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="editWard('${w.id}','${w.name}','${w.site_id||''}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteWard('${w.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
}
function openAddWard() { wardEditId = null; document.getElementById('ward-form').reset(); new bootstrap.Modal(document.getElementById('wardModal')).show(); }
function editWard(id, name, site_id) {
  wardEditId = id;
  document.getElementById('ward-name').value = name;
  document.getElementById('ward-site').value = site_id;
  new bootstrap.Modal(document.getElementById('wardModal')).show();
}
async function saveWard() {
  const data = { name: document.getElementById('ward-name').value, site_id: document.getElementById('ward-site').value };
  if (!data.name) { alert('Ward name required'); return; }
  try {
    if (wardEditId) { await apiPut('/settings/wards/' + wardEditId, data); } else { await apiPost('/settings/wards', data); }
    bootstrap.Modal.getInstance(document.getElementById('wardModal')).hide();
    loadWards();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteWard(id) {
  if (!confirm('Delete this ward?')) return;
  try { await apiDelete('/settings/wards/' + id); loadWards(); } catch (e) { alert('Error: ' + e.message); }
}

async function loadDepartments() {
  const depts = await apiGet('/settings/departments');
  const tbody = document.getElementById('depts-tbody');
  if (tbody) tbody.innerHTML = depts.map(d => `
    <tr>
      <td>${d.name}</td><td>${d.site_name || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline-warning me-1" onclick="editDept('${d.id}','${d.name}','${d.site_id||''}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteDept('${d.id}')"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`).join('');
}
function openAddDept() { deptEditId = null; document.getElementById('dept-form').reset(); new bootstrap.Modal(document.getElementById('deptModal')).show(); }
function editDept(id, name, site_id) {
  deptEditId = id;
  document.getElementById('dept-name').value = name;
  document.getElementById('dept-site').value = site_id;
  new bootstrap.Modal(document.getElementById('deptModal')).show();
}
async function saveDept() {
  const data = { name: document.getElementById('dept-name').value, site_id: document.getElementById('dept-site').value };
  if (!data.name) { alert('Department name required'); return; }
  try {
    if (deptEditId) { await apiPut('/settings/departments/' + deptEditId, data); } else { await apiPost('/settings/departments', data); }
    bootstrap.Modal.getInstance(document.getElementById('deptModal')).hide();
    loadDepartments();
  } catch (e) { alert('Error: ' + e.message); }
}
async function deleteDept(id) {
  if (!confirm('Delete this department?')) return;
  try { await apiDelete('/settings/departments/' + id); loadDepartments(); } catch (e) { alert('Error: ' + e.message); }
}

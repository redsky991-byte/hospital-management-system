window._activeNav = 'settings';
let siteEditId = null, wardEditId = null, deptEditId = null;
let restoreFileData = null;

// HTML entity encoder — safe for content AND attribute values
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
  renderNav('settings');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await Promise.all([loadSites(), loadWards(), loadDepartments()]);
  initLanguageTab();
  document.getElementById('save-site-btn')?.addEventListener('click', saveSite);
  document.getElementById('save-ward-btn')?.addEventListener('click', saveWard);
  document.getElementById('save-dept-btn')?.addEventListener('click', saveDept);

  // Drag-and-drop for restore zone
  const dz = document.getElementById('restore-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-active'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-active');
      const file = e.dataTransfer.files[0];
      if (file) processRestoreFile(file);
    });
  }
});

// ====== LANGUAGE / CURRENCY TAB ======
async function initLanguageTab() {
  const langSel = document.getElementById('sys-language');
  if (langSel && typeof LANGUAGE_NAMES !== 'undefined') {
    langSel.innerHTML = Object.entries(LANGUAGE_NAMES).map(([code, name]) =>
      `<option value="${escHtml(code)}">${escHtml(name)}</option>`
    ).join('');
  }
  const currSel = document.getElementById('sys-currency');
  if (currSel && typeof CURRENCIES !== 'undefined') {
    currSel.innerHTML = Object.values(CURRENCIES).map(c =>
      `<option value="${escHtml(c.code)}">${escHtml(c.code)} – ${escHtml(c.symbol)} ${escHtml(c.name)}</option>`
    ).join('');
  }
  try {
    const sys = await apiGet('/settings/system');
    if (langSel && sys.language) langSel.value = sys.language;
    if (currSel && sys.currency) currSel.value = sys.currency;
    if (sys.language && typeof setLang === 'function') {
      localStorage.setItem('hms_language', sys.language);
      setLang(sys.language);
    }
    if (sys.currency && typeof setCurrency === 'function') {
      setCurrency(sys.currency);
    }
  } catch (e) {
    if (langSel && typeof getLang === 'function') langSel.value = getLang();
    if (currSel && typeof getCurrency === 'function') currSel.value = getCurrency();
  }
}

async function saveLanguageSettings() {
  const lang = document.getElementById('sys-language')?.value;
  const currency = document.getElementById('sys-currency')?.value;
  try {
    await apiPut('/settings/system', { language: lang, currency });
    if (lang && typeof setLang === 'function') setLang(lang);
    if (currency && typeof setCurrency === 'function') {
      setCurrency(currency);
      const topCurr = document.getElementById('topbar-currency');
      if (topCurr) topCurr.value = currency;
    }
    const msg = document.getElementById('lang-save-msg');
    if (msg) {
      msg.classList.remove('d-none');
      msg.textContent = t('success') + '! ' + t('language') + ' & ' + t('currency') + ' saved.';
      setTimeout(() => msg.classList.add('d-none'), 3000);
    }
  } catch (e) {
    alert(t('error') + ': ' + e.message);
  }
}

// ====== BACKUP / RESTORE ======
async function downloadBackup() {
  try {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/settings/backup', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Backup failed');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `hospital-backup-${date}.db`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const el = document.getElementById('last-backup-time');
    if (el) el.textContent = new Date().toLocaleString();
  } catch (e) {
    alert(t('error') + ': ' + e.message);
  }
}

function handleRestoreFile(input) {
  const file = input.files[0];
  if (file) processRestoreFile(file);
}

function processRestoreFile(file) {
  if (!file.name.endsWith('.db')) {
    alert('Please select a .db file');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    restoreFileData = e.target.result.split(',')[1]; // base64 part
    const nameEl = document.getElementById('restore-file-name');
    if (nameEl) {
      nameEl.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
      nameEl.classList.remove('d-none');
    }
    const btn = document.getElementById('restore-btn');
    if (btn) btn.removeAttribute('disabled');
  };
  reader.readAsDataURL(file);
}

async function restoreDatabase() {
  if (!restoreFileData) { alert(t('choose_file')); return; }
  if (!confirm(t('restore_warning') + '\n\n' + t('confirm_delete'))) return;
  const msg = document.getElementById('restore-msg');
  try {
    const result = await apiPost('/settings/restore', { data: restoreFileData });
    if (msg) {
      msg.className = 'mt-2 alert alert-success py-2 small';
      msg.textContent = result.message;
      msg.classList.remove('d-none');
    }
    restoreFileData = null;
    document.getElementById('restore-btn').setAttribute('disabled', '');
    document.getElementById('restore-file-name').classList.add('d-none');
    document.getElementById('restore-file').value = '';
  } catch (e) {
    if (msg) {
      msg.className = 'mt-2 alert alert-danger py-2 small';
      msg.textContent = t('error') + ': ' + e.message;
      msg.classList.remove('d-none');
    }
  }
}

// ====== SITES ======
async function loadSites() {
  const sites = await apiGet('/settings/sites');
  const tbody = document.getElementById('sites-tbody');
  if (tbody) {
    // Use data-* attributes instead of inline onclick to avoid HTML-entity decode XSS
    tbody.innerHTML = sites.map(s => `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.address || '-')}</td>
        <td>${escHtml(s.phone || '-')}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1 js-edit-site" data-id="${escHtml(s.id)}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger js-delete-site" data-id="${escHtml(s.id)}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">${t('no_data')}</td></tr>`;

    // Use a Map for O(1) lookup inside event listeners (avoids repeated .find())
    const siteMap = new Map(sites.map(s => [s.id, s]));
    tbody.querySelectorAll('.js-edit-site').forEach(btn => {
      const site = siteMap.get(btn.dataset.id);
      if (site) btn.addEventListener('click', () => editSite(site.id, site.name, site.address || '', site.phone || ''));
    });
    tbody.querySelectorAll('.js-delete-site').forEach(btn => {
      btn.addEventListener('click', () => deleteSite(btn.dataset.id));
    });
  }
  const wardSiteSel = document.getElementById('ward-site');
  const deptSiteSel = document.getElementById('dept-site');
  const opt = `<option value="">-- ${t('site')} --</option>` + sites.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`).join('');
  if (wardSiteSel) wardSiteSel.innerHTML = opt;
  if (deptSiteSel) deptSiteSel.innerHTML = opt;
}

function openAddSite() { siteEditId = null; document.getElementById('site-form').reset(); new bootstrap.Modal(document.getElementById('siteModal')).show(); }
function editSite(id, name, address, phone) {
  siteEditId = id;
  document.getElementById('site-name-input').value = name;
  document.getElementById('site-address').value = address;
  document.getElementById('site-phone').value = phone;
  new bootstrap.Modal(document.getElementById('siteModal')).show();
}
async function saveSite() {
  const data = { name: document.getElementById('site-name-input').value, address: document.getElementById('site-address').value, phone: document.getElementById('site-phone').value };
  if (!data.name) { alert(t('site_name') + ' ' + t('required_field')); return; }
  try {
    if (siteEditId) { await apiPut('/settings/sites/' + siteEditId, data); } else { await apiPost('/settings/sites', data); }
    bootstrap.Modal.getInstance(document.getElementById('siteModal')).hide();
    loadSites();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}
async function deleteSite(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/settings/sites/' + id); loadSites(); } catch (e) { alert(t('error') + ': ' + e.message); }
}

// ====== WARDS ======
async function loadWards() {
  const wards = await apiGet('/settings/wards');
  const tbody = document.getElementById('wards-tbody');
  if (tbody) {
    tbody.innerHTML = wards.map(w => `
      <tr>
        <td>${escHtml(w.name)}</td>
        <td>${escHtml(w.site_name || '-')}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1 js-edit-ward" data-id="${escHtml(w.id)}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger js-delete-ward" data-id="${escHtml(w.id)}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || `<tr><td colspan="3" class="text-center text-muted">${t('no_data')}</td></tr>`;

    // Use a Map for O(1) lookup inside event listeners
    const wardMap = new Map(wards.map(w => [w.id, w]));
    tbody.querySelectorAll('.js-edit-ward').forEach(btn => {
      const ward = wardMap.get(btn.dataset.id);
      if (ward) btn.addEventListener('click', () => editWard(ward.id, ward.name, ward.site_id || ''));
    });
    tbody.querySelectorAll('.js-delete-ward').forEach(btn => {
      btn.addEventListener('click', () => deleteWard(btn.dataset.id));
    });
  }
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
  if (!data.name) { alert(t('ward') + ' ' + t('required_field')); return; }
  try {
    if (wardEditId) { await apiPut('/settings/wards/' + wardEditId, data); } else { await apiPost('/settings/wards', data); }
    bootstrap.Modal.getInstance(document.getElementById('wardModal')).hide();
    loadWards();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}
async function deleteWard(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/settings/wards/' + id); loadWards(); } catch (e) { alert(t('error') + ': ' + e.message); }
}

// ====== DEPARTMENTS ======
async function loadDepartments() {
  const depts = await apiGet('/settings/departments');
  const tbody = document.getElementById('depts-tbody');
  if (tbody) {
    tbody.innerHTML = depts.map(d => `
      <tr>
        <td>${escHtml(d.name)}</td>
        <td>${escHtml(d.site_name || '-')}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1 js-edit-dept" data-id="${escHtml(d.id)}"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger js-delete-dept" data-id="${escHtml(d.id)}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || `<tr><td colspan="3" class="text-center text-muted">${t('no_data')}</td></tr>`;

    // Use a Map for O(1) lookup inside event listeners
    const deptMap = new Map(depts.map(d => [d.id, d]));
    tbody.querySelectorAll('.js-edit-dept').forEach(btn => {
      const dept = deptMap.get(btn.dataset.id);
      if (dept) btn.addEventListener('click', () => editDept(dept.id, dept.name, dept.site_id || ''));
    });
    tbody.querySelectorAll('.js-delete-dept').forEach(btn => {
      btn.addEventListener('click', () => deleteDept(btn.dataset.id));
    });
  }
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
  if (!data.name) { alert(t('department') + ' ' + t('required_field')); return; }
  try {
    if (deptEditId) { await apiPut('/settings/departments/' + deptEditId, data); } else { await apiPost('/settings/departments', data); }
    bootstrap.Modal.getInstance(document.getElementById('deptModal')).hide();
    loadDepartments();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}
async function deleteDept(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/settings/departments/' + id); loadDepartments(); } catch (e) { alert(t('error') + ': ' + e.message); }
}

let currentPage = 1;
let editingId = null;

window._activeNav = 'patients';

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  renderNav('patients');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await loadSitesAndWards();
  await loadPatients();

  document.getElementById('search-input')?.addEventListener('input', debounce(() => { currentPage = 1; loadPatients(); }, 400));
  document.getElementById('save-patient-btn')?.addEventListener('click', savePatient);
});

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function loadSitesAndWards() {
  try {
    const [sites, wards] = await Promise.all([apiGet('/settings/sites'), apiGet('/settings/wards')]);
    const siteSelect = document.getElementById('patient-site');
    const wardSelect = document.getElementById('patient-ward');
    if (siteSelect) siteSelect.innerHTML = '<option value="">Select Site</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (wardSelect) wardSelect.innerHTML = '<option value="">Select Ward</option>' + wards.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function loadPatients() {
  try {
    const search = document.getElementById('search-input')?.value || '';
    const data = await apiGet('/patients', { search, page: currentPage, limit: 15 });
    const tbody = document.getElementById('patients-tbody');
    tbody.innerHTML = data.patients.map(p => `
      <tr>
        <td><span class="badge bg-secondary">${p.patient_number}</span></td>
        <td>${p.first_name} ${p.last_name}</td>
        <td>${p.gender || '-'}</td>
        <td>${p.date_of_birth || '-'}</td>
        <td>${p.phone || '-'}</td>
        <td>${p.blood_group || '-'}</td>
        <td>${p.site_name || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-info me-1" onclick="viewPatient('${p.id}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="editPatient('${p.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deletePatient('${p.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted">No patients found</td></tr>';
    renderPagination(data.total, data.limit, data.page, 'patients-pagination', (p) => { currentPage = p; loadPatients(); });
  } catch (e) { console.error(e); }
}

function renderPagination(total, limit, page, elId, cb) {
  const el = document.getElementById(elId);
  if (!el) return;
  const pages = Math.ceil(total / limit);
  el.innerHTML = Array.from({ length: pages }, (_, i) => `<li class="page-item${i+1===page?' active':''}"><a class="page-link" href="#" onclick="event.preventDefault();(${cb.toString()})(${i+1})">${i+1}</a></li>`).join('');
}

async function viewPatient(id) {
  try {
    const p = await apiGet('/patients/' + id);
    document.getElementById('view-content').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6"><strong>Patient #:</strong> ${p.patient_number}</div>
        <div class="col-md-6"><strong>Name:</strong> ${p.first_name} ${p.last_name}</div>
        <div class="col-md-6"><strong>DOB:</strong> ${p.date_of_birth || '-'}</div>
        <div class="col-md-6"><strong>Gender:</strong> ${p.gender || '-'}</div>
        <div class="col-md-6"><strong>Phone:</strong> ${p.phone || '-'}</div>
        <div class="col-md-6"><strong>Email:</strong> ${p.email || '-'}</div>
        <div class="col-md-6"><strong>Blood Group:</strong> ${p.blood_group || '-'}</div>
        <div class="col-md-6"><strong>Site:</strong> ${p.site_name || '-'}</div>
        <div class="col-md-6"><strong>Ward:</strong> ${p.ward_name || '-'}</div>
        <div class="col-12"><strong>Address:</strong> ${p.address || '-'}</div>
        <div class="col-12"><strong>Allergies:</strong> ${p.allergies || '-'}</div>
      </div>`;
    new bootstrap.Modal(document.getElementById('viewPatientModal')).show();
  } catch (e) { alert('Error loading patient'); }
}

async function editPatient(id) {
  try {
    const p = await apiGet('/patients/' + id);
    editingId = id;
    document.getElementById('modal-title').textContent = 'Edit Patient';
    ['first_name','last_name','date_of_birth','gender','phone','email','address','blood_group','allergies'].forEach(f => {
      const el = document.getElementById('patient-' + f.replace(/_/g, '-'));
      if (el) el.value = p[f] || '';
    });
    document.getElementById('patient-site').value = p.site_id || '';
    document.getElementById('patient-ward').value = p.ward_id || '';
    new bootstrap.Modal(document.getElementById('patientModal')).show();
  } catch (e) { alert('Error loading patient'); }
}

function openAddPatient() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add New Patient';
  document.getElementById('patient-form').reset();
  new bootstrap.Modal(document.getElementById('patientModal')).show();
}

async function savePatient() {
  const data = {
    first_name: document.getElementById('patient-first-name').value,
    last_name: document.getElementById('patient-last-name').value,
    date_of_birth: document.getElementById('patient-date-of-birth').value,
    gender: document.getElementById('patient-gender').value,
    phone: document.getElementById('patient-phone').value,
    email: document.getElementById('patient-email').value,
    address: document.getElementById('patient-address').value,
    blood_group: document.getElementById('patient-blood-group').value,
    allergies: document.getElementById('patient-allergies').value,
    site_id: document.getElementById('patient-site').value,
    ward_id: document.getElementById('patient-ward').value
  };
  if (!data.first_name || !data.last_name) { alert(t('first_name') + ' & ' + t('last_name') + ' ' + t('required_field')); return; }
  try {
    if (editingId) { await apiPut('/patients/' + editingId, data); }
    else { await apiPost('/patients', data); }
    bootstrap.Modal.getInstance(document.getElementById('patientModal')).hide();
    loadPatients();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function deletePatient(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/patients/' + id); loadPatients(); }
  catch (e) { alert(t('error') + ': ' + e.message); }
}

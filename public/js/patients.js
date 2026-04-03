let currentPage = 1;
let editingId = null;
let printCurrentPatientId = null;

window._activeNav = 'patients';

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  renderNav('patients');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await loadSitesAndWards();
  await loadPatients();

  document.getElementById('search-input')?.addEventListener('input', debounce(() => { currentPage = 1; loadPatients(); }, 400));
  document.getElementById('save-patient-btn')?.addEventListener('click', savePatient);
  document.getElementById('print-patient-btn')?.addEventListener('click', () => {
    if (printCurrentPatientId) printPatient(printCurrentPatientId);
  });

  // Event delegation for table action buttons
  document.getElementById('patients-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'view') viewPatient(id);
    else if (action === 'edit') editPatient(id);
    else if (action === 'print') printPatient(id);
    else if (action === 'delete') deletePatient(id);
  });
});

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function loadSitesAndWards() {
  try {
    const [sites, wards] = await Promise.all([apiGet('/settings/sites'), apiGet('/settings/wards')]);
    const siteSelect = document.getElementById('patient-site');
    const wardSelect = document.getElementById('patient-ward');
    if (siteSelect) siteSelect.innerHTML = '<option value="">Select Site</option>' + sites.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`).join('');
    if (wardSelect) wardSelect.innerHTML = '<option value="">Select Ward</option>' + wards.map(w => `<option value="${escHtml(w.id)}">${escHtml(w.name)}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function loadPatients() {
  try {
    const search = document.getElementById('search-input')?.value || '';
    const data = await apiGet('/patients', { search, page: currentPage, limit: 15 });
    const tbody = document.getElementById('patients-tbody');
    tbody.innerHTML = data.patients.map(p => `
      <tr>
        <td><span class="badge bg-secondary">${escHtml(p.patient_number)}</span></td>
        <td>${escHtml(p.first_name)} ${escHtml(p.last_name)}</td>
        <td>${escHtml(p.gender || '-')}</td>
        <td>${escHtml(p.date_of_birth || '-')}</td>
        <td>${escHtml(p.phone || '-')}</td>
        <td>${escHtml(p.blood_group || '-')}</td>
        <td>${escHtml(p.site_name || '-')}</td>
        <td>
          <button class="btn btn-sm btn-outline-info me-1" data-action="view" data-id="${escHtml(p.id)}" title="View"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-warning me-1" data-action="edit" data-id="${escHtml(p.id)}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-action="print" data-id="${escHtml(p.id)}" title="Print Card"><i class="fas fa-print"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${escHtml(p.id)}" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted py-4">No patients found</td></tr>';
    renderPagination(data.total, data.limit, data.page, 'patients-pagination', (p) => { currentPage = p; loadPatients(); });
  } catch (e) { console.error(e); }
}

function renderPagination(total, limit, page, elId, cb) {
  const el = document.getElementById(elId);
  if (!el) return;
  const pages = Math.ceil(total / limit);
  if (pages <= 1) { el.innerHTML = ''; return; }
  const prevDis = page === 1 ? ' disabled' : '';
  const nextDis = page === pages ? ' disabled' : '';
  el.innerHTML = `<li class="page-item${prevDis}"><a class="page-link" href="#" data-page="${page - 1}">«</a></li>` +
    Array.from({ length: pages }, (_, i) =>
      `<li class="page-item${i + 1 === page ? ' active' : ''}"><a class="page-link" href="#" data-page="${i + 1}">${i + 1}</a></li>`
    ).join('') +
    `<li class="page-item${nextDis}"><a class="page-link" href="#" data-page="${page + 1}">»</a></li>`;
  el.querySelectorAll('a.page-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const p = parseInt(a.dataset.page);
      if (p >= 1 && p <= pages) cb(p);
    });
  });
}

async function viewPatient(id) {
  try {
    printCurrentPatientId = id;
    const p = await apiGet('/patients/' + id);
    document.getElementById('view-content').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6"><strong>Patient #:</strong> <span class="badge bg-primary fs-6">${escHtml(p.patient_number)}</span></div>
        <div class="col-md-6"><strong>Name:</strong> ${escHtml(p.first_name)} ${escHtml(p.last_name)}</div>
        <div class="col-md-6"><strong>Date of Birth:</strong> ${escHtml(p.date_of_birth || '-')}</div>
        <div class="col-md-6"><strong>Gender:</strong> ${escHtml(p.gender || '-')}</div>
        <div class="col-md-6"><strong>Phone:</strong> ${escHtml(p.phone || '-')}</div>
        <div class="col-md-6"><strong>Email:</strong> ${escHtml(p.email || '-')}</div>
        <div class="col-md-6"><strong>Blood Group:</strong> <span class="badge bg-danger">${escHtml(p.blood_group || '-')}</span></div>
        <div class="col-md-6"><strong>Site:</strong> ${escHtml(p.site_name || '-')}</div>
        <div class="col-md-6"><strong>Ward:</strong> ${escHtml(p.ward_name || '-')}</div>
        <div class="col-12"><strong>Address:</strong> ${escHtml(p.address || '-')}</div>
        <div class="col-12"><strong>Allergies:</strong> <span class="text-danger">${escHtml(p.allergies || 'None')}</span></div>
        <div class="col-md-6"><strong>Registered:</strong> ${escHtml(p.created_at || '-')}</div>
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

async function printPatient(id) {
  try {
    const p = await apiGet('/patients/' + id);
    const w = window.open('', '_blank', 'width=800,height=700');
    w.document.write(`<!DOCTYPE html><html><head><title>Patient Card - ${escHtml(p.patient_number)}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .patient-id-box { border: 3px solid #0d6efd; border-radius: 8px; padding: 15px; text-align: center; }
        .patient-id-number { font-size: 2rem; font-weight: bold; color: #0d6efd; letter-spacing: 2px; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head><body>
      <div class="container">
        <div class="text-center border-bottom pb-3 mb-4">
          <h3>&#x1F3E5; MedCare Hospital Management System</h3>
          <h5 class="text-muted">Patient Registration Card</h5>
          <small class="text-muted">Printed: ${new Date().toLocaleString()}</small>
        </div>
        <div class="row">
          <div class="col-8">
            <table class="table table-bordered table-sm">
              <tr class="table-primary"><th colspan="2" class="text-center">Patient Information</th></tr>
              <tr><th width="35%">Patient ID</th><td><strong>${escHtml(p.patient_number)}</strong></td></tr>
              <tr><th>Full Name</th><td>${escHtml(p.first_name)} ${escHtml(p.last_name)}</td></tr>
              <tr><th>Date of Birth</th><td>${escHtml(p.date_of_birth || '—')}</td></tr>
              <tr><th>Gender</th><td>${escHtml(p.gender || '—')}</td></tr>
              <tr><th>Blood Group</th><td><strong>${escHtml(p.blood_group || '—')}</strong></td></tr>
              <tr><th>Phone</th><td>${escHtml(p.phone || '—')}</td></tr>
              <tr><th>Email</th><td>${escHtml(p.email || '—')}</td></tr>
              <tr><th>Address</th><td>${escHtml(p.address || '—')}</td></tr>
              <tr><th>Ward</th><td>${escHtml(p.ward_name || '—')}</td></tr>
              <tr><th>Site / Branch</th><td>${escHtml(p.site_name || '—')}</td></tr>
              <tr class="table-danger"><th>Allergies</th><td><strong>${escHtml(p.allergies || 'None')}</strong></td></tr>
              <tr><th>Registered On</th><td>${escHtml(p.created_at || '—')}</td></tr>
            </table>
          </div>
          <div class="col-4">
            <div class="patient-id-box mb-3">
              <div class="text-muted small mb-1">PATIENT CODE</div>
              <div class="patient-id-number">${escHtml(p.patient_number)}</div>
            </div>
            <div class="border rounded p-3 text-center">
              <div class="text-muted small">Blood Group</div>
              <div style="font-size:1.8rem;font-weight:bold;color:#dc3545">${escHtml(p.blood_group || '—')}</div>
            </div>
          </div>
        </div>
        <div class="no-print text-center mt-4">
          <button onclick="window.print()" class="btn btn-primary me-2"><i class="fas fa-print me-1"></i> Print</button>
          <button onclick="window.close()" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </body></html>`);
    w.document.close();
  } catch (e) { alert('Error printing patient: ' + e.message); }
}


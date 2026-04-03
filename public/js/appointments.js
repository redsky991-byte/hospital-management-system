let apptPage = 1;
let apptEditId = null;

window._activeNav = 'appointments';

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
  renderNav('appointments');
  renderUserInfo();
  setTimeout(syncTopbarSelectors, 50);
  await loadAppointmentOptions();
  await loadAppointments();

  document.getElementById('filter-date')?.addEventListener('change', () => { apptPage = 1; loadAppointments(); });
  document.getElementById('filter-status')?.addEventListener('change', () => { apptPage = 1; loadAppointments(); });
  document.getElementById('save-appt-btn')?.addEventListener('click', saveAppointment);

  // Show patient code badge when patient is selected
  document.getElementById('appt-patient')?.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    const badge = document.getElementById('appt-patient-code');
    if (badge) {
      const match = opt.text.match(/\(([^)]+)\)$/);
      badge.textContent = match ? 'Code: ' + match[1] : '';
      badge.style.display = match ? 'inline' : 'none';
    }
  });

  // Event delegation for table action buttons
  document.getElementById('appointments-tbody')?.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'view') viewAppointment(id);
    else if (action === 'edit') editAppointment(id);
    else if (action === 'print') printAppointment(id);
    else if (action === 'delete') deleteAppointment(id);
  });
});

async function loadAppointmentOptions() {
  try {
    const [patients, doctors, departments, sites] = await Promise.all([
      apiGet('/patients', { limit: 500 }),
      apiGet('/users/doctors'),
      apiGet('/settings/departments'),
      apiGet('/settings/sites')
    ]);
    const patSel = document.getElementById('appt-patient');
    const docSel = document.getElementById('appt-doctor');
    const deptSel = document.getElementById('appt-department');
    const siteSel = document.getElementById('appt-site');
    if (patSel) patSel.innerHTML = '<option value="">Select Patient</option>' + (patients.patients || []).map(p => `<option value="${escHtml(p.id)}">${escHtml(p.first_name)} ${escHtml(p.last_name)} (${escHtml(p.patient_number)})</option>`).join('');
    if (docSel) docSel.innerHTML = '<option value="">Select Doctor</option>' + (doctors || []).map(d => `<option value="${escHtml(d.id)}">${escHtml(d.name)}</option>`).join('');
    if (deptSel) deptSel.innerHTML = '<option value="">Select Department</option>' + (departments || []).map(d => `<option value="${escHtml(d.id)}">${escHtml(d.name)}</option>`).join('');
    if (siteSel) siteSel.innerHTML = '<option value="">Select Site</option>' + (sites || []).map(s => `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function loadAppointments() {
  try {
    const date = document.getElementById('filter-date')?.value;
    const status = document.getElementById('filter-status')?.value;
    const params = { page: apptPage, limit: 15 };
    if (date) params.date = date;
    if (status) params.status = status;
    const data = await apiGet('/appointments', params);
    const tbody = document.getElementById('appointments-tbody');
    const statusColors = { scheduled: 'primary', completed: 'success', cancelled: 'danger' };
    tbody.innerHTML = (data.appointments || []).map(a => `
      <tr>
        <td>
          ${escHtml(a.patient_name || 'N/A')}
          <br><small class="badge bg-secondary">${escHtml(a.patient_number || '')}</small>
        </td>
        <td>${escHtml(a.appointment_date)}</td>
        <td>${escHtml(a.appointment_time)}</td>
        <td>${escHtml(a.doctor_name || 'N/A')}</td>
        <td>${escHtml(a.department_name || 'N/A')}</td>
        <td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${escHtml(a.status)}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-info me-1" data-action="view" data-id="${escHtml(a.id)}" title="View"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-warning me-1" data-action="edit" data-id="${escHtml(a.id)}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" data-action="print" data-id="${escHtml(a.id)}" title="Print Slip"><i class="fas fa-print"></i></button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${escHtml(a.id)}" title="Delete"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">No appointments found</td></tr>';
    renderPagination(data.total, data.limit || 15, data.page || apptPage, 'appointments-pagination', (p) => { apptPage = p; loadAppointments(); });
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

function openAddAppointment() {
  apptEditId = null;
  document.getElementById('appt-modal-title').textContent = 'New Appointment';
  document.getElementById('appt-form').reset();
  document.getElementById('appt-date').value = new Date().toISOString().split('T')[0];
  const badge = document.getElementById('appt-patient-code');
  if (badge) badge.style.display = 'none';
  new bootstrap.Modal(document.getElementById('apptModal')).show();
}

async function editAppointment(id) {
  try {
    const a = await apiGet('/appointments/' + id);
    apptEditId = id;
    document.getElementById('appt-modal-title').textContent = 'Edit Appointment';
    document.getElementById('appt-patient').value = a.patient_id;
    document.getElementById('appt-doctor').value = a.doctor_id || '';
    document.getElementById('appt-department').value = a.department_id || '';
    document.getElementById('appt-site').value = a.site_id || '';
    document.getElementById('appt-date').value = a.appointment_date;
    document.getElementById('appt-time').value = a.appointment_time;
    document.getElementById('appt-status').value = a.status;
    document.getElementById('appt-notes').value = a.notes || '';
    const badge = document.getElementById('appt-patient-code');
    if (badge && a.patient_number) {
      badge.textContent = 'Code: ' + a.patient_number;
      badge.style.display = 'inline';
    }
    new bootstrap.Modal(document.getElementById('apptModal')).show();
  } catch (e) { alert('Error loading appointment'); }
}

async function saveAppointment() {
  const data = {
    patient_id: document.getElementById('appt-patient').value,
    doctor_id: document.getElementById('appt-doctor').value,
    department_id: document.getElementById('appt-department').value,
    site_id: document.getElementById('appt-site').value,
    appointment_date: document.getElementById('appt-date').value,
    appointment_time: document.getElementById('appt-time').value,
    status: document.getElementById('appt-status').value,
    notes: document.getElementById('appt-notes').value
  };
  if (!data.patient_id || !data.appointment_date || !data.appointment_time) { alert(t('patient') + ', ' + t('date') + ' & ' + t('time') + ' ' + t('required_field')); return; }
  try {
    if (apptEditId) { await apiPut('/appointments/' + apptEditId, data); }
    else { await apiPost('/appointments', data); }
    bootstrap.Modal.getInstance(document.getElementById('apptModal')).hide();
    loadAppointments();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function deleteAppointment(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/appointments/' + id); loadAppointments(); }
  catch (e) { alert(t('error') + ': ' + e.message); }
}

async function viewAppointment(id) {
  try {
    const a = await apiGet('/appointments/' + id);
    const statusColors = { scheduled: 'primary', completed: 'success', cancelled: 'danger' };
    document.getElementById('view-appt-content').innerHTML = `
      <div class="row g-3">
        <div class="col-md-6">
          <strong>Patient:</strong> ${escHtml(a.patient_name || 'N/A')}
          <br><span class="badge bg-primary mt-1">Code: ${escHtml(a.patient_number || 'N/A')}</span>
        </div>
        <div class="col-md-6"><strong>Doctor:</strong> ${escHtml(a.doctor_name || 'Not assigned')}</div>
        <div class="col-md-6"><strong>Department:</strong> ${escHtml(a.department_name || 'N/A')}</div>
        <div class="col-md-6"><strong>Site:</strong> ${escHtml(a.site_name || 'N/A')}</div>
        <div class="col-md-6"><strong>Date:</strong> ${escHtml(a.appointment_date)}</div>
        <div class="col-md-6"><strong>Time:</strong> ${escHtml(a.appointment_time)}</div>
        <div class="col-md-6"><strong>Status:</strong> <span class="badge bg-${statusColors[a.status] || 'secondary'}">${escHtml(a.status)}</span></div>
        <div class="col-12"><strong>Notes:</strong> ${escHtml(a.notes || 'None')}</div>
      </div>`;
    new bootstrap.Modal(document.getElementById('viewApptModal')).show();
  } catch (e) { alert('Error loading appointment'); }
}

async function printAppointment(id) {
  try {
    const a = await apiGet('/appointments/' + id);
    const w = window.open('', '_blank', 'width=700,height=600');
    w.document.write(`<!DOCTYPE html><html><head><title>Appointment Slip</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .slip-header { border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 20px; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head><body>
      <div class="container">
        <div class="slip-header text-center">
          <h3>&#x1F3E5; MedCare Hospital Management System</h3>
          <h5 class="text-muted">Appointment Slip</h5>
        </div>
        <div class="row mb-3">
          <div class="col-8">
            <table class="table table-bordered table-sm">
              <tr class="table-primary"><th colspan="2" class="text-center">Appointment Details</th></tr>
              <tr><th width="40%">Patient Name</th><td><strong>${escHtml(a.patient_name || 'N/A')}</strong></td></tr>
              <tr class="table-warning"><th>Patient Code</th><td><strong>${escHtml(a.patient_number || 'N/A')}</strong></td></tr>
              <tr><th>Doctor</th><td>${escHtml(a.doctor_name || 'Not assigned')}</td></tr>
              <tr><th>Department</th><td>${escHtml(a.department_name || 'N/A')}</td></tr>
              <tr><th>Site / Branch</th><td>${escHtml(a.site_name || 'N/A')}</td></tr>
              <tr><th>Date</th><td><strong>${escHtml(a.appointment_date)}</strong></td></tr>
              <tr><th>Time</th><td><strong>${escHtml(a.appointment_time)}</strong></td></tr>
              <tr><th>Status</th><td>${escHtml(a.status)}</td></tr>
              <tr><th>Notes</th><td>${escHtml(a.notes || 'None')}</td></tr>
            </table>
          </div>
          <div class="col-4 text-center">
            <div class="border rounded p-3 mb-3" style="border-color:#0d6efd!important">
              <div class="text-muted small">PATIENT CODE</div>
              <div style="font-size:1.6rem;font-weight:bold;color:#0d6efd">${escHtml(a.patient_number || 'N/A')}</div>
            </div>
            <div class="border rounded p-2">
              <div class="text-muted small">Appointment Date</div>
              <div style="font-weight:bold">${escHtml(a.appointment_date)}</div>
              <div style="font-weight:bold;color:#dc3545">${escHtml(a.appointment_time)}</div>
            </div>
          </div>
        </div>
        <div class="text-muted small text-end">Printed: ${new Date().toLocaleString()}</div>
        <div class="no-print text-center mt-3">
          <button onclick="window.print()" class="btn btn-primary me-2"><i class="fas fa-print me-1"></i> Print</button>
          <button onclick="window.close()" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </body></html>`);
    w.document.close();
  } catch (e) { alert('Error printing appointment: ' + e.message); }
}


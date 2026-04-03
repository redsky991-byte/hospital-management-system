let apptPage = 1;
let apptEditId = null;

window._activeNav = 'appointments';

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
});

async function loadAppointmentOptions() {
  try {
    const [patients, doctors, departments, sites] = await Promise.all([
      apiGet('/patients', { limit: 200 }),
      apiGet('/users'),
      apiGet('/settings/departments'),
      apiGet('/settings/sites')
    ]);
    const patSel = document.getElementById('appt-patient');
    const docSel = document.getElementById('appt-doctor');
    const deptSel = document.getElementById('appt-department');
    const siteSel = document.getElementById('appt-site');
    if (patSel) patSel.innerHTML = '<option value="">Select Patient</option>' + (patients.patients || []).map(p => `<option value="${p.id}">${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('');
    if (docSel) docSel.innerHTML = '<option value="">Select Doctor</option>' + (doctors || []).filter(u => u.role === 'doctor').map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (deptSel) deptSel.innerHTML = '<option value="">Select Department</option>' + (departments || []).map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (siteSel) siteSel.innerHTML = '<option value="">Select Site</option>' + (sites || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
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
        <td>${a.patient_name || 'N/A'}</td>
        <td>${a.appointment_date}</td>
        <td>${a.appointment_time}</td>
        <td>${a.doctor_name || 'N/A'}</td>
        <td>${a.department_name || 'N/A'}</td>
        <td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="editAppointment('${a.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAppointment('${a.id}')"><i class="fas fa-trash"></i></button>
          <button class="btn btn-sm btn-outline-secondary ms-1" onclick="printAppointment('${a.id}')"><i class="fas fa-print"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No appointments found</td></tr>';
  } catch (e) { console.error(e); }
}

function openAddAppointment() {
  apptEditId = null;
  document.getElementById('appt-modal-title').textContent = 'New Appointment';
  document.getElementById('appt-form').reset();
  document.getElementById('appt-date').value = new Date().toISOString().split('T')[0];
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

async function printAppointment(id) {
  const a = await apiGet('/appointments/' + id);
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Appointment Slip</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head><body class="p-4">
    <h3 class="text-center mb-3">MedCare Hospital Management System</h3>
    <h5 class="text-center mb-4">Appointment Slip</h5>
    <div class="card p-3">
      <p><strong>Patient:</strong> ${a.patient_name}</p>
      <p><strong>Patient #:</strong> ${a.patient_number}</p>
      <p><strong>Doctor:</strong> ${a.doctor_name || 'N/A'}</p>
      <p><strong>Department:</strong> ${a.department_name || 'N/A'}</p>
      <p><strong>Date:</strong> ${a.appointment_date}</p>
      <p><strong>Time:</strong> ${a.appointment_time}</p>
      <p><strong>Status:</strong> ${a.status}</p>
      <p><strong>Notes:</strong> ${a.notes || 'N/A'}</p>
    </div>
    <script>window.print(); window.close();<\/script></body></html>`);
  w.document.close();
}

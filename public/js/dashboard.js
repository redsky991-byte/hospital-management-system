document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  renderNav('dashboard');
  renderUserInfo();

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
    if (document.getElementById('stat-users')) document.getElementById('stat-users').textContent = Array.isArray(users) ? users.length : '-';

    const tbody = document.getElementById('recent-appointments');
    if (tbody && Array.isArray(appointments)) {
      tbody.innerHTML = appointments.slice(0, 10).map(a => `
        <tr>
          <td>${a.patient_name || 'N/A'}</td>
          <td>${a.doctor_name || 'N/A'}</td>
          <td>${a.department_name || 'N/A'}</td>
          <td>${a.appointment_time}</td>
          <td><span class="badge bg-${a.status==='scheduled'?'primary':a.status==='completed'?'success':'danger'}">${a.status}</span></td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">No appointments today</td></tr>';
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
          labels: ['Scheduled', 'Completed', 'Cancelled'],
          datasets: [{ data: [statuses.scheduled, statuses.completed, statuses.cancelled], backgroundColor: ['#1a73e8','#28a745','#dc3545'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
});

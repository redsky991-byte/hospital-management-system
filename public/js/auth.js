function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/index.html'; return null; }
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

function getUser() { return JSON.parse(localStorage.getItem('user') || '{}'); }

function renderNav(activeItem) {
  const user = getUser();
  const role = user.role || 'nurse';
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const items = [
    { href: 'dashboard.html', icon: 'fa-tachometer-alt', label: 'Dashboard', roles: ['admin','doctor','nurse'] },
    { href: 'patients.html', icon: 'fa-user-injured', label: 'Patients', roles: ['admin','doctor','nurse'] },
    { href: 'appointments.html', icon: 'fa-calendar-check', label: 'Appointments', roles: ['admin','doctor','nurse'] },
    { href: 'billing.html', icon: 'fa-file-invoice-dollar', label: 'Billing', roles: ['admin'] },
    { href: 'users.html', icon: 'fa-users-cog', label: 'Users', roles: ['admin'] },
    { href: 'audit.html', icon: 'fa-clipboard-list', label: 'Audit Logs', roles: ['admin'] },
    { href: 'settings.html', icon: 'fa-cog', label: 'Settings', roles: ['admin'] },
    { href: 'about.html', icon: 'fa-info-circle', label: 'About', roles: ['admin','doctor','nurse'] }
  ];
  nav.innerHTML = items.filter(i => i.roles.includes(role)).map(i => `
    <li class="nav-item">
      <a class="nav-link${i.href.includes(activeItem) ? ' active' : ''}" href="${i.href}">
        <i class="fas ${i.icon} me-2"></i>${i.label}
      </a>
    </li>`).join('');
}

function renderUserInfo() {
  const user = getUser();
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  const siteEl = document.getElementById('site-name');
  if (nameEl) nameEl.textContent = user.name || 'User';
  if (roleEl) roleEl.textContent = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
  if (siteEl) siteEl.textContent = user.site_name || '';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const btn = loginForm.querySelector('button[type=submit]');
      const errEl = document.getElementById('login-error');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
      try {
        const data = await apiPost('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('d-none'); }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
      }
    });
  }
});

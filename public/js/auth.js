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
    { href: 'dashboard.html', icon: 'fa-tachometer-alt', key: 'nav_dashboard', roles: ['admin','doctor','nurse'] },
    { href: 'patients.html', icon: 'fa-user-injured', key: 'nav_patients', roles: ['admin','doctor','nurse'] },
    { href: 'appointments.html', icon: 'fa-calendar-check', key: 'nav_appointments', roles: ['admin','doctor','nurse'] },
    { href: 'billing.html', icon: 'fa-file-invoice-dollar', key: 'nav_billing', roles: ['admin'] },
    { href: 'users.html', icon: 'fa-users-cog', key: 'nav_users', roles: ['admin'] },
    { href: 'audit.html', icon: 'fa-clipboard-list', key: 'nav_audit', roles: ['admin'] },
    { href: 'settings.html', icon: 'fa-cog', key: 'nav_settings', roles: ['admin'] },
    { href: 'about.html', icon: 'fa-info-circle', key: 'nav_about', roles: ['admin','doctor','nurse'] }
  ];
  nav.innerHTML = items.filter(i => i.roles.includes(role)).map(i => `
    <li class="nav-item">
      <a class="nav-link${i.href.includes(activeItem) ? ' active' : ''}" href="${i.href}">
        <i class="fas ${i.icon} me-2"></i><span data-i18n="${i.key}">${typeof t === 'function' ? t(i.key) : i.key}</span>
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

  // Inject language and currency pickers into topbar
  const topbarRight = document.querySelector('.topbar-right');
  if (topbarRight && !document.getElementById('lang-currency-bar')) {
    const bar = document.createElement('div');
    bar.id = 'lang-currency-bar';
    bar.className = 'd-flex align-items-center gap-2';

    // Language selector
    const langSel = document.createElement('select');
    langSel.id = 'topbar-lang';
    langSel.className = 'form-select form-select-sm';
    langSel.style.cssText = 'width:auto;font-size:0.78rem;padding:2px 6px';
    langSel.title = typeof t === 'function' ? t('select_language') : 'Language';
    if (typeof LANGUAGE_NAMES !== 'undefined') {
      langSel.innerHTML = Object.entries(LANGUAGE_NAMES).map(([code, name]) =>
        `<option value="${code}"${code === (typeof getLang === 'function' ? getLang() : 'en') ? ' selected' : ''}>${name}</option>`
      ).join('');
    }
    langSel.addEventListener('change', () => {
      if (typeof setLang === 'function') setLang(langSel.value);
      renderNav(window._activeNav || '');
    });

    // Currency selector
    const currSel = document.createElement('select');
    currSel.id = 'topbar-currency';
    currSel.className = 'form-select form-select-sm';
    currSel.style.cssText = 'width:auto;font-size:0.78rem;padding:2px 6px';
    currSel.title = typeof t === 'function' ? t('select_currency') : 'Currency';
    if (typeof CURRENCIES !== 'undefined') {
      const curCode = typeof getCurrency === 'function' ? getCurrency() : 'USD';
      currSel.innerHTML = Object.values(CURRENCIES).map(c =>
        `<option value="${c.code}"${c.code === curCode ? ' selected' : ''}>${c.code} ${c.symbol}</option>`
      ).join('');
    }
    currSel.addEventListener('change', () => {
      if (typeof setCurrency === 'function') setCurrency(currSel.value);
      // Trigger currency update event so pages can refresh amounts
      document.dispatchEvent(new CustomEvent('currencyChanged', { detail: currSel.value }));
    });

    bar.appendChild(langSel);
    bar.appendChild(currSel);
    // Insert before logout button
    const logoutBtn = topbarRight.querySelector('.btn-outline-danger');
    if (logoutBtn) {
      topbarRight.insertBefore(bar, logoutBtn);
    } else {
      topbarRight.appendChild(bar);
    }
  }
}

// Sync topbar selectors with stored values on page load
function syncTopbarSelectors() {
  const langSel = document.getElementById('topbar-lang');
  const currSel = document.getElementById('topbar-currency');
  if (langSel && typeof getLang === 'function') langSel.value = getLang();
  if (currSel && typeof getCurrency === 'function') currSel.value = getCurrency();
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    // Login page language selector
    const loginLangSel = document.getElementById('login-lang-select');
    if (loginLangSel && typeof LANGUAGE_NAMES !== 'undefined') {
      loginLangSel.innerHTML = Object.entries(LANGUAGE_NAMES).map(([code, name]) =>
        `<option value="${code}"${code === (typeof getLang === 'function' ? getLang() : 'en') ? ' selected' : ''}>${name}</option>`
      ).join('');
      loginLangSel.addEventListener('change', () => {
        if (typeof setLang === 'function') setLang(loginLangSel.value);
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const btn = loginForm.querySelector('button[type=submit]');
      const errEl = document.getElementById('login-error');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' + (typeof t === 'function' ? t('loading') : 'Loading...');
      try {
        const data = await apiPost('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('d-none'); }
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>' + (typeof t === 'function' ? t('sign_in') : 'Sign In');
      }
    });
  }
});

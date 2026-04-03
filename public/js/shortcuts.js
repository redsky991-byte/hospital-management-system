/**
 * MedCare HMS – Global Keyboard Shortcuts
 *
 * Navigation (two-key sequence starting with G):
 *   G D  → Dashboard
 *   G P  → Patients
 *   G A  → Appointments
 *   G B  → Billing
 *   G U  → Users
 *   G L  → Audit Logs
 *   G S  → Settings
 *   G H  → Help
 *
 * Actions (single key, only when no input is focused):
 *   N         → trigger primary Add/New button
 *   / or F    → focus search box
 *   Ctrl+P    → print
 *   ?         → toggle shortcut help modal
 *   Escape    → close open modals
 */
(function () {
  'use strict';

  const GOTO = {
    d: 'dashboard.html',
    p: 'patients.html',
    a: 'appointments.html',
    b: 'billing.html',
    u: 'users.html',
    l: 'audit.html',
    s: 'settings.html',
    h: 'help.html'
  };

  let gPressed = false;
  let gTimer = null;

  function isInputFocused() {
    const tag = document.activeElement && document.activeElement.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
           (document.activeElement && document.activeElement.isContentEditable);
  }

  function resetG() {
    gPressed = false;
    if (gTimer) { clearTimeout(gTimer); gTimer = null; }
  }

  document.addEventListener('keydown', function (e) {
    // Skip if a modifier key other than Shift is held (except Ctrl+P handled below)
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl+P → print
    if (ctrlOrMeta && e.key === 'p') {
      e.preventDefault();
      window.print();
      return;
    }

    // Skip all other shortcuts when input/textarea is focused
    if (isInputFocused()) return;

    // Skip when a modal is open and a key is pressed that isn't Escape
    const openModal = document.querySelector('.modal.show');

    // Escape → close top-most open Bootstrap modal
    if (e.key === 'Escape') {
      if (openModal) {
        const modal = bootstrap.Modal.getInstance(openModal);
        if (modal) modal.hide();
      }
      return;
    }

    // Ignore keyboard shortcuts when a modal is open (prevents accidental navigation)
    if (openModal) return;

    const key = e.key.toLowerCase();

    // "G" prefix navigation
    if (gPressed) {
      resetG();
      if (GOTO[key]) {
        window.location.href = GOTO[key];
      }
      return;
    }

    if (key === 'g') {
      gPressed = true;
      // Auto-reset after 1.5 s if no second key is pressed
      gTimer = setTimeout(resetG, 1500);
      return;
    }

    // ? → show/hide shortcut modal
    if (key === '?') {
      const el = document.getElementById('shortcutModal');
      if (el) {
        const m = bootstrap.Modal.getOrCreateInstance(el);
        m.toggle();
      }
      return;
    }

    // N → click primary add/new button
    if (key === 'n') {
      const btn = document.querySelector('[data-shortcut-new]') ||
                  document.querySelector('.btn-add-primary') ||
                  document.querySelector('[id^="btn-add"]') ||
                  document.querySelector('[id^="btn-new"]');
      if (btn) btn.click();
      return;
    }

    // / or f → focus search
    if (key === '/' || key === 'f') {
      e.preventDefault();
      const search = document.querySelector('input[type="search"]') ||
                     document.querySelector('input[placeholder*="Search" i]') ||
                     document.querySelector('input[placeholder*="search" i]') ||
                     document.querySelector('#search') ||
                     document.querySelector('[id*="search"]');
      if (search) { search.focus(); search.select(); }
      return;
    }
  });
})();

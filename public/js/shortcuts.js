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

  /* ---- Inject shortcut modal once the DOM is ready ---- */
  function injectModal() {
    if (document.getElementById('shortcutModal')) return; // already present (help.html)
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="shortcutModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="fas fa-keyboard me-2"></i>Keyboard Shortcuts</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <h6 class="text-muted text-uppercase small mb-2">Navigation (press G then&hellip;)</h6>
              <div class="row g-1 mb-3">
                <div class="col-6"><kbd>G</kbd> <kbd>D</kbd> &mdash; Dashboard</div>
                <div class="col-6"><kbd>G</kbd> <kbd>P</kbd> &mdash; Patients</div>
                <div class="col-6"><kbd>G</kbd> <kbd>A</kbd> &mdash; Appointments</div>
                <div class="col-6"><kbd>G</kbd> <kbd>B</kbd> &mdash; Billing</div>
                <div class="col-6"><kbd>G</kbd> <kbd>U</kbd> &mdash; Users</div>
                <div class="col-6"><kbd>G</kbd> <kbd>L</kbd> &mdash; Audit Logs</div>
                <div class="col-6"><kbd>G</kbd> <kbd>S</kbd> &mdash; Settings</div>
                <div class="col-6"><kbd>G</kbd> <kbd>H</kbd> &mdash; Help</div>
              </div>
              <h6 class="text-muted text-uppercase small mb-2">Actions</h6>
              <div class="row g-1">
                <div class="col-6"><kbd>N</kbd> &mdash; Add / New</div>
                <div class="col-6"><kbd>/</kbd> or <kbd>F</kbd> &mdash; Search</div>
                <div class="col-6"><kbd>Ctrl</kbd>+<kbd>P</kbd> &mdash; Print</div>
                <div class="col-6"><kbd>?</kbd> &mdash; This help</div>
                <div class="col-6"><kbd>Esc</kbd> &mdash; Close modal</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div.firstElementChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectModal);
  } else {
    injectModal();
  }

  /* ---- Keyboard handler ---- */
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
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Ctrl+P → print
    if (ctrlOrMeta && e.key === 'p') {
      e.preventDefault();
      window.print();
      return;
    }

    // Skip all other shortcuts when input/textarea is focused
    if (isInputFocused()) return;

    const openModal = document.querySelector('.modal.show');

    // Escape → close top-most open Bootstrap modal
    if (e.key === 'Escape') {
      if (openModal) {
        const modal = bootstrap.Modal.getInstance(openModal);
        if (modal) modal.hide();
      }
      return;
    }

    // Ignore other shortcuts when a modal is open
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

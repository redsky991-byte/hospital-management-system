let billPage = 1;
let billEditId = null;
let lineItems = [];


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
  renderNav('billing');
  renderUserInfo();
  // sync topbar after render
  setTimeout(syncTopbarSelectors, 50);
  await loadBillingOptions();
  await loadInvoices();
  document.getElementById('save-invoice-btn')?.addEventListener('click', saveInvoice);
  document.getElementById('add-item-btn')?.addEventListener('click', addLineItem);
  document.getElementById('save-payment-btn')?.addEventListener('click', savePayment);
  document.getElementById('filter-status')?.addEventListener('change', () => { billPage = 1; loadInvoices(); });
  document.addEventListener('currencyChanged', () => { loadInvoices(); });
});

window._activeNav = 'billing';

async function loadBillingOptions() {
  try {
    const [patients, sites] = await Promise.all([apiGet('/patients', { limit: 200 }), apiGet('/settings/sites')]);
    const patSel = document.getElementById('inv-patient');
    const siteSel = document.getElementById('inv-site');
    if (patSel) patSel.innerHTML = '<option value="">-- ' + t('patient') + ' --</option>' + (patients.patients || []).map(p => `<option value="${p.id}">${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('');
    if (siteSel) siteSel.innerHTML = '<option value="">-- ' + t('site') + ' --</option>' + (sites || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function loadInvoices() {
  try {
    const status = document.getElementById('filter-status')?.value;
    const params = { page: billPage, limit: 15 };
    if (status) params.status = status;
    const data = await apiGet('/billing', params);
    const statusColors = { draft: 'secondary', sent: 'info', paid: 'success', overdue: 'danger' };
    const tbody = document.getElementById('invoices-tbody');
    tbody.innerHTML = (data.invoices || []).map(i => `
      <tr>
        <td><span class="badge bg-dark">${escHtml(i.invoice_number)}</span></td>
        <td>${escHtml(i.patient_name || 'N/A')}</td>
        <td>${formatCurrency(i.total_amount)}</td>
        <td>${formatCurrency(i.paid_amount)}</td>
        <td>${formatCurrency(i.balance)}</td>
        <td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${t(i.status) || escHtml(i.status)}</span></td>
        <td>${escHtml(i.due_date || '-')}</td>
        <td>
          <button class="btn btn-sm btn-outline-info me-1" onclick="viewInvoice('${i.id}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-success me-1" onclick="openPayment('${i.id}', ${i.balance})"><i class="fas fa-dollar-sign"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="printInvoice('${i.id}')"><i class="fas fa-print"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteInvoice('${i.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || `<tr><td colspan="8" class="text-center text-muted">${t('no_data')}</td></tr>`;
    renderPagination(data.total, data.limit || 15, data.page || billPage, 'invoices-pagination', (p) => { billPage = p; loadInvoices(); });
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

function openNewInvoice() {
  billEditId = null;
  lineItems = [];
  document.getElementById('invoice-form').reset();
  renderLineItems();
  // Set up event delegation on the modal (once) so it survives innerHTML rebuilds
  const modal = document.getElementById('invoiceModal');
  if (modal && !modal._lineItemsBound) {
    modal._lineItemsBound = true;
    modal.addEventListener('input', e => {
      const input = e.target.closest('.line-item-input');
      if (!input) return;
      updateItem(Number(input.dataset.idx), input.dataset.field, input.value);
    });
  }
  new bootstrap.Modal(modal).show();
}

function addLineItem() {
  lineItems.push({ description: '', quantity: 1, unit_price: 0 });
  renderLineItems();
}

function removeItem(idx) { lineItems.splice(idx, 1); renderLineItems(); }

function updateItem(idx, field, val) {
  lineItems[idx][field] = field === 'description' ? val : parseFloat(val) || 0;
  renderLineItems();
}

function renderLineItems() {
  const sym = getCurrencySymbol();
  const container = document.getElementById('line-items');
  container.innerHTML = lineItems.map((item, i) => `
    <div class="row g-2 mb-2 align-items-center">
      <div class="col-5"><input type="text" class="form-control form-control-sm line-item-input" placeholder="${t('description')}" value="${escHtml(item.description)}" data-idx="${i}" data-field="description"></div>
      <div class="col-2"><input type="number" class="form-control form-control-sm line-item-input" placeholder="${t('quantity')}" value="${item.quantity}" data-idx="${i}" data-field="quantity" min="0.01" step="0.01"></div>
      <div class="col-3"><input type="number" class="form-control form-control-sm line-item-input" placeholder="${t('unit_price')}" value="${item.unit_price}" data-idx="${i}" data-field="unit_price" min="0" step="0.01"></div>
      <div class="col-1"><strong>${sym}${(item.quantity * item.unit_price).toFixed(2)}</strong></div>
      <div class="col-1"><button class="btn btn-sm btn-danger" onclick="removeItem(${i})"><i class="fas fa-times"></i></button></div>
    </div>`).join('');
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const tax = parseFloat(document.getElementById('inv-tax')?.value) || 0;
  const total = subtotal - discount + (subtotal * tax / 100);
  const el = document.getElementById('inv-total-display');
  if (el) el.textContent = formatCurrency(total);
}

async function saveInvoice() {
  const data = {
    patient_id: document.getElementById('inv-patient').value,
    site_id: document.getElementById('inv-site').value,
    discount: parseFloat(document.getElementById('inv-discount').value) || 0,
    tax: parseFloat(document.getElementById('inv-tax').value) || 0,
    due_date: document.getElementById('inv-due-date').value,
    notes: document.getElementById('inv-notes').value,
    items: lineItems
  };
  if (!data.patient_id) { alert(t('patient') + ' ' + t('required_field')); return; }
  try {
    await apiPost('/billing', data);
    bootstrap.Modal.getInstance(document.getElementById('invoiceModal')).hide();
    loadInvoices();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function viewInvoice(id) {
  try {
    const inv = await apiGet('/billing/' + id);
    document.getElementById('view-invoice-content').innerHTML = `
      <div class="row mb-3">
        <div class="col-6"><strong>${t('invoice_number')}:</strong> ${inv.invoice_number}</div>
        <div class="col-6"><strong>${t('status')}:</strong> <span class="badge bg-secondary">${t(inv.status) || inv.status}</span></div>
        <div class="col-6"><strong>${t('patient')}:</strong> ${escHtml(inv.patient_name)}</div>
        <div class="col-6"><strong>${t('due_date')}:</strong> ${inv.due_date || 'N/A'}</div>
      </div>
      <table class="table table-sm">
        <thead><tr><th>${t('description')}</th><th>${t('quantity')}</th><th>${t('unit_price')}</th><th>${t('total')}</th></tr></thead>
        <tbody>${(inv.items || []).map(i => `<tr><td>${escHtml(i.description)}</td><td>${i.quantity}</td><td>${formatCurrency(i.unit_price)}</td><td>${formatCurrency(i.total)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="text-end">
        <p>${t('discount')}: ${formatCurrency(inv.discount)}</p>
        <p>${t('tax')}: ${inv.tax}%</p>
        <p><strong>${t('total')}: ${formatCurrency(inv.total_amount)}</strong></p>
        <p>${t('paid')}: ${formatCurrency(inv.paid_amount)}</p>
        <p><strong>${t('balance')}: ${formatCurrency(inv.balance)}</strong></p>
      </div>`;
    new bootstrap.Modal(document.getElementById('viewInvoiceModal')).show();
  } catch (e) { alert(t('error') + ' loading invoice'); }
}

function openPayment(id, balance) {
  document.getElementById('payment-invoice-id').value = id;
  document.getElementById('payment-amount').value = Number(balance).toFixed(2);
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

async function savePayment() {
  const id = document.getElementById('payment-invoice-id').value;
  const amount = parseFloat(document.getElementById('payment-amount').value);
  try {
    await apiPost(`/billing/${id}/payment`, { amount });
    bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
    loadInvoices();
  } catch (e) { alert(t('error') + ': ' + e.message); }
}

async function printInvoice(id) {
  const inv = await apiGet('/billing/' + id);
  const sym = getCurrencySymbol();
  const curr = getCurrency();
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Invoice ${inv.invoice_number}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head><body class="p-4">
    <h3 class="text-center">MedCare Hospital Management System</h3>
    <h5 class="text-center mb-4">${t('billing')} / Invoice</h5>
    <div class="row mb-3">
      <div class="col-6"><strong>${t('invoice_number')}:</strong> ${inv.invoice_number}<br><strong>${t('patient')}:</strong> ${escHtml(inv.patient_name)}<br><strong>${t('patient_number')}:</strong> ${escHtml(inv.patient_number)}</div>
      <div class="col-6 text-end"><strong>${t('date')}:</strong> ${inv.created_at}<br><strong>${t('due_date')}:</strong> ${inv.due_date || 'N/A'}<br><strong>${t('status')}:</strong> ${t(inv.status) || inv.status}<br><small class="text-muted">${t('currency')}: ${curr}</small></div>
    </div>
    <table class="table table-bordered"><thead class="table-dark"><tr><th>${t('description')}</th><th>${t('quantity')}</th><th>${t('unit_price')}</th><th>${t('total')}</th></tr></thead>
    <tbody>${(inv.items || []).map(i => `<tr><td>${escHtml(i.description)}</td><td>${i.quantity}</td><td>${sym}${Number(i.unit_price).toFixed(2)}</td><td>${sym}${Number(i.total).toFixed(2)}</td></tr>`).join('')}</tbody></table>
    <div class="row justify-content-end"><div class="col-4">
      <table class="table table-sm">
        <tr><td>${t('discount')}</td><td>${sym}${Number(inv.discount).toFixed(2)}</td></tr>
        <tr><td>${t('tax')}</td><td>${inv.tax}%</td></tr>
        <tr class="table-dark"><td><strong>${t('total')}</strong></td><td><strong>${sym}${Number(inv.total_amount).toFixed(2)}</strong></td></tr>
        <tr><td>${t('paid')}</td><td>${sym}${Number(inv.paid_amount).toFixed(2)}</td></tr>
        <tr class="table-warning"><td><strong>${t('balance')}</strong></td><td><strong>${sym}${Number(inv.balance).toFixed(2)}</strong></td></tr>
      </table>
    </div></div>
    <script>window.print(); window.close();<\/script></body></html>`);
  w.document.close();
}

async function deleteInvoice(id) {
  if (!confirm(t('confirm_delete'))) return;
  try { await apiDelete('/billing/' + id); loadInvoices(); }
  catch (e) { alert(t('error') + ': ' + e.message); }
}

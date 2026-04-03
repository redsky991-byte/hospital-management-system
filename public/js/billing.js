let billPage = 1;
let billEditId = null;
let lineItems = [];

document.addEventListener('DOMContentLoaded', async () => {
  checkAuth();
  renderNav('billing');
  renderUserInfo();
  await loadBillingOptions();
  await loadInvoices();
  document.getElementById('save-invoice-btn')?.addEventListener('click', saveInvoice);
  document.getElementById('add-item-btn')?.addEventListener('click', addLineItem);
  document.getElementById('save-payment-btn')?.addEventListener('click', savePayment);
  document.getElementById('filter-status')?.addEventListener('change', () => { billPage = 1; loadInvoices(); });
});

async function loadBillingOptions() {
  try {
    const [patients, sites] = await Promise.all([apiGet('/patients', { limit: 200 }), apiGet('/settings/sites')]);
    const patSel = document.getElementById('inv-patient');
    const siteSel = document.getElementById('inv-site');
    if (patSel) patSel.innerHTML = '<option value="">Select Patient</option>' + (patients.patients || []).map(p => `<option value="${p.id}">${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('');
    if (siteSel) siteSel.innerHTML = '<option value="">Select Site</option>' + (sites || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
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
        <td><span class="badge bg-dark">${i.invoice_number}</span></td>
        <td>${i.patient_name || 'N/A'}</td>
        <td>$${Number(i.total_amount).toFixed(2)}</td>
        <td>$${Number(i.paid_amount).toFixed(2)}</td>
        <td>$${Number(i.balance).toFixed(2)}</td>
        <td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td>
        <td>${i.due_date || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-info me-1" onclick="viewInvoice('${i.id}')"><i class="fas fa-eye"></i></button>
          <button class="btn btn-sm btn-outline-success me-1" onclick="openPayment('${i.id}', ${i.balance})"><i class="fas fa-dollar-sign"></i></button>
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="printInvoice('${i.id}')"><i class="fas fa-print"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteInvoice('${i.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted">No invoices found</td></tr>';
  } catch (e) { console.error(e); }
}

function openNewInvoice() {
  billEditId = null;
  lineItems = [];
  document.getElementById('invoice-form').reset();
  renderLineItems();
  new bootstrap.Modal(document.getElementById('invoiceModal')).show();
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
  const container = document.getElementById('line-items');
  container.innerHTML = lineItems.map((item, i) => `
    <div class="row g-2 mb-2 align-items-center">
      <div class="col-5"><input type="text" class="form-control form-control-sm" placeholder="Description" value="${item.description}" oninput="updateItem(${i},'description',this.value)"></div>
      <div class="col-2"><input type="number" class="form-control form-control-sm" placeholder="Qty" value="${item.quantity}" oninput="updateItem(${i},'quantity',this.value)"></div>
      <div class="col-3"><input type="number" class="form-control form-control-sm" placeholder="Unit Price" value="${item.unit_price}" oninput="updateItem(${i},'unit_price',this.value)"></div>
      <div class="col-1"><strong>$${(item.quantity * item.unit_price).toFixed(2)}</strong></div>
      <div class="col-1"><button class="btn btn-sm btn-danger" onclick="removeItem(${i})"><i class="fas fa-times"></i></button></div>
    </div>`).join('');
  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = parseFloat(document.getElementById('inv-discount')?.value) || 0;
  const tax = parseFloat(document.getElementById('inv-tax')?.value) || 0;
  const total = subtotal - discount + (subtotal * tax / 100);
  const el = document.getElementById('inv-total-display');
  if (el) el.textContent = `$${total.toFixed(2)}`;
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
  if (!data.patient_id) { alert('Please select a patient'); return; }
  try {
    await apiPost('/billing', data);
    bootstrap.Modal.getInstance(document.getElementById('invoiceModal')).hide();
    loadInvoices();
  } catch (e) { alert('Error: ' + e.message); }
}

async function viewInvoice(id) {
  try {
    const inv = await apiGet('/billing/' + id);
    document.getElementById('view-invoice-content').innerHTML = `
      <div class="row mb-3">
        <div class="col-6"><strong>Invoice #:</strong> ${inv.invoice_number}</div>
        <div class="col-6"><strong>Status:</strong> <span class="badge bg-secondary">${inv.status}</span></div>
        <div class="col-6"><strong>Patient:</strong> ${inv.patient_name}</div>
        <div class="col-6"><strong>Due Date:</strong> ${inv.due_date || 'N/A'}</div>
      </div>
      <table class="table table-sm"><thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
      <tbody>${(inv.items || []).map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>$${Number(i.unit_price).toFixed(2)}</td><td>$${Number(i.total).toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="text-end">
        <p>Discount: $${Number(inv.discount).toFixed(2)}</p>
        <p>Tax: ${inv.tax}%</p>
        <p><strong>Total: $${Number(inv.total_amount).toFixed(2)}</strong></p>
        <p>Paid: $${Number(inv.paid_amount).toFixed(2)}</p>
        <p><strong>Balance: $${Number(inv.balance).toFixed(2)}</strong></p>
      </div>`;
    new bootstrap.Modal(document.getElementById('viewInvoiceModal')).show();
  } catch (e) { alert('Error loading invoice'); }
}

function openPayment(id, balance) {
  document.getElementById('payment-invoice-id').value = id;
  document.getElementById('payment-amount').value = balance.toFixed(2);
  new bootstrap.Modal(document.getElementById('paymentModal')).show();
}

async function savePayment() {
  const id = document.getElementById('payment-invoice-id').value;
  const amount = parseFloat(document.getElementById('payment-amount').value);
  try {
    await apiPost(`/billing/${id}/payment`, { amount });
    bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
    loadInvoices();
  } catch (e) { alert('Error: ' + e.message); }
}

async function printInvoice(id) {
  const inv = await apiGet('/billing/' + id);
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Invoice ${inv.invoice_number}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head><body class="p-4">
    <h3 class="text-center">MedCare Hospital Management System</h3>
    <h5 class="text-center mb-4">Invoice</h5>
    <div class="row mb-3">
      <div class="col-6"><strong>Invoice #:</strong> ${inv.invoice_number}<br><strong>Patient:</strong> ${inv.patient_name}<br><strong>Patient #:</strong> ${inv.patient_number}</div>
      <div class="col-6 text-end"><strong>Date:</strong> ${inv.created_at}<br><strong>Due:</strong> ${inv.due_date || 'N/A'}<br><strong>Status:</strong> ${inv.status}</div>
    </div>
    <table class="table table-bordered"><thead class="table-dark"><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${(inv.items || []).map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>$${Number(i.unit_price).toFixed(2)}</td><td>$${Number(i.total).toFixed(2)}</td></tr>`).join('')}</tbody></table>
    <div class="row justify-content-end"><div class="col-4">
      <table class="table table-sm">
        <tr><td>Discount</td><td>$${Number(inv.discount).toFixed(2)}</td></tr>
        <tr><td>Tax</td><td>${inv.tax}%</td></tr>
        <tr class="table-dark"><td><strong>Total</strong></td><td><strong>$${Number(inv.total_amount).toFixed(2)}</strong></td></tr>
        <tr><td>Paid</td><td>$${Number(inv.paid_amount).toFixed(2)}</td></tr>
        <tr class="table-warning"><td><strong>Balance</strong></td><td><strong>$${Number(inv.balance).toFixed(2)}</strong></td></tr>
      </table>
    </div></div>
    <script>window.print(); window.close();<\/script></body></html>`);
  w.document.close();
}

async function deleteInvoice(id) {
  if (!confirm('Delete this invoice?')) return;
  try { await apiDelete('/billing/' + id); loadInvoices(); }
  catch (e) { alert('Error: ' + e.message); }
}

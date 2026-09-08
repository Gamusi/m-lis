// M-LIS Reagents & Consumables Inventory Module
(function(app) {
  Object.assign(app, {
  renderInventory: __async(function*(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="color: var(--primary-color); margin: 0; font-size: 1.35rem;">Diagnostic Test Kit & Consumables Inventory</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Track physical test kits, rapid strips, cassettes, and FEFO lot balances.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-toggle-reconcile" onclick="app.toggleInventoryView('reconcile')">
            ${this.icon('refresh-cw')} Consumption Reconciliation
          </button>
          <button class="btn btn-primary" onclick="app.openReceiveStockModal()">
            ${this.icon('plus')} Receive New Stock Lot
          </button>
        </div>
      </div>

      <!-- Alerts Banner Container -->
      <div id="inventory-alerts-container" style="margin-bottom: 16px;"></div>

      <!-- Category Filter Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; background: #FFFFFF; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color);" id="inventory-cat-filters">
        <button class="btn btn-secondary btn-sm inv-cat-btn active" style="font-weight: 600;" onclick="app.filterInventoryCategory('all', this)">All Diagnostic Kits</button>
        <button class="btn btn-secondary btn-sm inv-cat-btn" onclick="app.filterInventoryCategory('HIV', this)">Serology / HIV</button>
        <button class="btn btn-secondary btn-sm inv-cat-btn" onclick="app.filterInventoryCategory('Parasitology', this)">Parasitology & Malaria</button>
        <button class="btn btn-secondary btn-sm inv-cat-btn" onclick="app.filterInventoryCategory('Serology', this)">General Serology</button>
        <button class="btn btn-secondary btn-sm inv-cat-btn" onclick="app.filterInventoryCategory('Urinalysis', this)">Urinalysis Strips</button>
        <button class="btn btn-secondary btn-sm inv-cat-btn" onclick="app.filterInventoryCategory('Molecular', this)">Molecular / EID</button>
      </div>

      <!-- Ledger Main View -->
      <div id="inventory-ledger-view">
        <!-- Stock Overview Summary Table -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <span class="card-title">${this.icon('boxes')} Available Stock Balances & Minimum Buffer Status</span>
          </div>
          <div id="inventory-summary-container" style="padding: 16px; overflow-x: auto;">
            <p style="color: var(--text-muted);">Loading inventory summary...</p>
          </div>
        </div>

        <!-- Active Lots Details Table -->
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <span class="card-title">${this.icon('clipboard-list')} Active Lot Ledger (FEFO Auto-Depletion Order)</span>
          </div>
          <div id="inventory-lots-container" style="padding: 16px; overflow-x: auto;">
            <p style="color: var(--text-muted);">Loading lot details...</p>
          </div>
        </div>

        <!-- Stock Transaction Audit Log -->
        <details class="card" style="margin-bottom: 20px;">
          <summary class="card-header" style="cursor: pointer; list-style: none;">
            <span class="card-title">${this.icon('file-text')} Stock Movement & Usage History (Audit Log)</span>
          </summary>
          <div id="inventory-transactions-container" style="padding: 16px; overflow-x: auto;">
            <p style="color: var(--text-muted);">Loading transaction log...</p>
          </div>
        </details>
      </div>

      <!-- Reconciliation View (Hidden by default) -->
      <div id="inventory-reconciliation-view" style="display: none;">
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span class="card-title">${this.icon('refresh-cw')} Consumption vs. Clinical Test Volume Reconciliation</span>
            <button class="btn btn-secondary btn-sm" onclick="app.toggleInventoryView('ledger')">Back to Stock Ledger</button>
          </div>
          <div style="padding: 16px;">
            <div style="display: flex; gap: 12px; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap;">
              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 4px;">From Date:</label>
                <input type="date" id="reconcile-from-date" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
              <div class="form-group">
                <label style="font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 4px;">To Date:</label>
                <input type="date" id="reconcile-to-date" style="padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 4px;">
              </div>
              <button class="btn btn-primary btn-sm" onclick="app.loadInventoryReconciliation()" style="padding: 7px 16px;">Generate Reconciliation</button>
            </div>
            <div id="inventory-reconciliation-table-container">
              <p style="color: var(--text-muted);">Select date range and click Generate Reconciliation.</p>
            </div>
          </div>
        </div>
      </div>
    `;

    yield this.loadInventoryData('all');
  }),

  loadInventoryData: __async(function*(category) {
    if (typeof category === 'undefined') category = 'all';
    this.currentInventoryCategory = category;
    yield this.loadInventoryAlerts();
    yield this.loadInventorySummary(category);
    yield this.loadInventoryLots(category);
    yield this.loadInventoryTransactions();
  }),

  filterInventoryCategory: __async(function*(category, btn) {
    document.querySelectorAll('.inv-cat-btn').forEach(b => {
      b.classList.remove('active');
      b.style.fontWeight = 'normal';
    });
    if (btn) {
      btn.classList.add('active');
      btn.style.fontWeight = '600';
    }
    yield this.loadInventoryData(category);
  }),

  loadInventoryAlerts: __async(function*() {
    const alertDiv = document.getElementById('inventory-alerts-container');
    if (!alertDiv) return;
    try {
      const res = yield fetch('/api/stock/alerts');
      if (!res.ok) return;
      const alerts = yield res.json();
      if (!alerts || alerts.length === 0) {
        alertDiv.innerHTML = '';
        return;
      }

      let alertsHtml = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      alerts.forEach(a => {
        const isExpired = a.alert_type === 'EXPIRED';
        const isLow = a.alert_type === 'LOW_STOCK';
        const borderColor = isExpired ? 'var(--danger-color)' : (isLow ? 'var(--warning-color)' : '#EAB308');
        const bgColor = isExpired ? '#FEF2F2' : (isLow ? '#FFFBEB' : '#FEFCE8');
        const textColor = isExpired ? '#991B1B' : (isLow ? '#92400E' : '#713F12');

        alertsHtml += `
          <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 10px 14px; border-radius: 4px; color: ${textColor}; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${this.escape(a.alert_type.replace('_', ' '))}:</strong> ${this.escape(a.message)}</span>
            <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="app.openReceiveStockModal('${this.escape(a.kit_name)}')">Receive Stock</button>
          </div>
        `;
      });
      alertsHtml += '</div>';
      alertDiv.innerHTML = alertsHtml;
    } catch(e) {
      console.error('Inventory alerts error:', e);
    }
  }),

  loadInventorySummary: __async(function*(category) {
    if (typeof category === 'undefined') category = 'all';
    const container = document.getElementById('inventory-summary-container');
    if (!container) return;
    try {
      const url = '/api/stock/summary' + (category !== 'all' ? '?category=' + encodeURIComponent(category) : '');
      const res = yield fetch(url);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const items = yield res.json();

      if (items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">No diagnostic kits found in this category.</p>';
        return;
      }

      let rows = '';
      items.forEach(item => {
        let statusColor = '#166534';
        if (item.status === 'Depleted') statusColor = 'var(--danger-color)';
        else if (item.status === 'Low Stock') statusColor = 'var(--warning-color)';
        else if (item.status === 'Near Expiry') statusColor = '#B45309';

        rows += `
          <tr>
            <td><strong>${this.escape(item.kit_name)}</strong></td>
            <td>${this.escape(item.category)}</td>
            <td><strong>${item.total_quantity}</strong></td>
            <td>${item.min_threshold}</td>
            <td>${item.active_lots_count}</td>
            <td style="font-weight: 600; color: ${statusColor};">${this.escape(item.status)}</td>
            <td>
              <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.openReceiveStockModal('${this.escape(item.kit_name)}')">+ Add Lot</button>
            </td>
          </tr>
        `;
      });

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Diagnostic Kit / Consumable</th>
              <th>Category</th>
              <th>Total Units Available</th>
              <th>Min Buffer Threshold</th>
              <th>Active Lots</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (e) {
      container.innerHTML = '<p style="color: var(--danger-color);">Failed to load inventory summary.</p>';
    }
  }),

  loadInventoryLots: __async(function*(category) {
    if (typeof category === 'undefined') category = 'all';
    const container = document.getElementById('inventory-lots-container');
    if (!container) return;
    try {
      const url = '/api/stock/lots?active_only=true' + (category !== 'all' ? '&category=' + encodeURIComponent(category) : '');
      const res = yield fetch(url);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const lots = yield res.json();

      if (lots.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">No active lots registered.</p>';
        return;
      }

      let rows = '';
      lots.forEach(l => {
        let statusColor = '#166534';
        if (l.status === 'Expired' || l.status === 'Depleted') statusColor = 'var(--danger-color)';
        else if (l.status === 'Low Stock' || l.status === 'Near Expiry') statusColor = 'var(--warning-color)';

        rows += `
          <tr>
            <td><code>${this.escape(l.lot_number)}</code></td>
            <td><strong>${this.escape(l.kit_name)}</strong></td>
            <td>${this.escape(l.category)}</td>
            <td>${this.escape(l.expiry_date)}</td>
            <td>${l.initial_quantity}</td>
            <td><strong>${l.current_quantity}</strong></td>
            <td style="font-weight: 600; color: ${statusColor};">${this.escape(l.status)}</td>
            <td>
              <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.openAdjustStockModal(${l.id}, '${this.escape(l.kit_name)}', '${this.escape(l.lot_number)}', ${l.current_quantity})">
                Adjust / Wastage
              </button>
            </td>
          </tr>
        `;
      });

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Lot Number</th>
              <th>Diagnostic Kit</th>
              <th>Category</th>
              <th>Expiry Date</th>
              <th>Initial Qty</th>
              <th>Current Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch (e) {
      container.innerHTML = '<p style="color: var(--danger-color);">Failed to load lot ledger.</p>';
    }
  }),

  loadInventoryTransactions: __async(function*() {
    const container = document.getElementById('inventory-transactions-container');
    if (!container) return;
    try {
      const res = yield fetch('/api/stock/transactions?limit=50');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const txs = yield res.json();

      if (txs.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">No stock transactions recorded yet.</p>';
        return;
      }

      let rows = '';
      txs.forEach(t => {
        const isDeduction = t.quantity_delta < 0;
        const deltaColor = isDeduction ? 'var(--danger-color)' : '#166534';
        const deltaPrefix = isDeduction ? '' : '+';

        rows += `
          <tr>
            <td>${t.created_at ? t.created_at.replace('T', ' ').substring(0, 19) : ''}</td>
            <td><strong>${this.escape(t.kit_name)}</strong></td>
            <td><code>${this.escape(t.lot_number)}</code></td>
            <td>${this.escape(t.transaction_type)}</td>
            <td style="font-weight: 700; color: ${deltaColor};">${deltaPrefix}${t.quantity_delta}</td>
            <td>${this.escape(t.reason || '')}</td>
            <td>${this.escape(t.username || 'System')}</td>
          </tr>
        `;
      });

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 170px;">Date & Time</th>
              <th>Diagnostic Kit</th>
              <th>Lot No</th>
              <th>Type</th>
              <th>Delta</th>
              <th>Reason</th>
              <th>Staff User</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch(e) {
      container.innerHTML = '<p style="color: var(--danger-color);">Failed to load transaction audit log.</p>';
    }
  }),

  toggleInventoryView: function(viewType) {
    const ledger = document.getElementById('inventory-ledger-view');
    const reconcile = document.getElementById('inventory-reconciliation-view');
    const filters = document.getElementById('inventory-cat-filters');
    const toggleBtn = document.getElementById('btn-toggle-reconcile');

    if (viewType === 'reconcile') {
      if (ledger) ledger.style.display = 'none';
      if (filters) filters.style.display = 'none';
      if (reconcile) reconcile.style.display = 'block';
      if (toggleBtn) toggleBtn.style.display = 'none';

      // Set default dates (start of month to today)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      const fromInput = document.getElementById('reconcile-from-date');
      const toInput = document.getElementById('reconcile-to-date');
      if (fromInput && !fromInput.value) fromInput.value = firstDay;
      if (toInput && !toInput.value) toInput.value = today;

      this.loadInventoryReconciliation();
    } else {
      if (ledger) ledger.style.display = 'block';
      if (filters) filters.style.display = 'flex';
      if (reconcile) reconcile.style.display = 'none';
      if (toggleBtn) toggleBtn.style.display = 'inline-block';
    }
  },

  loadInventoryReconciliation: __async(function*() {
    const container = document.getElementById('inventory-reconciliation-table-container');
    if (!container) return;
    const fromDate = document.getElementById('reconcile-from-date').value;
    const toDate = document.getElementById('reconcile-to-date').value;

    container.innerHTML = '<p style="color: var(--text-muted);">Calculating reconciliation metrics...</p>';
    try {
      let url = '/api/stock/reconciliation';
      if (fromDate || toDate) {
        url += `?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`;
      }
      const res = yield fetch(url);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = yield res.json();

      if (data.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">No reconciliation data found for this period.</p>';
        return;
      }

      let rows = '';
      data.forEach(r => {
        const varColor = r.variance === 0 ? '#166534' : (r.variance > 0 ? '#B45309' : 'var(--danger-color)');
        rows += `
          <tr>
            <td><strong>${this.escape(r.kit_name)}</strong></td>
            <td>${this.escape(r.category)}</td>
            <td><strong>${r.tests_completed}</strong></td>
            <td>${r.kits_consumed}</td>
            <td>${r.wastage_recorded}</td>
            <td style="font-weight: 700; color: ${varColor};">${r.variance > 0 ? '+' : ''}${r.variance}</td>
          </tr>
        `;
      });

      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Diagnostic Kit / Consumable</th>
              <th>Category</th>
              <th>Clinical Tests Done</th>
              <th>Kits Deducted</th>
              <th>Wastage / QC</th>
              <th>Consumption Variance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch(e) {
      container.innerHTML = '<p style="color: var(--danger-color);">Failed to load reconciliation report.</p>';
    }
  }),

  openReceiveStockModal: __async(function*(kitName) {
    if (typeof kitName === 'undefined') kitName = '';
    const form = document.getElementById('receive-stock-form');
    if (form) form.reset();

    // Populate datalist with registered kits
    try {
      const res = yield fetch('/api/stock/summary');
      if (res.ok) {
        const kits = yield res.json();
        const datalist = document.getElementById('registered-kits-list');
        if (datalist) {
          datalist.innerHTML = '';
          kits.forEach(k => {
            datalist.innerHTML += `<option value="${this.escape(k.kit_name)}">`;
          });
        }
      }
    } catch(e) {}

    const kitInput = document.getElementById('receive-stock-kit');
    if (kitInput && kitName) kitInput.value = kitName;

    // Set default expiration date to 1 year from today
    const expInput = document.getElementById('receive-stock-expiry');
    if (expInput) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      expInput.value = nextYear.toISOString().split('T')[0];
    }

    const modal = document.getElementById('receive-stock-modal');
    if (modal) this.openModal(modal);
  }),

  submitReceiveStock: __async(function*(e) {
    e.preventDefault();
    const kit_name = document.getElementById('receive-stock-kit').value.trim();
    const category = document.getElementById('receive-stock-category').value;
    const lot_number = document.getElementById('receive-stock-lot-no').value.trim();
    const expiry_date = document.getElementById('receive-stock-expiry').value;
    const initial_quantity = parseInt(document.getElementById('receive-stock-quantity').value, 10);
    const min_threshold = parseInt(document.getElementById('receive-stock-threshold').value, 10) || 25;

    if (!kit_name || !lot_number || !expiry_date || isNaN(initial_quantity) || initial_quantity <= 0) {
      this.showNotificationModal("Validation Error", "Please provide complete and valid lot information.", true);
      return;
    }

    const payload = { kit_name, category, lot_number, expiry_date, initial_quantity, min_threshold };

    try {
      const res = yield fetch('/api/stock/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.closeModal('receive-stock-modal');
        this.showNotificationModal("Success", `Stock lot received successfully (${initial_quantity} units of ${kit_name}).`);
        yield this.loadInventoryData(this.currentInventoryCategory || 'all');
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || 'Failed to receive stock lot.', true);
      }
    } catch(e) {
      this.showNotificationModal("Error", 'Connection error while saving stock receipt.', true);
    }
  }),

  openAdjustStockModal: function(lotId, kitName, lotNumber, currentQty) {
    document.getElementById('adjust-stock-lot-id').value = lotId;
    document.getElementById('adjust-stock-lot-info').textContent = `${kitName} (Lot ${lotNumber}) — Current Balance: ${currentQty} units`;
    document.getElementById('adjust-stock-type').value = 'WASTAGE_QC';
    document.getElementById('adjust-stock-delta').value = '1';
    document.getElementById('adjust-stock-reason').value = '';
    this.handleAdjustStockTypeChange();
    this.openModal('adjust-stock-modal');
  },

  handleAdjustStockTypeChange: function() {
    const type = document.getElementById('adjust-stock-type').value;
    const label = document.getElementById('adjust-stock-qty-label');
    const input = document.getElementById('adjust-stock-delta');
    if (type === 'WASTAGE_QC') {
      if (label) label.textContent = 'Number of Units to Deduct / Waste (e.g. 2) *:';
      if (input) {
        input.placeholder = 'e.g. 2';
        input.min = '1';
      }
    } else {
      if (label) label.textContent = 'Adjustment Amount (+ to add, - to reduce) *:';
      if (input) {
        input.placeholder = 'e.g. +5 or -3';
        input.removeAttribute('min');
      }
    }
  },

  submitAdjustStock: __async(function*(e) {
    e.preventDefault();
    const lot_id = parseInt(document.getElementById('adjust-stock-lot-id').value, 10);
    const transaction_type = document.getElementById('adjust-stock-type').value;
    let quantity_delta = parseInt(document.getElementById('adjust-stock-delta').value, 10);
    const reason = document.getElementById('adjust-stock-reason').value.trim();

    if (isNaN(quantity_delta) || quantity_delta === 0) {
      this.showNotificationModal("Validation Error", "Number of units must not be zero.", true);
      return;
    }
    if (!reason) {
      this.showNotificationModal("Validation Error", "A detailed reason is required for stock adjustments.", true);
      return;
    }

    if (transaction_type === 'WASTAGE_QC' && quantity_delta > 0) {
      quantity_delta = -quantity_delta;
    }

    const payload = { lot_id, transaction_type, quantity_delta, reason };

    try {
      const res = yield fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.closeModal('adjust-stock-modal');
        this.showNotificationModal("Success", "Stock adjusted successfully.");
        yield this.loadInventoryData(this.currentInventoryCategory || 'all');
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || 'Failed to adjust stock.', true);
      }
    } catch(e) {
      this.showNotificationModal("Error", 'Connection error while adjusting stock.', true);
    }
  }),

  openBulkExportModal: __async(function*() {
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.showNotificationModal("Access Denied", "Administrator privileges are required to perform bulk data export.", true);
      return;
    }

    const modal = document.getElementById('bulk-export-modal');
    if (!modal) return;

    // Populate Wards dropdown if needed
    const wardSelect = document.getElementById('export-ward');
    if (wardSelect) {
      wardSelect.innerHTML = '<option value="">All Wards / OPD</option>';
      if (!this.wards || this.wards.length === 0) {
        try {
          const res = yield fetch('/api/wards');
          if (res.ok) this.wards = yield res.json();
        } catch (e) {}
      }
      (this.wards || []).forEach(w => {
        if (w.is_active !== 0) {
          wardSelect.innerHTML += `<option value="${this.escape(w.name)}">${this.escape(w.name)}</option>`;
        }
      });
    }

    // Populate Sections dropdown if needed
    const secSelect = document.getElementById('export-section');
    if (secSelect) {
      secSelect.innerHTML = '<option value="">All Sections</option>';
      if (!this.sections || this.sections.length === 0) {
        try {
          const res = yield fetch('/api/sections');
          if (res.ok) this.sections = yield res.json();
        } catch (e) {}
      }
      (this.sections || []).forEach(s => {
        secSelect.innerHTML += `<option value="${s.id}">${this.escape(s.name)}</option>`;
      });
    }

    this.onExportDatasetChange();
    this.openModal(modal);
  }),

  closeBulkExportModal: function() {
    this.closeModal('bulk-export-modal');
  },

  onExportDatasetChange: function() {
    const dataset = document.getElementById('export-dataset') ? document.getElementById('export-dataset').value : 'clients';
    const filtersDiv = document.getElementById('export-results-filters');
    if (filtersDiv) {
      filtersDiv.style.display = dataset === 'results' ? 'block' : 'none';
    }
  },

  submitBulkExport: __async(function*(e) {
    if (e) e.preventDefault();
    const dataset = document.getElementById('export-dataset') ? document.getElementById('export-dataset').value : 'clients';
    const format = document.getElementById('export-format') ? document.getElementById('export-format').value : 'csv';
    const startDate = document.getElementById('export-start-date') ? document.getElementById('export-start-date').value : '';
    const endDate = document.getElementById('export-end-date') ? document.getElementById('export-end-date').value : '';

    let url = '';
    if (dataset === 'clients') {
      url = `/api/export/clients?format=${format}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
    } else {
      const ward = document.getElementById('export-ward') ? document.getElementById('export-ward').value : '';
      const sectionId = document.getElementById('export-section') ? document.getElementById('export-section').value : '';
      url = `/api/export/results?format=${format}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
      if (ward) url += `&ward=${encodeURIComponent(ward)}`;
      if (sectionId) url += `&section_id=${encodeURIComponent(sectionId)}`;
    }

    const submitBtn = document.getElementById('export-submit-btn');
    const origText = submitBtn ? submitBtn.textContent : 'Export and Download Data';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Preparing Download...';
    }

    try {
      const res = yield fetch(url);
      if (!res.ok) {
        let errMsg = 'Failed to export dataset.';
        try {
          const errData = yield res.json();
          if (errData && errData.detail) errMsg = errData.detail;
        } catch(_) {}
        this.showNotificationModal("Export Error", errMsg, true);
        return;
      }

      const disposition = res.headers.get('Content-Disposition') || '';
      let filename = dataset === 'clients' ? `clients_export.${format}` : `lab_results_export.${format}`;
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = yield res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      this.closeBulkExportModal();
      this.showNotificationModal("Export Complete", `Downloaded ${filename} successfully.`, false);
    } catch(err) {
      console.error('Export error:', err);
      this.showNotificationModal("Export Error", "Connection error during export: " + (err.message || String(err)), true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  }),

  openBulkImportModal: function() {
    if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'superadmin')) {
      this.showNotificationModal("Access Denied", "Administrator privileges are required to perform bulk data import.", true);
      return;
    }
    const fileInput = document.getElementById('import-file');
    if (fileInput) fileInput.value = '';
    const dryRunCheckbox = document.getElementById('import-dry-run');
    if (dryRunCheckbox) dryRunCheckbox.checked = false;

    const dropzone = document.getElementById('import-dropzone');
    const textEl = document.getElementById('import-dropzone-text');
    const detailEl = document.getElementById('import-file-details');
    if (dropzone) {
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = '#F8FAFC';
    }
    if (textEl) textEl.textContent = 'Click or Drag & Drop .CSV or .JSON File Here';
    if (detailEl) detailEl.textContent = 'Supports standard M-LIS exported records';

    this.openModal('bulk-import-modal');
  },

  onImportDragOver: function(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
      dropzone.style.borderColor = 'var(--primary-color)';
      dropzone.style.background = '#EFF6FF';
    }
  },

  onImportDragLeave: function(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = '#F8FAFC';
    }
  },

  onImportDrop: function(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) {
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = '#F8FAFC';
    }
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
      const fileInput = document.getElementById('import-file');
      if (fileInput) {
        fileInput.files = files;
        this.onImportFileSelected(fileInput);
      }
    }
  },

  onImportFileSelected: function(input) {
    const textEl = document.getElementById('import-dropzone-text');
    const detailEl = document.getElementById('import-file-details');
    if (input && input.files && input.files.length > 0) {
      const file = input.files[0];
      const sizeKb = (file.size / 1024).toFixed(1);
      if (textEl) textEl.textContent = `Selected: ${file.name}`;
      if (detailEl) detailEl.textContent = `Size: ${sizeKb} KB | Type: ${file.type || 'text/csv'}`;
    }
  },

  closeBulkImportModal: function() {
    this.closeModal('bulk-import-modal');
  },

  submitBulkImport: __async(function*(e) {
    if (e) e.preventDefault();
    const dataset = document.getElementById('import-dataset') ? document.getElementById('import-dataset').value : 'clients';
    const dryRun = document.getElementById('import-dry-run') && document.getElementById('import-dry-run').checked ? 'true' : 'false';
    const fileInput = document.getElementById('import-file');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      this.showNotificationModal("Validation Error", "Please select an Excel (.xlsx), CSV or JSON file to import.", true);
      return;
    }

    const file = fileInput.files[0];
    const submitBtn = document.getElementById('import-submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : 'Import Data';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Importing Data...';
    }

    try {
      const isXlsx = file.name && file.name.toLowerCase().endsWith('.xlsx');
      const isJson = file.name && file.name.toLowerCase().endsWith('.json');

      const fileContent = yield new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(evt) { resolve(evt.target.result); };
        reader.onerror = function(err) { reject(err); };
        if (isXlsx) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      });

      let contentType = 'text/csv';
      if (isXlsx) {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (isJson) {
        contentType = 'application/json';
      }

      const endpoint = dataset === 'clients' ? `/api/import/clients?dry_run=${dryRun}` : `/api/import/results?dry_run=${dryRun}`;

      const res = yield fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: fileContent
      });

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }

      if (res.ok) {
        const data = yield res.json();
        this.closeBulkImportModal();
        let msg = '';
        if (data.dry_run) {
          msg = `Dry Run Validation Summary:\n- Total records: ${data.total}\n- Valid to insert: ${data.inserted}\n- Valid to update: ${data.updated}`;
          if (data.errors && data.errors.length > 0) {
            msg += `\n- Errors detected (${data.errors.length}):\n` + data.errors.slice(0, 5).join('\n');
            if (data.errors.length > 5) msg += `\n...and ${data.errors.length - 5} more.`;
          }
          this.showNotificationModal("Dry Run Validation", msg, false);
        } else {
          msg = `Import Completed Successfully:\n- Total records processed: ${data.processed}\n- Inserted: ${data.inserted}\n- Updated: ${data.updated}`;
          if (data.errors && data.errors.length > 0) {
            msg += `\n- Errors encountered (${data.errors.length}):\n` + data.errors.slice(0, 5).join('\n');
          }
          this.showNotificationModal("Bulk Import Successful", msg, false);
          if (this.currentView === 'clients') {
            yield this.searchClients('');
          }
        }
      } else {
        const err = yield res.json();
        this.showNotificationModal("Import Error", err.detail || "Failed to import records.", true);
      }
    } catch(err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      this.showNotificationModal("Error", "Failed to read or upload import file: " + (err.message || String(err)), true);
    }
  }),

  escape: function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },


  });
})(window.app);

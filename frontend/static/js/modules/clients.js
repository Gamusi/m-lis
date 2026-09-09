// M-LIS Client Directory & Visit Orders Module
(function(app) {
  Object.assign(app, {
  renderClients: __async(function*(container) {
    const isAdmin = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
    const bulkBar = isAdmin ? `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 600;">
          <input type="checkbox" id="select-all-clients" onchange="app.toggleSelectAllClients(this.checked)"> Select All
        </label>
        <button id="btn-bulk-delete-clients" class="btn btn-danger btn-sm" style="display: none; padding: 2px 8px; font-size: 0.78rem;" onclick="app.bulkDeleteClients()">
          Delete Selected (<span id="selected-clients-count">0</span>)
        </button>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${this.icon('file-text')} Lab Reports and Client Details</span>
          <div class="controls-row">
            <button class="btn btn-primary" onclick="app.showNewClientModal()">${this.icon('user-plus')} Register New Client</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
          <!-- Client List -->
          <div>
            <h3 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 10px;">Registered Clients</h3>
            <div class="form-group" style="margin-bottom: 10px;">
              <input type="text" id="client-search-input" placeholder="Search client name/ID... (Press / to focus, ↓ to browse)" oninput="app.searchClients(this.value)" onkeydown="app.handleClientSearchKeyNav(event)">
            </div>
            ${bulkBar}
            <div id="client-list-box" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; max-height: 500px; overflow-y: auto;">
              <p style="padding: 12px; color: var(--text-muted);">Loading client directory...</p>
            </div>
          </div>

          <!-- Client Detail & Official Report Paper -->
          <div id="client-detail-box">
            <div style="padding: 32px; background: #F8FAFC; border-radius: 8px; border: 2px dashed var(--border-color); text-align: center; color: var(--text-muted);">
              Select a client from the list on the left to log diagnostic test results or view their official letterhead report.
            </div>
          </div>
        </div>
      </div>
    `;
    yield this.searchClients('');
  }),

  handleClientSearchKeyNav: function(event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const firstItem = document.querySelector('.client-list-item');
      if (firstItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
  },

  handleClientItemKeyNav: function(event, pid, pnum, pname, psex) {
    const key = event.key;
    const target = event.currentTarget;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.selectClient(pid, pnum, pname, psex);
      setTimeout(function() {
        const testSearch = document.getElementById('visit-test-search');
        if (testSearch) {
          testSearch.focus();
        }
      }, 150);
    } else if (key === 'ArrowDown' || key === 'j') {
      event.preventDefault();
      const next = target.nextElementSibling;
      if (next && next.classList.contains('client-list-item')) {
        next.focus();
      }
    } else if (key === 'ArrowUp' || key === 'k') {
      event.preventDefault();
      const prev = target.previousElementSibling;
      if (prev && prev.classList.contains('client-list-item')) {
        prev.focus();
      } else {
        const searchInput = document.getElementById('client-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    } else if (key === 'x' || key === 'X') {
      const cb = target.querySelector('.client-checkbox');
      if (cb) {
        event.preventDefault();
        cb.checked = !cb.checked;
        this.onClientSelectionChange();
      }
    }
  },

  searchClients: __async(function*(q) {
    try {
      const res = yield fetch(`/api/clients?query=${encodeURIComponent(q || '')}`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const clients = yield res.json();

      const box = document.getElementById('client-list-box');
      if (clients.length === 0) {
        box.innerHTML = '<p style="padding: 12px; color: var(--text-muted);">No clients found.</p>';
        return;
      }

      const isAdmin = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
      let html = '';
      clients.forEach(p => {
        const checkboxHtml = isAdmin ? `
          <input type="checkbox" class="client-checkbox" value="${p.id}" onclick="event.stopPropagation()" onchange="app.onClientSelectionChange()" style="margin-right: 10px; cursor: pointer;">
        ` : '';

        const isSelected = app.currentClientId === p.id;
        html += `
          <div class="client-list-item ${isSelected ? 'selected' : ''}" 
               data-client-id="${p.id}"
               tabindex="0"
               role="button"
               style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s, border-color 0.2s; display: flex; align-items: center;" 
               onclick="app.selectClient(${p.id}, '${this.escape(p.client_number)}', '${this.escape(p.full_name)}', '${p.sex}')"
               onkeydown="app.handleClientItemKeyNav(event, ${p.id}, '${this.escape(p.client_number)}', '${this.escape(p.full_name)}', '${p.sex}')">
            ${checkboxHtml}
            <div style="flex: 1;">
              <div style="font-weight: 700; color: var(--primary-color);">${this.escape(p.full_name)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">ID: ${this.escape(p.client_number)} | Sex: ${p.sex}</div>
            </div>
          </div>
        `;
      });
      box.innerHTML = html;
      this.onClientSelectionChange();
    } catch (e) {
      console.error('Client search error:', e);
    }
  }),

  toggleSelectAllClients: function(checked) {
    const checkboxes = document.querySelectorAll('.client-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    this.onClientSelectionChange();
  },

  onClientSelectionChange: function() {
    const selected = document.querySelectorAll('.client-checkbox:checked');
    const all = document.querySelectorAll('.client-checkbox');
    const selectAllCb = document.getElementById('select-all-clients');
    if (selectAllCb && all.length > 0) {
      selectAllCb.checked = selected.length === all.length;
    }
    const btn = document.getElementById('btn-bulk-delete-clients');
    const countSpan = document.getElementById('selected-clients-count');
    if (btn && countSpan) {
      countSpan.textContent = selected.length;
      btn.style.display = selected.length > 0 ? 'inline-block' : 'none';
    }
  },

  bulkDeleteClients: __async(function*() {
    const selected = Array.from(document.querySelectorAll('.client-checkbox:checked')).map(cb => parseInt(cb.value, 10));
    if (selected.length === 0) return;

    this.confirmAction(
      "Delete Selected Clients",
      `Are you sure you want to delete ${selected.length} client(s)? All associated visits, orders, and diagnostic results will be permanently removed.`,
      __async(function*() {
        try {
          const res = yield fetch('/api/clients/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_ids: selected })
          });
          if (res.ok) {
            const data = yield res.json();
            const deleted = data.deleted_client_ids || [];
            app.showNotificationModal("Success", `Successfully deleted ${deleted.length} client(s).`, false);
            const searchInput = document.getElementById('client-search-input');
            const q = searchInput ? searchInput.value : '';
            yield app.searchClients(q);
            const detailBox = document.getElementById('client-detail-box');
            if (detailBox) {
              detailBox.innerHTML = `
                <div style="padding: 32px; background: #F8FAFC; border-radius: 8px; border: 2px dashed var(--border-color); text-align: center; color: var(--text-muted);">
                  Select a client from the list on the left to log diagnostic test results or view their official letterhead report.
                </div>
              `;
            }
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to delete selected clients.", true);
          }
        } catch(e) {
          console.error(e);
          app.showNotificationModal("Error", "Server error while deleting clients.", true);
        }
      })
    );
  }),

  selectClient: __async(function*(pid, pnum, pname, psex) {
    this.currentClientId = pid;
    this.currentClientData = { id: pid, client_number: pnum, full_name: pname, sex: psex };
    
    // Update active highlight in client list
    const items = document.querySelectorAll('.client-list-item');
    items.forEach(el => {
      if (parseInt(el.getAttribute('data-client-id'), 10) === pid) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    const box = document.getElementById('client-detail-box');
    box.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="color: var(--primary-color);">Client: <span id="client-header-name">${pname}</span> (${pnum})</h3>
          <button class="btn btn-secondary btn-sm" onclick="app.openEditClientModal(${pid})">Edit Client Details</button>
        </div>

        <!-- Section A: Create Visit -->
        <div class="no-print" style="margin-bottom: 20px; background: #EFF6FF; padding: 16px; border-radius: 6px; border: 1px solid #BFDBFE;">
          <h4 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 12px;">Create Visit & Order Tests</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px;">
            <div class="form-group">
              <label>Ward of Origin:</label>
              <select id="visit-ward" onchange="app.saveClientVisitPrefs(${pid})">
                <option value="">Loading wards...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Requested By (Clinician):</label>
              <select id="visit-clinician" onchange="app.saveClientVisitPrefs(${pid})">
                <option value="">Loading...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Test Category:</label>
              <select id="visit-order-category" onchange="app.saveClientVisitPrefs(${pid})" style="width: 100%; padding: 8px;">
                <option value="in-house" selected>In-house</option>
                <option value="referral">Referral</option>
                <option value="outreach">Outreach</option>
              </select>
            </div>
            <div class="form-group">
              <label>Lab Section:</label>
              <select id="visit-test-section" onchange="app.filterVisitTests()" style="width: 100%; padding: 8px;">
                <option value="all" selected>All Sections</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label style="margin: 0; font-weight: 600;">Select Test(s):</label>
              <span id="visit-selected-count" style="font-size: 0.8rem; font-weight: 600; color: var(--primary-color);">0 tests selected</span>
            </div>
            
            <!-- Selected Tests Summary Bar with Per-Test Specimen Dropdowns -->
            <div id="visit-selected-summary-bar" style="display: none; padding: 10px 14px; background: #fff; border: 1px solid #93C5FD; border-radius: 6px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #1E40AF; font-weight: 700;">Ordered Tests &amp; Specimen Selection</span>
                <button type="button" onclick="app.clearAllSelectedTests()" style="font-size: 0.75rem; color: var(--danger-color); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; font-weight: 600;">Clear All</button>
              </div>
              <div id="visit-selected-chips-container" style="display: flex; flex-direction: column; gap: 6px;"></div>
            </div>

            <input type="text" id="visit-test-search" placeholder="Search tests..." onkeyup="app.filterVisitTests()" style="width: 100%; padding: 8px; margin-bottom: 8px; box-sizing: border-box;">
            <div id="visit-tests-container">Loading tests...</div>
          </div>
          <button class="btn btn-success" style="width: 100%; padding: 10px;" onclick="app.createVisit(${pid})">${this.icon('plus')} Create Visit & Orders</button>
        </div>

        <!-- Section B: Pending Tests -->
        <div class="no-print" style="margin-bottom: 20px;">
          <h4 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 12px;">Pending Tests</h4>
          <div id="pending-tests-container" style="background: #fff; border: 1px solid var(--border-color); border-radius: 4px; padding: 12px;">
            Loading pending tests...
          </div>
        </div>

        <!-- Section C: Historical Reports -->
        <div class="no-print" style="margin-bottom: 20px;">
          <h4 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 12px;">Historical Reports</h4>
          <div id="historical-visits-container" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
            Loading visits...
          </div>
        </div>

        <!-- Official PDF Report Iframe -->
        <iframe id="report-frame" src="" width="100%" height="800px" style="border: none; display: none;"></iframe>
      </div>
    `;

    yield Promise.all([
      this.loadWards(),
      this.loadClinicians(),
      this.loadSpecimens(),
      this.loadTestOptionsMulti()
    ]);
    this.restoreClientVisitPrefs(pid);
    yield Promise.all([
      this.loadPendingTests(pid),
      this.loadHistoricalVisits(pid)
    ]);
  }),

  saveClientVisitPrefs: function(pid) {
    if (!pid) return;
    try {
      const wardEl = document.getElementById('visit-ward');
      const clinEl = document.getElementById('visit-clinician');
      const catEl = document.getElementById('visit-order-category');
      const prefs = {
        ward: (wardEl && wardEl.value) ? wardEl.value : '',
        clinician: (clinEl && clinEl.value) ? clinEl.value : '',
        orderCat: (catEl && catEl.value) ? catEl.value : 'in-house'
      };
      localStorage.setItem('mlis_client_' + pid + '_visit_pref', JSON.stringify(prefs));
    } catch(e) {}
  },

  restoreClientVisitPrefs: function(pid) {
    if (!pid) return;
    try {
      const raw = localStorage.getItem('mlis_client_' + pid + '_visit_pref');
      if (raw) {
        const p = JSON.parse(raw);
        if (p.ward) {
          const wardEl = document.getElementById('visit-ward');
          if (wardEl) wardEl.value = p.ward;
        }
        if (p.clinician) {
          const clinEl = document.getElementById('visit-clinician');
          if (clinEl) clinEl.value = p.clinician;
        }
        if (p.orderCat) {
          const catEl = document.getElementById('visit-order-category');
          if (catEl) catEl.value = p.orderCat;
        }
      }
    } catch(e) {
      console.error('Error restoring client visit prefs', e);
    }
  },

  loadTestOptions: __async(function*() {
    try {
      const res = yield fetch('/api/config/tests');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const tests = yield res.json();

      const selectEl = document.getElementById('order-test-select');
      if (!selectEl) return;

      selectEl.innerHTML = '';
      tests.forEach(t => {
        selectEl.innerHTML += `<option value="${t.id}">${this.escape(t.name)}</option>`;
      });

      if (tests.length > 0) {
        this.onTestSelectChange(tests[0].id);
      }
    } catch (e) {
      console.error('Error loading test catalog options:', e);
    }
  }),

  onTestSelectChange: __async(function*(testId) {
    if (!testId) return;
    try {
      const res = yield fetch(`/api/config/tests/${testId}/parameters`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const params = yield res.json();

      const container = document.getElementById('test-parameters-container');
      const singleGroup = document.getElementById('single-result-group');

      if (params && params.length > 0) {
        singleGroup.style.display = 'none';
        container.style.display = 'block';

        let html = '<h5 style="color: var(--primary-color); margin-bottom: 8px; font-size: 0.85rem;">Panel Parameters:</h5>';
        params.forEach(p => {
          html += `
            <div style="display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr; gap: 8px; align-items: center; margin-bottom: 6px;" class="panel-param-row" data-param-id="${p.id}">
              <div><strong style="font-size: 0.85rem;">${this.escape(p.parameter_name)}</strong></div>
              <div><input type="text" class="param-val-input" placeholder="Result" style="padding: 4px 8px; font-size: 0.85rem;"></div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${p.ref_range ? `${this.escape(p.ref_range)} ${this.escape(p.unit || '')}` : ''}</div>
              <div><label style="font-size: 0.75rem; cursor:pointer;"><input type="checkbox" class="param-pos-check"> Abnormal</label></div>
            </div>
          `;
        });
        container.innerHTML = html;
      } else {
        container.style.display = 'none';
        container.innerHTML = '';
        singleGroup.style.display = 'block';
      }
    } catch (e) {
      console.error('Error loading test parameters:', e);
    }
  }),

  submitShiftAudit: __async(function*() {
    const dateStr = document.getElementById('log-date') ? document.getElementById('log-date').value : new Date().toISOString().split('T')[0];
    const sysTotal = parseInt(document.getElementById('sys-total-done').textContent, 10) || 0;
    const paperVal = parseInt(document.getElementById('paper-register-input').value, 10);

    if (isNaN(paperVal) || paperVal <= 0) {
      this.showNotificationModal("Error", 'Please type a valid Paper Register Total before submitting audit.', true);
      return;
    }

    try {
      const res = yield fetch('/api/daily-log/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: dateStr,
          paper_register_tally: paperVal,
          system_total: sysTotal
        })
      });

      if (res.ok) {
        const data = yield res.json();
        this.showNotificationModal('Audit Recorded', `Shift audit recorded: ${data.match} (System: ${sysTotal}, Register: ${paperVal})`, data.match !== 'MATCH');
      } else {
        this.showNotificationModal("Error", 'Failed to record shift audit.', true);
      }
    } catch (e) {
      this.showNotificationModal("Error", 'Error recording shift audit.', true);
    }
  }),

  loadWards: __async(function*() {
    try {
      const res = yield fetch('/api/config/wards?active_only=true');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const wards = yield res.json();
      const sel = document.getElementById('visit-ward');
      if (!sel) return;
      sel.innerHTML = '';
      if (wards.length === 0) {
        sel.innerHTML = '<option value="OPD">OPD</option>';
      } else {
        wards.forEach(w => {
          sel.innerHTML += `<option value="${this.escape(w.name)}">${this.escape(w.name)}</option>`;
        });
      }
    } catch (e) {
      console.error('Error loading wards', e);
    }
  }),

  loadClinicians: __async(function*() {
    try {
      const res = yield fetch('/api/config/clinicians');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const clinicians = yield res.json();
      const sel = document.getElementById('visit-clinician');
      if (!sel) return;
      sel.innerHTML = '<option value="">(None)</option>';
      clinicians.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${this.escape(c.name)}</option>`;
      });
    } catch (e) {
      console.error('Error loading clinicians', e);
    }
  }),

  loadSpecimens: __async(function*() {
    try {
      const res = yield fetch('/api/config/specimens');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const specimens = yield res.json();
      this.specimensList = specimens;
    } catch (e) {
      console.error('Error loading specimens', e);
    }
  }),

  loadTestOptionsMulti: __async(function*() {
    try {
      if (!this.sections) {
         try {
           const sres = yield fetch('/api/config/sections');
           if (sres.ok) this.sections = yield sres.json();
         } catch(e) { this.sections = []; }
      }
      const res = yield fetch('/api/config/tests');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const tests = yield res.json();
      
      this.testCatalog = tests;
      
      const container = document.getElementById('visit-tests-container');
      if (!container) return;
      
      let html = '<div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; background: #fff;">';
      
      const catSelect = document.getElementById('visit-test-section');
      if (catSelect && this.sections) {
        let catHtml = '<option value="all">All Sections</option>';
        this.sections.forEach(s => {
          catHtml += `<option value="${s.id}">${this.escape(s.name)}</option>`;
        });
        catSelect.innerHTML = catHtml;
      }
      
      tests.forEach(t => {
        if (!t.parent_rollup_id) {
          html += `
            <label class="visit-test-row" data-name="${this.escape(t.name).toLowerCase()}" data-category="${t.section_id}" style="display: block; margin-bottom: 4px; padding: 3px 6px; border-radius: 4px; cursor: pointer;">
              <input type="checkbox" name="visit-test-cb" value="${t.id}" data-test-name="${this.escape(t.name)}" onchange="app.updateSelectedTestsSummary()" onkeydown="app.handleVisitTestCheckboxKeyNav(event)">
              ${this.escape(t.name)}
            </label>
          `;
        }
      });
      html += '</div>';

      container.innerHTML = html;
      const searchInput = document.getElementById('visit-test-search');
      if (searchInput) {
        searchInput.onkeydown = (e) => app.handleVisitTestSearchKeyNav(e);
      }
      this.filterVisitTests();
      this.updateSelectedTestsSummary();
    } catch (e) {
      console.error('Error loading tests', e);
    }
  }),

  updateSelectedTestsSummary: function() {
    const checkboxes = document.querySelectorAll('input[name="visit-test-cb"]:checked');
    const countEl = document.getElementById('visit-selected-count');
    const barEl = document.getElementById('visit-selected-summary-bar');
    const chipsEl = document.getElementById('visit-selected-chips-container');
    
    if (countEl) {
      countEl.textContent = checkboxes.length + (checkboxes.length === 1 ? ' test selected' : ' tests selected');
    }
    
    if (!barEl || !chipsEl) return;
    
    if (checkboxes.length === 0) {
      barEl.style.display = 'none';
      chipsEl.innerHTML = '';
      return;
    }
    
    barEl.style.display = 'block';
    
    const currentSelections = {};
    document.querySelectorAll('.visit-test-specimen-select').forEach(sel => {
      const tid = sel.getAttribute('data-test-id');
      if (tid) currentSelections[tid] = sel.value;
    });

    let listHtml = '';
    checkboxes.forEach(cb => {
      const testId = cb.value;
      const testObj = (this.testCatalog || []).find(t => String(t.id) === String(testId));
      const testName = testObj ? testObj.name : (cb.getAttribute('data-test-name') || 'Test #' + testId);
      const compatList = (testObj && testObj.compatible_specimens && testObj.compatible_specimens.length > 0)
        ? testObj.compatible_specimens
        : ['Serum (Red Top)'];

      let optsHtml = '';
      if (this.specimensList && this.specimensList.length > 0) {
        const matchedSpecs = [];
        compatList.forEach(cName => {
          const found = this.specimensList.find(s => {
            const sn = s.name.toLowerCase();
            const cn = cName.toLowerCase();
            if (sn === cn) return true;
            if (cn.includes('edta') && sn.includes('edta')) return true;
            if (cn.includes('citrate') && sn.includes('citrate')) return true;
            if (cn.includes('urine') && sn.includes('urine')) return true;
            if ((cn.includes('stool') || cn.includes('feces')) && (sn.includes('stool') || sn.includes('feces'))) return true;
            if (cn.includes('sputum') && sn.includes('sputum')) return true;
            if (cn.includes('serum') && sn.includes('serum')) return true;
            if (cn.includes('fluoride') && (sn.includes('fluoride') || sn.includes('oxalate'))) return true;
            if (cn.includes('heparin') && sn.includes('heparin')) return true;
            if (cn.includes('capillary') && (sn.includes('capillary') || sn.includes('fingerstick'))) return true;
            if (cn.includes('swab') && sn.includes('swab')) return true;
            if (cn.includes('csf') && (sn.includes('csf') || sn.includes('cerebrospinal'))) return true;
            return false;
          });
          if (found && matchedSpecs.indexOf(found) === -1) {
            matchedSpecs.push(found);
          }
        });

        const available = matchedSpecs.length > 0 ? matchedSpecs : this.specimensList;
        const prevVal = currentSelections[testId];

        available.forEach((s, idx) => {
          const isSel = prevVal ? String(prevVal) === String(s.id) : (idx === 0);
          const containerDesc = s.container ? ` (${s.container.split('(')[0].trim()})` : '';
          optsHtml += `<option value="${s.id}" ${isSel ? 'selected' : ''}>${this.escape(s.name)}${this.escape(containerDesc)}</option>`;
        });
      }

      listHtml += `
        <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;" class="selected-test-order-row" data-test-id="${testId}">
          <div style="font-size: 0.88rem; font-weight: 600; color: #1E293B;">
            ${this.escape(testName)}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 0.78rem; font-weight: 600; color: #64748B; margin: 0;">Specimen:</label>
            <select class="visit-test-specimen-select" data-test-id="${testId}" style="padding: 5px 10px; font-size: 0.82rem; border: 1px solid #CBD5E1; border-radius: 4px; background: #fff; font-weight: 500; min-width: 220px;">
              ${optsHtml}
            </select>
          </div>
          <div>
            <button type="button" onclick="app.deselectTest(${testId})" style="background: none; border: none; color: #EF4444; font-size: 1.2rem; font-weight: bold; cursor: pointer; padding: 0 4px; line-height: 1;" title="Remove test">&times;</button>
          </div>
        </div>
      `;
    });
    chipsEl.innerHTML = listHtml;
  },

  deselectTest: function(testId) {
    const cb = document.querySelector('input[name="visit-test-cb"][value="' + testId + '"]');
    if (cb) {
      cb.checked = false;
    }
    this.updateSelectedTestsSummary();
  },

  clearAllSelectedTests: function() {
    document.querySelectorAll('input[name="visit-test-cb"]').forEach(cb => {
      cb.checked = false;
    });
    this.updateSelectedTestsSummary();
  },

  handleVisitTestSearchKeyNav: function(event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const firstVisible = Array.from(document.querySelectorAll('.visit-test-row')).find(function(r) { return r.style.display !== 'none'; });
      if (firstVisible) {
        event.preventDefault();
        const cb = firstVisible.querySelector('input[name="visit-test-cb"]');
        if (cb) cb.focus();
      }
    }
  },

  handleVisitTestCheckboxKeyNav: function(event) {
    const key = event.key;
    const currentCb = event.target;
    const currentRow = currentCb.closest('.visit-test-row');
    const allVisibleRows = Array.from(document.querySelectorAll('.visit-test-row')).filter(function(r) { return r.style.display !== 'none'; });
    const curIdx = allVisibleRows.indexOf(currentRow);

    if (key === 'ArrowDown') {
      if (curIdx >= 0 && curIdx < allVisibleRows.length - 1) {
        event.preventDefault();
        const nextCb = allVisibleRows[curIdx + 1].querySelector('input[name="visit-test-cb"]');
        if (nextCb) nextCb.focus();
      }
    } else if (key === 'ArrowUp') {
      if (curIdx > 0) {
        event.preventDefault();
        const prevCb = allVisibleRows[curIdx - 1].querySelector('input[name="visit-test-cb"]');
        if (prevCb) prevCb.focus();
      } else {
        const searchInput = document.getElementById('visit-test-search');
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    } else if ((event.ctrlKey || event.metaKey) && key === 'Enter') {
      event.preventDefault();
      if (this.currentClientId) {
        this.createVisit(this.currentClientId);
      }
    }
  },

  filterVisitTests: function() {
    const searchInput = document.getElementById('visit-test-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const cat = document.getElementById('visit-test-section') ? document.getElementById('visit-test-section').value : 'all';
    const rows = document.querySelectorAll('.visit-test-row');
    rows.forEach(row => {
      const nameMatch = row.getAttribute('data-name').includes(query);
      const catMatch = (cat === 'all' || row.getAttribute('data-category') === cat);
      if (nameMatch && catMatch) {
        row.style.display = 'block';
      } else {
        row.style.display = 'none';
      }
    });
  },
  createVisit: __async(function*(pid) {
    const ward = document.getElementById('visit-ward') ? document.getElementById('visit-ward').value.trim() : '';
    const clinician = document.getElementById('visit-clinician') ? document.getElementById('visit-clinician').value : '';
    const orderCat = document.getElementById('visit-order-category') ? document.getElementById('visit-order-category').value : 'in-house';
    
    if (!ward) {
      this.showNotificationModal("Validation Error", 'Ward of origin is required.', true);
      return;
    }
    if (!clinician) {
      this.showNotificationModal("Validation Error", 'Requesting clinician is required.', true);
      return;
    }
    
    const specimenSelects = document.querySelectorAll('.visit-test-specimen-select');
    if (specimenSelects.length === 0) {
      this.showNotificationModal("Validation Error", 'Please select at least one test to order.', true);
      return;
    }

    const testOrders = [];
    const testIds = [];
    const specimenTypeIds = [];
    let hasMissingSpecimen = false;

    specimenSelects.forEach(sel => {
      const tid = parseInt(sel.getAttribute('data-test-id'), 10);
      const sid = parseInt(sel.value, 10);
      if (isNaN(sid) || !sid) {
        hasMissingSpecimen = true;
      }
      testOrders.push({ test_id: tid, specimen_type_id: sid });
      testIds.push(tid);
      if (specimenTypeIds.indexOf(sid) === -1) specimenTypeIds.push(sid);
    });

    if (hasMissingSpecimen) {
      this.showNotificationModal("Specimen Required", "Please ensure an accredited specimen is selected for every test.", true);
      return;
    }
    
    try {
      const payload = {
        client_id: pid,
        ward_of_origin: ward,
        clinician_id: parseInt(clinician, 10),
        specimen_type_id: specimenTypeIds[0],
        specimen_type_ids: specimenTypeIds,
        test_ids: testIds,
        test_orders: testOrders,
        order_category: orderCat
      };
      
      const res = yield fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        this.saveClientVisitPrefs(pid);
        this.showNotificationModal("Success", 'Visit and orders created successfully!', false);
        this.clearAllSelectedTests();
        yield this.loadPendingTests(pid);
        yield this.loadHistoricalVisits(pid);
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", (err && err.detail) ? err.detail : 'Failed to create visit.', true);
      }
    } catch(e) {
      this.showNotificationModal("Error", 'Error creating visit.', true);
    }
  }),
  loadPendingTests: __async(function*(pid) {
    const container = document.getElementById('pending-tests-container');
    if (!container) return;
    try {
      const res = yield fetch(`/api/clients/${pid}/orders`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const orders = yield res.json();
      const pending = orders.filter(o => o.status === 'pending');
      
      if (pending.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);">No pending tests.</div>';
        return;
      }
      
      let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 0.85rem; color: var(--text-muted);">${pending.length} pending test(s)</span>
          <button id="btn-bulk-delete-orders" class="btn btn-danger btn-sm" style="display: none;" onclick="app.bulkDeleteOrders()">
            Remove Selected (<span id="selected-orders-count">0</span>)
          </button>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="width:36px; text-align:center; padding:8px; border-bottom:1px solid #ddd;">
                <input type="checkbox" id="select-all-pending-tests" onchange="app.toggleSelectAllPendingOrders(this.checked)">
              </th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Test</th>
              <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Ordered At</th>
              <th style="text-align:right; padding:8px; border-bottom:1px solid #ddd;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;
      pending.forEach(o => {
            const resValStr = (o.results && o.results.length > 0) ? (o.results[0].result_value || '') : '';
            const resUnitStr = (o.results && o.results.length > 0 && o.results[0].result_unit) ? o.results[0].result_unit : '';
            html += `
              <tr>
                <td style="text-align:center; padding:8px; border-bottom:1px solid #ddd;">
                  <input type="checkbox" class="pending-order-checkbox" value="${o.order_id}" onchange="app.onPendingOrderSelectionChange()">
                </td>
                <td style="padding:8px; border-bottom:1px solid #ddd;"><strong>${this.escape(o.test_name)}</strong><br><small style="color:var(--text-muted);">Order ID: ${o.order_id}</small></td>
                <td style="padding:8px; border-bottom:1px solid #ddd;">${o.ordered_at}</td>
                <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">
                  <button type="button" class="btn btn-primary btn-sm btn-pending-order-action" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="${this.escape(resValStr)}" data-existing-unit="${this.escape(resUnitStr)}" data-visit-id="${o.visit_id || ''}">
                    ${o.results && o.results.length > 0 ? 'Edit Result' : 'Enter Result'}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm btn-pending-order-remove" data-order-id="${o.order_id}">Remove</button>
                </td>
              </tr>
            `;
          });
          html += '</tbody></table>';
          container.innerHTML = html;

          const self = this;
          container.querySelectorAll('.btn-pending-order-action').forEach(btn => {
            btn.onclick = function() {
              const oId = parseInt(this.getAttribute('data-order-id'), 10);
              const tId = parseInt(this.getAttribute('data-test-id'), 10);
              const tName = this.getAttribute('data-test-name') || '';
              const exVal = this.getAttribute('data-existing-val') || '';
              const exUnit = this.getAttribute('data-existing-unit') || '';
              const vId = parseInt(this.getAttribute('data-visit-id'), 10) || null;
              self.showEnterResultModal(oId, tId, tName, exVal, exUnit, vId);
            };
          });
          container.querySelectorAll('.btn-pending-order-remove').forEach(btn => {
            btn.onclick = function() {
              const oId = parseInt(this.getAttribute('data-order-id'), 10);
              self.removeOrder(oId);
            };
          });
        } catch (e) {
      console.error(e);
      container.innerHTML = 'Error loading pending tests.';
    }
  }),

  toggleSelectAllPendingOrders: function(checked) {
    const checkboxes = document.querySelectorAll('.pending-order-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    this.onPendingOrderSelectionChange();
  },

  onPendingOrderSelectionChange: function() {
    const selected = document.querySelectorAll('.pending-order-checkbox:checked');
    const all = document.querySelectorAll('.pending-order-checkbox');
    const selectAllCb = document.getElementById('select-all-pending-tests');
    if (selectAllCb) {
      selectAllCb.checked = all.length > 0 && selected.length === all.length;
    }
    const btn = document.getElementById('btn-bulk-delete-orders');
    const countSpan = document.getElementById('selected-orders-count');
    if (btn && countSpan) {
      countSpan.textContent = selected.length;
      btn.style.display = selected.length > 0 ? 'inline-block' : 'none';
    }
  },

  bulkDeleteOrders: __async(function*() {
    const selected = Array.from(document.querySelectorAll('.pending-order-checkbox:checked')).map(cb => parseInt(cb.value, 10));
    if (selected.length === 0) return;

    this.confirmAction(
      "Remove Pending Tests",
      `Are you sure you want to remove ${selected.length} selected pending test order(s)?`,
      __async(function*() {
        try {
          const res = yield fetch('/api/orders/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_ids: selected })
          });
          if (res.ok) {
            const data = yield res.json();
            app.showNotificationModal("Success", `Removed ${data.deleted_order_ids.length} test order(s).`, false);
            if (app.currentClientId) {
              yield app.loadPendingTests(app.currentClientId);
            }
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to remove test orders.", true);
          }
        } catch(e) {
          console.error(e);
          app.showNotificationModal("Error", "Server error.", true);
        }
      })
    );
  }),

  loadHistoricalVisits: __async(function*(pid) {
    const container = document.getElementById('historical-visits-container');
    if (!container) return;
    try {
      const res = yield fetch(`/api/clients/${pid}/visits`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const visits = yield res.json();
      if (visits.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);">No historical visits found.</div>';
        return;
      }

      if (!localStorage.getItem('mlis_client_' + pid + '_visit_pref') && visits.length > 0) {
        const lastV = visits[0];
        if (lastV.ward_of_origin) {
          const wardEl = document.getElementById('visit-ward');
          if (wardEl && !wardEl.value) wardEl.value = lastV.ward_of_origin;
        }
        if (lastV.clinician_id) {
          const clinEl = document.getElementById('visit-clinician');
          if (clinEl && !clinEl.value) clinEl.value = String(lastV.clinician_id);
        }
        this.saveClientVisitPrefs(pid);
      }
      
      const isAdmin = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
      const totalUnverifiedVisits = visits.filter(v => v.unverified_count && v.unverified_count > 0).length;
      let html = '';
      if (totalUnverifiedVisits > 0) {
        html += `
          <div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 0.875rem; max-width: 800px;">
            <strong>Notice:</strong> ${totalUnverifiedVisits} visit(s) contain entered results awaiting Administrator verification.
          </div>
        `;
      }
      if (isAdmin) {
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; width: 100%; max-width: 800px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer; font-weight: 600;">
              <input type="checkbox" id="select-all-visits" onchange="app.toggleSelectAllVisits(this.checked)"> Select All Visits
            </label>
            <button id="btn-bulk-delete-visits" class="btn btn-danger btn-sm" style="display: none;" onclick="app.bulkDeleteVisits()">
              Delete Selected (<span id="selected-visits-count">0</span>)
            </button>
          </div>
        `;
      }
      visits.forEach(v => {
        const labNumStr = v.lab_number ? `(${this.escape(v.lab_number)})` : '(Pending Lab No)';
        const hasUnverified = v.unverified_count && v.unverified_count > 0;
        const hasSavedResults = (v.completed_count && v.completed_count > 0) || hasUnverified;
        const isVerified = (v.completed_count && v.completed_count > 0) && !hasUnverified;
        const isDispatched = !!v.dispatched_at;

        let dispatchBadge = '';
        if (isDispatched) {
          const dTime = v.dispatched_at.substring(0, 16);
          const dTo = v.dispatched_to ? ` to ${this.escape(v.dispatched_to)}` : '';
          dispatchBadge = ` <span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Dispatched (${dTime}${dTo})</span>`;
        }

        const statusBadge = hasUnverified 
          ? ` [Unverified]`
          : (hasSavedResults ? ` [Verified]` : '');

        if (isAdmin) {
          const verifyBtn = hasUnverified 
            ? `<button class="btn btn-primary btn-sm" style="background:#0284c7; border-color:#0284c7; font-weight:600; width:100%;" onclick="app.openEditVisitModal(${v.visit_id})" title="Inspect and verify test results">Verify Results</button>`
            : `<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="app.openEditVisitModal(${v.visit_id})">Edit / Review</button>`;
          
          const visitClick = hasSavedResults 
            ? `app.viewReport(${v.visit_id})` 
            : `app.openEditVisitModal(${v.visit_id})`;

          let dispatchActionBtn = '';
          if (isVerified) {
            if (isDispatched) {
              dispatchActionBtn = `<button class="btn btn-secondary btn-sm" style="padding: 4px 6px; font-size: 0.75rem;" onclick="app.revertDispatch(${v.visit_id})" title="Revert report dispatch">Revert Disp.</button>`;
            } else {
              dispatchActionBtn = `<button class="btn btn-success btn-sm" style="padding: 4px 6px; font-size: 0.75rem; font-weight: 600;" onclick="app.dispatchVisit(${v.visit_id})" title="Record report dispatch / collection">Dispatch</button>`;
            }
          }

          html += `<div style="display: grid; grid-template-columns: 36px 3.2fr 1.2fr 1.1fr 0.9fr 0.8fr; gap: 6px; align-items: center; margin-bottom: 8px; width: 100%; max-width: 860px;">
                    <div style="text-align: center;">
                      <input type="checkbox" class="visit-checkbox" value="${v.visit_id}" onchange="app.onVisitSelectionChange()">
                    </div>
                    <button class="btn btn-secondary btn-sm" style="text-align: left; display: flex; align-items: center; justify-content: space-between;" onclick="${visitClick}">
                      <span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchBadge}</span>
                      ${statusBadge}
                    </button>
                    ${verifyBtn}
                    ${dispatchActionBtn ? dispatchActionBtn : '<div></div>'}
                    <button class="btn btn-primary btn-sm" onclick="app.showAddTestModal(${v.visit_id})">Add Tests</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteVisit(${v.visit_id})">Delete</button>
                   </div>`;
        } else {
          const reportBtn = hasSavedResults && !hasUnverified
            ? `<button class="btn btn-secondary btn-sm" style="text-align: left; display: flex; align-items: center; justify-content: space-between;" onclick="app.viewReport(${v.visit_id})"><span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchBadge}</span> ${statusBadge}</button>`
            : `<button class="btn btn-secondary btn-sm" style="text-align: left; color: #b45309; font-weight: 500; display: flex; align-items: center; justify-content: space-between;" onclick="app.openEditVisitModal(${v.visit_id})" title="Click to view and inspect results"><span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchBadge}</span> ${statusBadge}</button>`;
          
          let dispatchActionBtn = '';
          if (isVerified) {
            if (isDispatched) {
              dispatchActionBtn = `<button class="btn btn-secondary btn-sm" style="padding: 4px 6px; font-size: 0.75rem;" onclick="app.revertDispatch(${v.visit_id})">Revert Disp.</button>`;
            } else {
              dispatchActionBtn = `<button class="btn btn-success btn-sm" style="padding: 4px 6px; font-size: 0.75rem; font-weight: 600;" onclick="app.dispatchVisit(${v.visit_id})">Dispatch</button>`;
            }
          }

          const staffCols = !hasSavedResults ? '3.2fr 1.2fr 1.1fr 0.8fr' : '3.2fr 1.2fr 1.1fr';
          const deleteBtn = !hasSavedResults ? `<button class="btn btn-danger btn-sm" onclick="app.deleteVisit(${v.visit_id})">Delete</button>` : '';
          html += `<div style="display: grid; grid-template-columns: ${staffCols}; gap: 6px; margin-bottom: 8px; width: 100%; max-width: 860px;">
                    ${reportBtn}
                    ${dispatchActionBtn ? dispatchActionBtn : `<button class="btn btn-secondary btn-sm" onclick="app.openEditVisitModal(${v.visit_id})">View Details</button>`}
                    <button class="btn btn-primary btn-sm" onclick="app.showAddTestModal(${v.visit_id})">Add Tests</button>
                    ${deleteBtn}
                   </div>`;
        }
      });
      container.innerHTML = html;
    } catch(e) {
      console.error(e);
      container.innerHTML = 'Error loading visits.';
    }
  }),

  toggleSelectAllVisits: function(checked) {
    const checkboxes = document.querySelectorAll('.visit-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
    this.onVisitSelectionChange();
  },

  onVisitSelectionChange: function() {
    const selected = document.querySelectorAll('.visit-checkbox:checked');
    const btn = document.getElementById('btn-bulk-delete-visits');
    const countSpan = document.getElementById('selected-visits-count');
    const selectAllCb = document.getElementById('select-all-visits');
    const allCheckboxes = document.querySelectorAll('.visit-checkbox');

    if (btn && countSpan) {
      countSpan.textContent = selected.length;
      btn.style.display = selected.length > 0 ? 'inline-block' : 'none';
    }
    if (selectAllCb && allCheckboxes.length > 0) {
      selectAllCb.checked = selected.length === allCheckboxes.length;
    }
  },

  bulkDeleteVisits: function() {
    const selected = Array.from(document.querySelectorAll('.visit-checkbox:checked')).map(cb => parseInt(cb.value));
    if (selected.length === 0) return;

    this.confirmAction(
      "Delete Selected Visits",
      `Are you sure you want to delete ${selected.length} visit(s)? Associated test orders and results will be removed.`,
      __async(function*() {
        try {
          const res = yield fetch('/api/visits/bulk', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visit_ids: selected })
          });
          if (res.ok) {
            const data = yield res.json();
            const deleted = data.deleted_visit_ids || [];
            app.showNotificationModal("Success", `Successfully deleted ${deleted.length} visit(s).`, false);
            if (app.currentClientId) {
              yield app.loadHistoricalVisits(app.currentClientId);
              yield app.loadPendingTests(app.currentClientId);
            }
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to delete selected visits.", true);
          }
        } catch(e) {
          console.error(e);
          app.showNotificationModal("Error", "Server error.", true);
        }
      })
    );
  },

  deleteVisit: function(visitId) {
    this.confirmAction(
      "Delete Visit",
      `Are you sure you want to delete this visit? All associated test orders and results will be removed. This action cannot be undone.`,
      __async(function*() {
        try {
          const res = yield fetch(`/api/visits/${visitId}`, { method: 'DELETE' });
          if (res.ok) {
            app.showNotificationModal("Success", "Visit deleted successfully.", false);
            if (app.currentClientId) {
              yield app.loadHistoricalVisits(app.currentClientId);
              yield app.loadPendingTests(app.currentClientId);
            }
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to delete visit.", true);
          }
        } catch(e) {
          console.error(e);
          app.showNotificationModal("Error", "Server error.", true);
        }
      })
    );
  },

  viewReport: function(visitId) {
    const frame = document.getElementById('report-frame');
    if (frame) {
      frame.style.display = 'block';
      frame.src = `/api/reports/visit/${visitId}/pdf`;
    }
  },

  verifySingleOrder: __async(function*(orderId, visitId) {
    try {
      const res = yield fetch('/api/clients/orders/' + orderId + '/verify', { method: 'POST' });
      if (!res.ok) {
        const err = yield res.json();
        app.showNotificationModal("Error", err.detail || "Failed to verify test result.", true);
        return;
      }
      if (visitId) {
        yield app.openEditVisitModal(visitId);
      }
      if (app.currentClientId) {
        yield app.loadHistoricalVisits(app.currentClientId);
      }
    } catch(e) {
      console.error(e);
      app.showNotificationModal("Error", "Connection error verifying test result.", true);
    }
  }),

  verifyVisitResults: __async(function*(visitId) {
    this.confirmAction(
      "Verify Visit Results",
      "Are you sure you want to verify and release all entered results for this visit?",
      __async(function*() {
        try {
          const res = yield fetch('/api/clients/visits/' + visitId + '/verify', { method: 'POST' });
          if (!res.ok) {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to verify results.", true);
            return;
          }
          app.showNotificationModal("Success", "All results successfully verified and released for printing.", false);
          if (app.currentClientId) {
            yield app.loadHistoricalVisits(app.currentClientId);
          }
          const editModal = document.getElementById('edit-visit-modal');
          if (editModal && editModal.style.display === 'flex') {
            yield app.openEditVisitModal(visitId);
          }
        } catch(e) {
          app.showNotificationModal("Error", "Connection error verifying results.", true);
        }
      })
    );
  }),

  dispatchVisit: __async(function*(visitId) {
    const recipient = prompt("Enter recipient for report dispatch (e.g. Patient, Ward Nurse, OPD, Clinician):", "Patient / Ward");
    if (recipient === null) return;
    try {
      const res = yield fetch(`/api/visits/${visitId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatched_to: recipient || 'Patient / Ward' })
      });
      if (res.ok) {
        this.showNotificationModal("Success", `Report dispatched to ${recipient || 'Patient / Ward'}!`, false);
        if (this.currentClientId) {
          yield this.loadHistoricalVisits(this.currentClientId);
        }
        const editModal = document.getElementById('edit-visit-modal');
        if (editModal && editModal.style.display === 'flex') {
          yield this.openEditVisitModal(visitId);
        }
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to dispatch report.", true);
      }
    } catch (e) {
      this.showNotificationModal("Error", "Connection error dispatching report.", true);
    }
  }),

  revertDispatch: __async(function*(visitId) {
    this.confirmAction(
      "Revert Report Dispatch",
      "Are you sure you want to revert the dispatch status for this report?",
      __async(function*() {
        try {
          const res = yield fetch(`/api/visits/${visitId}/dispatch`, { method: 'DELETE' });
          if (res.ok) {
            app.showNotificationModal("Success", "Report dispatch reverted successfully.", false);
            if (app.currentClientId) {
              yield app.loadHistoricalVisits(app.currentClientId);
            }
            const editModal = document.getElementById('edit-visit-modal');
            if (editModal && editModal.style.display === 'flex') {
              yield app.openEditVisitModal(visitId);
            }
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", err.detail || "Failed to revert dispatch.", true);
          }
        } catch (e) {
          app.showNotificationModal("Error", "Connection error reverting dispatch.", true);
        }
      })
    );
  }),

  updateEditAgePlaceholder: function() {
    const cat = document.getElementById('edit-client-category').value;
    const ageInput = document.getElementById('edit-client-age');
    if (!ageInput) return;
    if (cat === 'Neonate') ageInput.placeholder = "e.g. 14d or 14/365";
    else if (cat === 'Infant') ageInput.placeholder = "e.g. 6m or 11/12";
    else if (cat === 'Toddler') ageInput.placeholder = "e.g. 2y or 1 6/12";
    else if (cat === 'Child') ageInput.placeholder = "e.g. 8, 8y";
    else ageInput.placeholder = "e.g. 25, 25y";
  },

  openEditClientModal: __async(function*(clientId) {
    try {
      const res = yield fetch(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      const data = yield res.json();
      
      const idEl = document.getElementById('edit-client-id');
      if (idEl) idEl.value = data.id;
      const numEl = document.getElementById('edit-client-number');
      if (numEl) numEl.value = data.client_number || '';
      const nameEl = document.getElementById('edit-client-name');
      if (nameEl) nameEl.value = data.full_name || '';
      const sexEl = document.getElementById('edit-client-sex');
      if (sexEl) sexEl.value = data.sex || 'Male';
      
      const phoneInput = document.getElementById('edit-client-phone');
      if (phoneInput) phoneInput.value = data.phone || '';
      
      const catSelect = document.getElementById('edit-client-category');
      const ageInput = document.getElementById('edit-client-age');
      
      if (catSelect && ageInput) {
        catSelect.value = data.age_category || 'Adult';
        this.updateEditAgePlaceholder();
        ageInput.value = data.age_display || (data.age_years != null ? String(data.age_years) : '');
      }
      
      this.openModal('edit-client-modal');
    } catch(e) {
      console.error(e);
      this.showNotificationModal("Error", "Could not load client details.", true);
    }
  }),

  submitEditClient: __async(function*(e) {
    e.preventDefault();
    const id = document.getElementById('edit-client-id').value;
    const name = document.getElementById('edit-client-name').value.trim();
    const sex = document.getElementById('edit-client-sex').value;
    const phone = document.getElementById('edit-client-phone') ? document.getElementById('edit-client-phone').value.trim() : null;
    const ageCategory = document.getElementById('edit-client-category') ? document.getElementById('edit-client-category').value : 'Adult';
    const ageRaw = document.getElementById('edit-client-age') ? document.getElementById('edit-client-age').value.trim() : null;

    try {
      const res = yield fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          sex: sex,
          phone: phone,
          age_category: ageCategory,
          age_raw: ageRaw,
          age_string: ageRaw
        })
      });

      if (res.ok) {
        const updated = yield res.json();
        this.closeModal('edit-client-modal');
        this.showNotificationModal("Success", "Client details updated successfully.", false);
        const searchInput = document.getElementById('client-search-input');
        const q = searchInput ? searchInput.value : '';
        yield this.searchClients(q);
        yield this.selectClient(updated.id, updated.client_number, updated.full_name, updated.sex);
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to update client.", true);
      }
    } catch(e) {
      console.error(e);
      this.showNotificationModal("Error", "Server connection error.", true);
    }
  }),

  openEditVisitModal: __async(function*(visitId) {
    try {
      const res = yield fetch(`/api/visits/${visitId}`);
      if (!res.ok) throw new Error("Failed to fetch visit");
      const data = yield res.json();

      document.getElementById('edit-visit-id').value = data.visit_id;
      
      // Populate wards dropdown
      const wardSelect = document.getElementById('edit-visit-ward');
      wardSelect.innerHTML = '';
      try {
        const wRes = yield fetch('/api/config/wards');
        const wards = yield wRes.json();
        wards.forEach(w => {
          const opt = document.createElement('option');
          opt.value = w.name;
          opt.textContent = w.name;
          wardSelect.appendChild(opt);
        });
      } catch(e) {}
      wardSelect.value = data.ward_of_origin;

      // Populate clinicians dropdown
      const clinSelect = document.getElementById('edit-visit-clinician');
      clinSelect.innerHTML = '<option value="">-- None --</option>';
      try {
        const cRes = yield fetch('/api/config/clinicians');
        const clins = yield cRes.json();
        clins.forEach(cl => {
          const opt = document.createElement('option');
          opt.value = cl.id;
          opt.textContent = cl.name;
          clinSelect.appendChild(opt);
        });
      } catch(e) {}
      clinSelect.value = data.clinician_id || '';
      
      // Set order category — use first order's category as current value
      const catSelect = document.getElementById('edit-visit-order-category');
      if (data.orders && data.orders.length > 0 && data.orders[0].order_category) {
        catSelect.value = data.orders[0].order_category;
      } else {
        catSelect.value = 'in-house';
      }

      // Render tests in this visit with current results and Edit Result action
      const ordersList = document.getElementById('edit-visit-orders-list');
      if (ordersList) {
        if (!data.orders || data.orders.length === 0) {
          ordersList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:12px;">No tests attached to this visit.</div>';
        } else {
          const isAdmin = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
          const hasUnverified = data.orders.some(o => o.status === 'entered');
          let oHtml = '';
          const allCompleted = data.orders.length > 0 && data.orders.every(o => o.status === 'completed');
          const isDispatched = !!data.dispatched_at;

          if (allCompleted) {
            if (isDispatched) {
              const dTime = data.dispatched_at.substring(0, 16);
              const dTo = data.dispatched_to ? ` to ${this.escape(data.dispatched_to)}` : '';
              const dBy = data.dispatched_by_name ? ` by ${this.escape(data.dispatched_by_name)}` : '';
              oHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 0.875rem;">
                  <div><strong>Report Dispatched:</strong> Handed over on ${dTime}${dTo}${dBy}.</div>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.8rem;" onclick="app.revertDispatch(${visitId})">Revert Dispatch</button>
                </div>
              `;
            } else {
              oHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 0.875rem;">
                  <div><strong>Quality Verification Complete:</strong> All tests verified and released. Ready for dispatch / collection.</div>
                  <button type="button" class="btn btn-success btn-sm" style="background:#15803d; border-color:#15803d; white-space:nowrap; padding:5px 12px; font-weight:600;" onclick="app.dispatchVisit(${visitId})">Record Report Dispatch</button>
                </div>
              `;
            }
          } else if (isAdmin && hasUnverified) {
            oHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 0.875rem;">
                <div><strong>Quality Review:</strong> Inspect test results below. Click <em>Verify</em> per test or <em>Verify All</em>.</div>
                <button type="button" class="btn btn-primary btn-sm" style="background:#0284c7; border-color:#0284c7; white-space:nowrap; padding:5px 12px;" onclick="app.verifyVisitResults(${visitId})">Verify All Results</button>
              </div>
            `;
          }
          oHtml += '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">';
          oHtml += '<thead><tr style="border-bottom:2px solid #e2e8f0; color:var(--text-muted); text-align:left; background:#f8fafc;"><th style="padding:8px 10px;">Test Name</th><th style="padding:8px 10px;">Section</th><th style="padding:8px 10px;">Ref. Range</th><th style="padding:8px 10px;">Result Value</th><th style="padding:8px 10px;">Technician / Time</th><th style="padding:8px 10px;">Status</th><th style="padding:8px 10px; text-align:right;">Actions</th></tr></thead><tbody>';
          data.orders.forEach(o => {
            const hasResult = o.results && o.results.length > 0;
            let resVal = '<span style="color:var(--text-muted);">—</span>';
            if (hasResult) {
              if (o.results.length > 1) {
                resVal = '<div style="display:flex; flex-direction:column; gap:2px; font-size:0.82rem;">' + o.results.map(r => {
                  let flagBadge = '';
                  if (r.clinical_flag) {
                    const isCrit = r.clinical_flag.indexOf('*') !== -1;
                    const flagColor = isCrit ? '#dc2626' : (r.clinical_flag === 'L' || r.clinical_flag === 'H' ? '#ea580c' : '#dc2626');
                    const flagText = r.clinical_flag === '\u26A0' ? '\u26A0' : `[${r.clinical_flag}]`;
                    flagBadge = ` <span style="font-weight:700; color:${flagColor};">${this.escape(flagText)}</span>`;
                  } else if (r.is_positive) {
                    flagBadge = ' <span style="font-weight:700; color:#dc2626;">\u26A0</span>';
                  }
                  return `<div><strong>${this.escape(r.parameter_name || 'Param')}:</strong> ${this.escape(r.result_value || '—')} ${r.result_unit ? this.escape(r.result_unit) : ''}${flagBadge}</div>`;
                }).join('') + '</div>';
              } else {
                const r = o.results[0];
                const unitStr = r.result_unit ? ` ${this.escape(r.result_unit)}` : '';
                let flagBadge = '';
                if (r.clinical_flag) {
                  const isCrit = r.clinical_flag.indexOf('*') !== -1;
                  const flagColor = isCrit ? '#dc2626' : (r.clinical_flag === 'L' || r.clinical_flag === 'H' ? '#ea580c' : '#dc2626');
                  const flagText = r.clinical_flag === '\u26A0' ? '\u26A0' : `[${r.clinical_flag}]`;
                  flagBadge = ` <span style="font-weight:700; color:${flagColor};">${this.escape(flagText)}</span>`;
                } else if (r.is_positive) {
                  flagBadge = ' <span style="font-weight:700; color:#dc2626;">\u26A0</span>';
                }
                resVal = `<strong>${this.escape(r.result_value || 'Completed')}</strong>${unitStr}${flagBadge}`;
              }
            }
            const refRangeText = this.escape(o.ref_range || (o.results && o.results[0] && o.results[0].ref_range) || '—');
            const techName = hasResult && o.results[0].entered_by_name ? this.escape(o.results[0].entered_by_name) : '—';
            const techTime = hasResult && o.results[0].entered_at ? o.results[0].entered_at.substring(0, 16) : '';
            const techInfo = hasResult ? `${techName}<small style="display:block; color:var(--text-muted); font-size:0.75rem;">${techTime}</small>` : '—';

            let statusText = '<span style="color:var(--text-muted);">Pending Entry</span>';
            if (o.status === 'entered') {
              statusText = '<span style="color:#d97706; font-weight:600; font-size:0.8rem;">Entered (Unverified)</span>';
            } else if (o.status === 'completed') {
              const verifier = hasResult && o.results[0].verified_by_name ? `<small style="display:block; color:var(--text-muted); font-size:0.75rem;">by ${this.escape(o.results[0].verified_by_name)}</small>` : '';
              statusText = `<span style="color:#16a34a; font-weight:600; font-size:0.8rem;">Verified</span>${verifier}`;
            }

            let actionBtns = '';
            const existingValStr = hasResult ? (o.results[0].result_value || '') : '';
            const existingUnitStr = (hasResult && o.results[0].result_unit) ? o.results[0].result_unit : '';

            if (isAdmin) {
              if (o.status === 'entered') {
                actionBtns = `
                  <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button type="button" class="btn btn-success btn-sm btn-verify-order" style="padding:4px 8px; font-weight:600; font-size:0.78rem;" data-order-id="${o.order_id}" data-visit-id="${visitId}">Verify</button>
                    <button type="button" class="btn btn-secondary btn-sm btn-edit-order-res" style="padding:4px 8px; font-size:0.78rem;" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="${this.escape(existingValStr)}" data-existing-unit="${this.escape(existingUnitStr)}" data-visit-id="${visitId}">Edit</button>
                  </div>
                `;
              } else if (o.status === 'completed') {
                actionBtns = `<button type="button" class="btn btn-secondary btn-sm btn-edit-order-res" style="padding:4px 8px; font-size:0.78rem;" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="${this.escape(existingValStr)}" data-existing-unit="${this.escape(existingUnitStr)}" data-visit-id="${visitId}">Edit</button>`;
              } else {
                actionBtns = `<button type="button" class="btn btn-primary btn-sm btn-edit-order-res" style="padding:4px 8px; font-size:0.78rem;" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="" data-existing-unit="" data-visit-id="${visitId}">Enter</button>`;
              }
            } else {
              if (o.status === 'pending') {
                actionBtns = `<button type="button" class="btn btn-primary btn-sm btn-edit-order-res" style="padding:4px 8px; font-size:0.78rem;" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="" data-existing-unit="" data-visit-id="${visitId}">Enter</button>`;
              } else {
                actionBtns = `<button type="button" class="btn btn-secondary btn-sm btn-edit-order-res" style="padding:4px 8px; font-size:0.78rem;" data-order-id="${o.order_id}" data-test-id="${o.test_id}" data-test-name="${this.escape(o.test_name)}" data-existing-val="${this.escape(existingValStr)}" data-existing-unit="${this.escape(existingUnitStr)}" data-visit-id="${visitId}">Edit</button>`;
              }
            }

            oHtml += `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 10px;"><strong>${this.escape(o.test_name)}</strong></td>
                <td style="padding:8px 10px; color:var(--text-muted); font-size:0.82rem;">${this.escape(o.section_name || '—')}</td>
                <td style="padding:8px 10px; color:var(--text-muted); font-size:0.82rem;">${refRangeText}</td>
                <td style="padding:8px 10px;">${resVal}</td>
                <td style="padding:8px 10px; font-size:0.82rem;">${techInfo}</td>
                <td style="padding:8px 10px;">${statusText}</td>
                <td style="padding:8px 10px; text-align:right;">${actionBtns}</td>
              </tr>
            `;
          });
          oHtml += '</tbody></table>';
          ordersList.innerHTML = oHtml;

          const self = this;
          ordersList.querySelectorAll('.btn-verify-order').forEach(btn => {
            btn.onclick = function() {
              const oId = parseInt(this.getAttribute('data-order-id'), 10);
              const vId = parseInt(this.getAttribute('data-visit-id'), 10);
              self.verifySingleOrder(oId, vId);
            };
          });
          ordersList.querySelectorAll('.btn-edit-order-res').forEach(btn => {
            btn.onclick = function() {
              const oId = parseInt(this.getAttribute('data-order-id'), 10);
              const tId = parseInt(this.getAttribute('data-test-id'), 10);
              const tName = this.getAttribute('data-test-name') || '';
              const exVal = this.getAttribute('data-existing-val') || '';
              const exUnit = this.getAttribute('data-existing-unit') || '';
              const vId = parseInt(this.getAttribute('data-visit-id'), 10) || null;
              self.showEnterResultModal(oId, tId, tName, exVal, exUnit, vId);
            };
          });
        }
      }
      
      this.openModal('edit-visit-modal');
    } catch(e) {
      console.error(e);
      this.showNotificationModal("Error", "Could not load visit details.", true);
    }
  }),

  submitEditVisit: __async(function*(e) {
    e.preventDefault();
    const visitId = document.getElementById('edit-visit-id').value;
    const ward = document.getElementById('edit-visit-ward').value;
    const clinicianId = document.getElementById('edit-visit-clinician').value;
    const orderCat = document.getElementById('edit-visit-order-category').value;

    try {
      const res = yield fetch(`/api/visits/${visitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ward_of_origin: ward,
          clinician_id: clinicianId ? parseInt(clinicianId, 10) : null,
          order_category: orderCat
        })
      });
      if (res.ok) {
        this.showNotificationModal("Success", "Visit details updated successfully.", false);
        this.closeModal('edit-visit-modal');
        if (this.currentClientId) {
          yield this.loadHistoricalVisits(this.currentClientId);
        }
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to update visit.", true);
      }
    } catch(err) {
      this.showNotificationModal("Error", "Connection error.", true);
    }
  }),

  showAddTestModal: __async(function*(visitId) {
    document.getElementById('add-test-visit-id').value = visitId;
    document.getElementById('add-test-search').value = '';
    const container = document.getElementById('add-tests-container');
    container.innerHTML = 'Loading...';
    this.openModal('add-test-modal');

    if (!this.sections || this.sections.length === 0) {
      try {
        const sres = yield fetch('/api/config/sections');
        if (sres.ok) this.sections = yield sres.json();
      } catch(e) { this.sections = []; }
    }

    const secSelect = document.getElementById('add-test-section');
    if (secSelect && this.sections) {
      let secHtml = '<option value="all">All Sections</option>';
      this.sections.forEach(s => {
        secHtml += `<option value="${s.id}">${this.escape(s.name)}</option>`;
      });
      secSelect.innerHTML = secHtml;
      secSelect.value = 'all';
    }

    if (!this.testCatalog || this.testCatalog.length === 0) {
      try {
        const res = yield fetch('/api/config/tests');
        if (res.ok) this.testCatalog = yield res.json();
      } catch(e) {}
    }
    
    if (this.testCatalog) {
      let html = '';
      let isMale = false;
      if (this.currentClient && this.currentClient.sex && this.currentClient.sex.toLowerCase() === 'male') {
        isMale = true;
      }
      const femaleKeywords = ['hcg urine', 'hcg blood', 'pregnancy'];

      this.testCatalog.forEach(t => {
        if (!t.parent_rollup_id) {
          const tNameLow = (t.name || '').toLowerCase();
          if (isMale && femaleKeywords.some(k => tNameLow.includes(k))) {
            return;
          }
          html += `
            <label class="add-test-row" data-name="${this.escape(t.name).toLowerCase()}" data-category="${t.section_id}" style="display: block; margin-bottom: 4px; padding: 3px 6px; border-radius: 4px; cursor: pointer;">
              <input type="checkbox" name="add-test-cb" value="${t.id}" data-test-name="${this.escape(t.name)}" onchange="app.updateAddModalSelectedTestsSummary()" onkeydown="app.handleModalTestCheckboxKeyNav(event)">
              ${this.escape(t.name)}
            </label>
          `;
        }
      });
      container.innerHTML = html;
      const searchInput = document.getElementById('add-test-search');
      if (searchInput) {
        searchInput.onkeydown = (e) => app.handleModalTestSearchKeyNav(e);
      }
      this.updateAddModalSelectedTestsSummary();
    }
  }),

  handleModalTestSearchKeyNav: function(event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      const firstVisible = Array.from(document.querySelectorAll('.add-test-row')).find(function(r) { return r.style.display !== 'none'; });
      if (firstVisible) {
        event.preventDefault();
        const cb = firstVisible.querySelector('input[name="add-test-cb"]');
        if (cb) cb.focus();
      }
    }
  },

  handleModalTestCheckboxKeyNav: function(event) {
    const key = event.key;
    const currentCb = event.target;
    const currentRow = currentCb.closest('.add-test-row');
    const allVisibleRows = Array.from(document.querySelectorAll('.add-test-row')).filter(function(r) { return r.style.display !== 'none'; });
    const curIdx = allVisibleRows.indexOf(currentRow);

    if (key === 'ArrowDown') {
      if (curIdx >= 0 && curIdx < allVisibleRows.length - 1) {
        event.preventDefault();
        const nextCb = allVisibleRows[curIdx + 1].querySelector('input[name="add-test-cb"]');
        if (nextCb) nextCb.focus();
      }
    } else if (key === 'ArrowUp') {
      if (curIdx > 0) {
        event.preventDefault();
        const prevCb = allVisibleRows[curIdx - 1].querySelector('input[name="add-test-cb"]');
        if (prevCb) prevCb.focus();
      } else {
        const searchInput = document.getElementById('add-test-search');
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    } else if ((event.ctrlKey || event.metaKey) && key === 'Enter') {
      event.preventDefault();
      this.submitAddTests();
    }
  },

  updateAddModalSelectedTestsSummary: function() {
    const checkboxes = document.querySelectorAll('input[name="add-test-cb"]:checked');
    const countEl = document.getElementById('add-test-selected-count');
    const barEl = document.getElementById('add-test-selected-summary-bar');
    const chipsEl = document.getElementById('add-test-selected-chips-container');
    
    if (countEl) {
      countEl.textContent = checkboxes.length.toString();
    }
    
    if (!barEl || !chipsEl) return;
    
    if (checkboxes.length === 0) {
      barEl.style.display = 'none';
      chipsEl.innerHTML = '';
      return;
    }
    
    barEl.style.display = 'block';
    let chipsHtml = '';
    checkboxes.forEach(cb => {
      const testId = cb.value;
      const testName = cb.getAttribute('data-test-name') || (cb.parentElement ? cb.parentElement.textContent.trim() : 'Test #' + testId);
      chipsHtml += `
        <span style="display: inline-flex; align-items: center; gap: 4px; background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE; border-radius: 4px; padding: 2px 8px; font-size: 0.8rem; font-weight: 500;">
          ${this.escape(testName)}
          <button type="button" onclick="app.deselectAddModalTest(${testId})" style="background: none; border: none; color: #1E40AF; font-weight: bold; cursor: pointer; padding: 0 2px; font-size: 1rem; line-height: 1;" title="Remove">&times;</button>
        </span>
      `;
    });
    chipsEl.innerHTML = chipsHtml;
  },

  deselectAddModalTest: function(testId) {
    const cb = document.querySelector('input[name="add-test-cb"][value="' + testId + '"]');
    if (cb) {
      cb.checked = false;
    }
    this.updateAddModalSelectedTestsSummary();
  },

  clearAllAddModalSelectedTests: function() {
    document.querySelectorAll('input[name="add-test-cb"]').forEach(cb => {
      cb.checked = false;
    });
    this.updateAddModalSelectedTestsSummary();
  },

  filterAddTests: function() {
    const searchInput = document.getElementById('add-test-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const cat = document.getElementById('add-test-section') ? document.getElementById('add-test-section').value : 'all';
    const rows = document.querySelectorAll('.add-test-row');
    rows.forEach(row => {
      const nameMatch = row.getAttribute('data-name').includes(query);
      const catMatch = (cat === 'all' || row.getAttribute('data-category') === cat);
      if (nameMatch && catMatch) {
        row.style.display = 'block';
      } else {
        row.style.display = 'none';
      }
    });
  },

  submitAddTests: __async(function*() {
    const visitId = document.getElementById('add-test-visit-id').value;
    const orderCat = document.getElementById('add-test-order-category').value;
    const checkboxes = document.querySelectorAll('input[name="add-test-cb"]:checked');
    const selectedTests = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
    
    if (selectedTests.length === 0) {
      this.showNotificationModal("Notice", "Select at least one test to add.", false);
      return;
    }
    
    try {
      const res = yield fetch(`/api/visits/${visitId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_ids: selectedTests, order_category: orderCat })
      });
      if (res.ok) {
        this.clearAllAddModalSelectedTests();
        this.showNotificationModal("Success", "Tests added to visit successfully.", false);
        this.closeModal('add-test-modal');
        if (this.currentClientId) {
          yield this.loadPendingTests(this.currentClientId);
          yield this.loadHistoricalVisits(this.currentClientId);
        }
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to add tests.", true);
      }
    } catch(err) {
      this.showNotificationModal("Error", "Connection error.", true);
    }
  }),


  removeOrder: __async(function*(orderId) {
    app.confirmAction("Confirm Removal", "Are you sure you want to remove this pending test?", __async(function*() {
      try {
        const res = yield fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
        if (res.ok) {
          app.showNotificationModal("Success", "Test order removed.", false);
          if (app.currentClientId) {
            yield app.loadPendingTests(app.currentClientId);
          }
        } else {
          const err = yield res.json();
          app.showNotificationModal("Error", err.detail || "Failed to remove test order.", true);
        }
      } catch(e) {
        app.showNotificationModal("Error", "Connection error.", true);
      }
    }));
  }),


  toggleAnalyzerPaste: function(show) {
    if (typeof show === 'undefined') show = null;
    const container = document.getElementById('analyzer-paste-container');
    if (!container) return;
    if (show === null) {
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
    } else {
      container.style.display = show ? 'block' : 'none';
    }
    if (container.style.display === 'block') {
      const input = document.getElementById('analyzer-raw-input');
      if (input) input.focus();
    }
  },


  });
})(window.app);

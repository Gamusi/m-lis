// M-LIS Administrative Configuration & Audit Log Module
(function(app) {
  Object.assign(app, {
  handleRegisterClientSubmit: __async(function*(e) {
    e.preventDefault();
    const pname = document.getElementById('client-name').value.trim().toUpperCase();
    const psex = document.getElementById('client-sex').value;
    const pcategory = document.getElementById('client-category').value;
    const pageStr = document.getElementById('client-age').value.trim();
    const pphone = document.getElementById('client-phone').value.trim();
    
    if (!pname || !pageStr) return;
    
    // Strict Age Validation
    let ageYrs = 0;
    const lowerAge = pageStr.toLowerCase().replace(/ /g, '');
    if (lowerAge.includes('d') || lowerAge.includes('/365')) {
       ageYrs = parseInt(lowerAge) / 365.25;
    } else if (lowerAge.includes('m') || lowerAge.includes('/12')) {
       // Support '1 3/12' format by checking if there's a space? We stripped spaces.
       // It's safer to just parse the first number if it's '11m'.
       const parts = pageStr.split(' ');
       if (parts.length > 1 && parts[1].includes('/12')) {
          ageYrs = parseInt(parts[0]) + (parseInt(parts[1]) / 12);
       } else {
          ageYrs = parseInt(lowerAge) / 12;
       }
    } else {
       ageYrs = parseFloat(lowerAge);
    }
    
    if (isNaN(ageYrs)) {
        app.showNotificationModal("Error", "Invalid age format.", true);
        return;
    }
    
    let isValid = true;
    if (pcategory === 'Neonate' && ageYrs > 0.0768) isValid = false;
    else if (pcategory === 'Infant' && (ageYrs <= 0.0768 || ageYrs > 1)) isValid = false;
    else if (pcategory === 'Toddler' && (ageYrs <= 1 || ageYrs > 3)) isValid = false;
    else if (pcategory === 'Child' && (ageYrs <= 3 || ageYrs > 14)) isValid = false;
    else if (pcategory === 'Adult' && ageYrs < 15) isValid = false;

    if (!isValid) {
      app.showNotificationModal("Error", "Age does not match selected category.", true);
      return;
    }
    
    try {
      const res = yield fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: pname,
          sex: psex,
          age_category: pcategory,
          age_string: pageStr,
          phone: pphone
        })
      });

      if (res.ok) {
        const data = yield res.json();
        app.showNotificationModal("Success", `Client registered successfully! Assigned ID: ${data.client_number}`, false);
        app.closeNewClientModal();
        app.searchClients('');
      } else {
        this.showNotificationModal("Error", 'Error registering client.', true);
      }
    } catch (error) {
      this.showNotificationModal("Error", 'Connection error.', true);
    }
  }),

  // Configuration View

  renderConfig: __async(function*(container) {
    const isSuperAdmin = this.currentUser && this.currentUser.role === 'superadmin';

    container.innerHTML = `
      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('landmark')} Facility Identity & Branding Configuration</span>
        </summary>
        <div style="padding: 16px;">
          <form id="facility-settings-form" onsubmit="app.saveFacilitySettings(event)">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div class="form-group">
                <label for="fac-name">Facility / Hospital Name *</label>
                <input type="text" id="fac-name" required placeholder="e.g. Ahmadiyya Muslim Hospital">
              </div>
              <div class="form-group">
                <label for="fac-acronym">Facility Acronym / Lab Number Prefix *</label>
                <input type="text" id="fac-acronym" required placeholder="e.g. AMH" style="text-transform: uppercase;">
                <small style="color: var(--text-muted); font-size: 0.75rem;">Used for sequential Lab Numbers and Client IDs (e.g. AMH-26-8-001, AMH-C26-0001)</small>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div class="form-group">
                <label for="fac-phone">Contact Phone</label>
                <input type="text" id="fac-phone" placeholder="e.g. +256 700 000 000">
              </div>
              <div class="form-group">
                <label for="fac-email">Contact Email</label>
                <input type="email" id="fac-email" placeholder="e.g. lab@hospital.org">
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="fac-address">Physical / Postal Address</label>
              <input type="text" id="fac-address" placeholder="e.g. P.O. Box 2309, Mbale, Uganda">
            </div>
            <button type="submit" class="btn btn-primary">${this.icon('save')} Save Facility Settings</button>
          </form>
        </div>
      </details>

      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('settings')} Test Catalog & Section Configuration</span>
        </summary>
        <div style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="app.openTestConfigModal()">${this.icon('plus')} Add New Test</button>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <select id="test-catalog-section-filter" onchange="app.filterTestCatalogTable()" style="padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem;">
                <option value="all">All Sections</option>
              </select>
              <input type="text" id="test-catalog-search" placeholder="Search test or parameter..." oninput="app.filterTestCatalogTable()" style="padding: 7px 12px; border: 1px solid var(--border-color); border-radius: 4px; min-width: 240px; font-size: 0.85rem;">
            </div>
          </div>
          <div id="config-table-container">
            <p style="color: var(--text-muted);">Loading configuration...</p>
          </div>
        </div>
      </details>

      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('sliders')} Reference Intervals & Clinical Flags Configuration</span>
        </summary>
        <div style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="app.showAddReferenceRangeModal()">${this.icon('plus')} Add Reference Range Rule</button>
            <input type="text" id="ref-range-search" placeholder="Search reference intervals by test name..." oninput="app.filterReferenceRangesTable()" style="padding: 7px 12px; border: 1px solid var(--border-color); border-radius: 4px; min-width: 260px; font-size: 0.85rem;">
          </div>
          <div id="reference-ranges-table-container">
            <p style="color: var(--text-muted);">Loading reference intervals...</p>
          </div>
        </div>
      </details>

      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('bed')} Wards Configuration</span>
        </summary>
        <div style="padding: 16px;">
          <button class="btn btn-primary" onclick="app.showAddWardModal()" style="margin-bottom: 12px;">${this.icon('plus')} Add Ward</button>
          <div id="wards-table-container">
            <p style="color: var(--text-muted);">Loading wards...</p>
          </div>
        </div>
      </details>
      
      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('stethoscope')} Clinicians Configuration</span>
        </summary>
        <div style="padding: 16px;">
          <button class="btn btn-primary" onclick="app.showAddClinicianModal()" style="margin-bottom: 12px;">${this.icon('plus')} Add Clinician</button>
          <div id="clinicians-table-container">
            <p style="color: var(--text-muted);">Loading clinicians...</p>
          </div>
        </div>
      </details>

      ${isSuperAdmin ? `
      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('user-plus')} Pending Registration Requests</span>
        </summary>
        <div id="pending-users-container" style="padding: 16px;">
          <p style="color: var(--text-muted);">Loading pending requests...</p>
        </div>
      </details>

      <details class="card" style="margin-bottom: 16px;">
        <summary class="card-header" style="cursor: pointer; list-style: none;">
          <span class="card-title">${this.icon('users')} Active Lab Staff Accounts</span>
        </summary>
        <div id="active-users-container" style="padding: 16px;">
          <p style="color: var(--text-muted);">Loading accounts...</p>
        </div>
      </details>
      ` : ''}
    `;
    yield this.loadFacilityConfig();
    yield this.loadConfigData();
    yield this.loadReferenceRangesConfig();
    yield this.loadWardsConfig();
    yield this.loadCliniciansConfig();
  }),

  loadFacilityConfig: __async(function*() {
    try {
      const res = yield fetch('/api/config/facility');
      if (!res.ok) return;
      const data = yield res.json();
      const nameEl = document.getElementById('fac-name');
      const acrEl = document.getElementById('fac-acronym');
      const phoneEl = document.getElementById('fac-phone');
      const emailEl = document.getElementById('fac-email');
      const addrEl = document.getElementById('fac-address');
      if (nameEl) nameEl.value = data.facility_name || '';
      if (acrEl) acrEl.value = data.facility_acronym || '';
      if (phoneEl) phoneEl.value = data.phone || '';
      if (emailEl) emailEl.value = data.email || '';
      if (addrEl) addrEl.value = data.address || '';
    } catch (e) {
      console.warn('Facility config load error:', e);
    }
  }),

  saveFacilitySettings: __async(function*(e) {
    if (e) e.preventDefault();
    const nameEl = document.getElementById('fac-name');
    const acrEl = document.getElementById('fac-acronym');
    const phoneEl = document.getElementById('fac-phone');
    const emailEl = document.getElementById('fac-email');
    const addrEl = document.getElementById('fac-address');
    if (!nameEl || !acrEl) return;

    const payload = {
      facility_name: nameEl.value.trim(),
      facility_acronym: acrEl.value.trim().toUpperCase(),
      facility_code: acrEl.value.trim().toUpperCase(),
      phone: phoneEl ? phoneEl.value.trim() : '',
      email: emailEl ? emailEl.value.trim() : '',
      address: addrEl ? addrEl.value.trim() : ''
    };

    try {
      const res = yield fetch('/api/config/facility', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const saved = yield res.json();
        const facTitleEl = document.getElementById('facility-name');
        if (facTitleEl) facTitleEl.textContent = saved.facility_name;
        this.showNotificationModal("Success", `Facility settings saved successfully! Sequential numbers will use prefix '${saved.facility_acronym}'.`, false);
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to update facility settings.", true);
      }
    } catch (err) {
      this.showNotificationModal("Error", "Network error updating facility settings.", true);
    }
  }),


  
  loadWardsConfig: __async(function*() {
    try {
      const res = yield fetch('/api/config/wards');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const wards = yield res.json();
      let rows = '';
      wards.forEach(w => {
        rows += `
          <tr>
            <td><strong>${this.escape(w.name)}</strong></td>
            <td>${w.is_active ? '<span style="color:green;">Active</span>' : '<span style="color:red;">Inactive</span>'}</td>
            <td>
              <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.editWard(${w.id}, '${this.escape(w.name)}', ${w.is_active})">Edit</button>
              ${w.is_active
                ? `<button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; color: var(--danger-color);" onclick="app.deleteWard(${w.id})">Deactivate</button>`
                : `<button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; color: green;" onclick="app.reactivateWard(${w.id})">Reactivate</button>`
              }
            </td>
          </tr>
        `;
      });
      document.getElementById('wards-table-container').innerHTML = `
        <table class="data-table">
          <thead><tr><th>Ward Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch(e) { console.error(e); }
  }),

  showAddWardModal: __async(function*() {
    document.getElementById('ward-modal-title').textContent = 'Add Ward';
    document.getElementById('ward-modal-id').value = '';
    document.getElementById('ward-modal-active').value = '1';
    document.getElementById('ward-modal-name').value = '';
    this.openModal('ward-modal');
    document.getElementById('ward-modal-name').focus();
  }),

  editWard: __async(function*(id, oldName, isActive) {
    document.getElementById('ward-modal-title').textContent = 'Edit Ward';
    document.getElementById('ward-modal-id').value = id;
    document.getElementById('ward-modal-active').value = isActive ? '1' : '0';
    document.getElementById('ward-modal-name').value = oldName;
    this.openModal('ward-modal');
    document.getElementById('ward-modal-name').focus();
  }),

  submitWardModal: __async(function*(e) {
    e.preventDefault();
    const id = document.getElementById('ward-modal-id').value;
    const name = document.getElementById('ward-modal-name').value.trim().toUpperCase();
    const isActive = document.getElementById('ward-modal-active').value === '1';
    if (!name) return;
    try {
      let res;
      if (id) {
        res = yield fetch(`/api/config/wards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, is_active: isActive })
        });
      } else {
        res = yield fetch('/api/config/wards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
      }
      if (res.ok) {
        this.closeModal('ward-modal');
        this.loadWardsConfig();
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to save ward.", true);
      }
    } catch(e) { console.error(e); }
  }),

  deleteWard: __async(function*(id) {
    app.confirmAction("Confirm Deactivation", "Are you sure you want to deactivate this ward?", __async(function*() {
      try {
        yield fetch(`/api/config/wards/${id}`, { method: 'DELETE' });
        app.loadWardsConfig();
      } catch(e) { console.error(e); }
    }));
  }),

  reactivateWard: __async(function*(id) {
    try {
      const res = yield fetch(`/api/config/wards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });
      if (res.ok) {
        this.loadWardsConfig();
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || "Failed to reactivate ward.", true);
      }
    } catch(e) { console.error(e); }
  }),

  loadCliniciansConfig: __async(function*() {
    try {
      const res = yield fetch('/api/config/clinicians');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const clinicians = yield res.json();
      let rows = '';
      clinicians.forEach(c => {
        rows += `
          <tr>
            <td><strong>${this.escape(c.name)}</strong></td>
            <td>Active</td>
          </tr>
        `;
      });
      document.getElementById('clinicians-table-container').innerHTML = `
        <table class="data-table">
          <thead><tr><th>Clinician Name</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } catch(e) { console.error(e); }
  }),
  
  showAddClinicianModal: function() {
    document.getElementById('clinician-modal-name').value = '';
    this.openModal('clinician-modal');
  },

  submitClinicianModal: __async(function*(event) {
    event.preventDefault();
    const name = document.getElementById('clinician-modal-name').value.trim().toUpperCase();
    try {
      const res = yield fetch('/api/config/clinicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, is_active: true })
      });
      if (res.ok) {
        this.closeModal('clinician-modal');
        app.loadCliniciansConfig();
      } else {
        const err = yield res.json();
        app.showNotificationModal("Error", err.detail || "Failed to add clinician.", true);
      }
    } catch(e) {
      console.error(e);
      app.showNotificationModal("Error", "Network error adding clinician.", true);
    }
  }),

  loadReferenceRangesConfig: __async(function*() {
    try {
      const res = yield fetch('/api/config/reference-ranges');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const ranges = yield res.json();
      this.referenceRangesList = ranges;
      let rows = '';
      ranges.forEach(r => {
        const normStr = (r.normal_min !== null && r.normal_max !== null) ? `${r.normal_min} - ${r.normal_max}` : (r.normal_min !== null ? `>= ${r.normal_min}` : (r.normal_max !== null ? `<= ${r.normal_max}` : '—'));
        const critMinStr = r.critical_min !== null ? `< ${r.critical_min}` : '';
        const critMaxStr = r.critical_max !== null ? `> ${r.critical_max}` : '';
        const critCombined = (critMinStr || critMaxStr) ? `${critMinStr} ${critMaxStr}`.trim() : '—';
        const critStr = (critCombined !== '—') ? `<span style="color:#dc2626; font-weight:600;">${this.escape(critCombined)}</span>` : '—';
        const sanityMinStr = r.sanity_min !== null ? `${r.sanity_min}` : '';
        const sanityMaxStr = r.sanity_max !== null ? `${r.sanity_max}` : '';
        const sanityStr = (sanityMinStr || sanityMaxStr) ? `${sanityMinStr || '0'} - ${sanityMaxStr || '∞'}` : '—';
        const ageStr = (r.age_min === 0 && r.age_max >= 900) ? 'All Ages' : `${r.age_min} - ${r.age_max}y`;
        const sexStr = r.sex ? r.sex : 'Any';
        rows += `
          <tr>
            <td><strong>${this.escape(r.parameter_name)}</strong></td>
            <td>${this.escape(ageStr)}</td>
            <td>${this.escape(sexStr)}</td>
            <td>${normStr}</td>
            <td>${critStr}</td>
            <td><span style="font-size:0.8rem; color:var(--text-muted);">${sanityStr}</span></td>
            <td>${this.escape(r.unit || '—')}</td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-secondary btn-sm" onclick="app.showEditReferenceRangeModal(${r.id})" style="padding: 3px 8px; font-size: 0.78rem;">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="app.deleteReferenceRange(${r.id}, '${this.escape(r.parameter_name)}')" style="padding: 3px 8px; font-size: 0.78rem;">Delete</button>
            </td>
          </tr>
        `;
      });
      const container = document.getElementById('reference-ranges-table-container');
      if (container) {
        container.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Parameter / Test</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Normal Interval</th>
                <th>Critical Alert</th>
                <th>Sanity Bounds</th>
                <th>Unit</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No reference intervals configured.</td></tr>'}</tbody>
          </table>
        `;
      }
    } catch(e) {
      console.error(e);
      const container = document.getElementById('reference-ranges-table-container');
      if (container) container.innerHTML = '<p style="color:var(--danger-color);">Failed to load reference intervals.</p>';
    }
  }),

  populateRefRangeParamDropdown: function(selectedParam) {
    const datalist = document.getElementById('ref-range-param-datalist');
    const input = document.getElementById('ref-range-modal-param');
    if (!datalist) return;
    datalist.innerHTML = '';
    
    // Strictly filter to active tests where result_type is quantitative
    // Reference ranges only apply to numerical/quantitative analyses
    const quantTests = (this.testCatalog || []).filter(t => t.is_active !== 0 && t.result_type === 'quantitative');
    const seen = new Set();
    
    quantTests.forEach(t => {
      if (!seen.has(t.name.toLowerCase())) {
        seen.add(t.name.toLowerCase());
        const opt = document.createElement('option');
        opt.value = t.name;
        if (t.default_unit) {
          opt.label = `${t.name} (${t.default_unit})`;
        }
        datalist.appendChild(opt);
      }
    });

    // Also include parameter names from existing reference range rules so custom parameters can be edited
    (this.referenceRangesList || []).forEach(r => {
      if (r.parameter_name && !seen.has(r.parameter_name.toLowerCase())) {
        seen.add(r.parameter_name.toLowerCase());
        const opt = document.createElement('option');
        opt.value = r.parameter_name;
        if (r.unit) opt.label = `${r.parameter_name} (${r.unit})`;
        datalist.appendChild(opt);
      }
    });

    if (input) {
      input.value = selectedParam || '';
    }
  },

  handleRefRangeParamSelection: function(paramName) {
    if (!paramName) return;
    const test = (this.testCatalog || []).find(t => t.name.toLowerCase() === paramName.trim().toLowerCase());
    
    // Strictly bind available units to factual units defined in the test catalog (default_unit and secondary_unit)
    const unitsSet = new Set();
    if (test) {
      if (test.default_unit) unitsSet.add(test.default_unit);
      if (test.secondary_unit) unitsSet.add(test.secondary_unit);
    }

    const unitContainer = document.getElementById('ref-range-modal-unit-container');
    const unitHint = document.getElementById('ref-range-modal-unit-hint');
    const unitArray = Array.from(unitsSet);

    if (unitContainer) {
      if (unitArray.length > 1) {
        // Multi-unit test: show a direct dropdown selector
        let opts = unitArray.map(u => `<option value="${this.escape(u)}">${this.escape(u)}</option>`).join('');
        unitContainer.innerHTML = `
          <select id="ref-range-modal-unit" style="width: 100%; padding: 8px;" onchange="app.handleRefRangeUnitChange(this.value, '${this.escape(paramName)}')">
            ${opts}
          </select>
        `;
        if (unitHint) {
          unitHint.textContent = `This test supports multiple units (${unitArray.join(', ')}). Bounds update when unit changes.`;
          unitHint.style.display = 'block';
        }
      } else {
        // Single unit test: standard text input with datalist
        const defaultVal = unitArray[0] || (tes(t ? t.default_unit : null) || '');
        unitContainer.innerHTML = `
          <input type="text" id="ref-range-modal-unit" list="ref-range-unit-datalist" value="${this.escape(defaultVal)}" placeholder="e.g. g/dL" style="width: 100%; padding: 8px;" onchange="app.handleRefRangeUnitChange(this.value, '${this.escape(paramName)}')">
          <datalist id="ref-range-unit-datalist"></datalist>
        `;
        const datalist = document.getElementById('ref-range-unit-datalist');
        if (datalist) {
          unitArray.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            datalist.appendChild(opt);
          });
        }
        if (unitHint) unitHint.style.display = 'none';
      }
    }

    const unitElem = document.getElementById('ref-range-modal-unit');
    const currentUnit = (unitElem ? unitElem.value : null) || unitArray[0] || null;
    this.populateRefRangeBoundsForUnit(paramName, currentUnit);
  },

  handleRefRangeUnitChange: function(newUnit, paramName) {
    if (!paramName) {
      const paramElem = document.getElementById('ref-range-modal-param');
      paramName = (paramElem ? paramElem.value : '') || '';
    }
    if (paramName) {
      this.populateRefRangeBoundsForUnit(paramName, newUnit);
    }
  },

  populateRefRangeBoundsForUnit: function(paramName, selectedUnit) {
    if (!paramName) return;
    const existingRules = (this.referenceRangesList || []).filter(r => r.parameter_name.toLowerCase() === paramName.trim().toLowerCase());
    if (existingRules.length === 0) return;

    // Look for template matching selected unit, otherwise complete bounds, otherwise first
    let template = null;
    if (selectedUnit) {
      template = existingRules.find(r => r.unit && r.unit.toLowerCase() === selectedUnit.trim().toLowerCase() && r.normal_min !== null);
      if (!template) {
        template = existingRules.find(r => r.unit && r.unit.toLowerCase() === selectedUnit.trim().toLowerCase());
      }
    }
    if (!template) {
      template = existingRules.find(r => r.normal_min !== null && r.normal_max !== null) || existingRules[0];
    }

    const normMin = document.getElementById('ref-range-modal-norm-min');
    const normMax = document.getElementById('ref-range-modal-norm-max');
    const critMin = document.getElementById('ref-range-modal-crit-min');
    const critMax = document.getElementById('ref-range-modal-crit-max');
    const sMin = document.getElementById('ref-range-modal-sanity-min');
    const sMax = document.getElementById('ref-range-modal-sanity-max');
    const pMin = document.getElementById('ref-range-modal-plausible-min');
    const pMax = document.getElementById('ref-range-modal-plausible-max');

    if (normMin && template.normal_min !== null && template.normal_min !== undefined) normMin.value = template.normal_min;
    if (normMax && template.normal_max !== null && template.normal_max !== undefined) normMax.value = template.normal_max;
    if (critMin && template.critical_min !== null && template.critical_min !== undefined) critMin.value = template.critical_min;
    if (critMax && template.critical_max !== null && template.critical_max !== undefined) critMax.value = template.critical_max;
    if (sMin && template.sanity_min !== null && template.sanity_min !== undefined) sMin.value = template.sanity_min;
    if (sMax && template.sanity_max !== null && template.sanity_max !== undefined) sMax.value = template.sanity_max;
    if (pMin && template.plausible_min !== null && template.plausible_min !== undefined) pMin.value = template.plausible_min;
    if (pMax && template.plausible_max !== null && template.plausible_max !== undefined) pMax.value = template.plausible_max;
  },

  showAddReferenceRangeModal: function() {
    this.populateRefRangeParamDropdown('');
    document.getElementById('reference-range-modal-title').textContent = 'Add Reference Range Rule';
    document.getElementById('ref-range-modal-id').value = '';
    document.getElementById('ref-range-modal-param').value = '';
    document.getElementById('ref-range-modal-age-min').value = '0';
    document.getElementById('ref-range-modal-age-max').value = '999';
    document.getElementById('ref-range-modal-sex').value = '';
    document.getElementById('ref-range-modal-norm-min').value = '';
    document.getElementById('ref-range-modal-norm-max').value = '';
    document.getElementById('ref-range-modal-crit-min').value = '';
    document.getElementById('ref-range-modal-crit-max').value = '';
    document.getElementById('ref-range-modal-sanity-min').value = '';
    document.getElementById('ref-range-modal-sanity-max').value = '';
    document.getElementById('ref-range-modal-plausible-min').value = '';
    document.getElementById('ref-range-modal-plausible-max').value = '';
    document.getElementById('ref-range-modal-unit').value = '';
    this.openModal('reference-range-modal');
  },

  showEditReferenceRangeModal: function(id) {
    const r = (this.referenceRangesList || []).find(item => item.id === id);
    if (!r) return;
    this.populateRefRangeParamDropdown(r.parameter_name || '');
    this.handleRefRangeParamSelection(r.parameter_name || '');
    document.getElementById('reference-range-modal-title').textContent = 'Edit Reference Range Rule';
    document.getElementById('ref-range-modal-id').value = r.id;
    document.getElementById('ref-range-modal-param').value = r.parameter_name || '';
    document.getElementById('ref-range-modal-age-min').value = r.age_min !== null ? r.age_min : 0;
    document.getElementById('ref-range-modal-age-max').value = r.age_max !== null ? r.age_max : 999;
    document.getElementById('ref-range-modal-sex').value = r.sex || '';
    document.getElementById('ref-range-modal-norm-min').value = r.normal_min !== null ? r.normal_min : '';
    document.getElementById('ref-range-modal-norm-max').value = r.normal_max !== null ? r.normal_max : '';
    document.getElementById('ref-range-modal-crit-min').value = r.critical_min !== null ? r.critical_min : '';
    document.getElementById('ref-range-modal-crit-max').value = r.critical_max !== null ? r.critical_max : '';
    document.getElementById('ref-range-modal-sanity-min').value = r.sanity_min !== null ? r.sanity_min : '';
    document.getElementById('ref-range-modal-sanity-max').value = r.sanity_max !== null ? r.sanity_max : '';
    document.getElementById('ref-range-modal-plausible-min').value = r.plausible_min !== null ? r.plausible_min : '';
    document.getElementById('ref-range-modal-plausible-max').value = r.plausible_max !== null ? r.plausible_max : '';
    const unitEl = document.getElementById('ref-range-modal-unit');
    if (unitEl) unitEl.value = r.unit || '';
    this.openModal('reference-range-modal');
  },

  filterReferenceRangesTable: function() {
    const searchEl = document.getElementById('ref-range-search');
    const q = (searchEl ? searchEl.value : '').toLowerCase().trim();
    const rows = document.querySelectorAll('#reference-ranges-table-container tbody tr');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  },

  filterTestCatalogTable: function() {
    const q = (document.getElementById('test-catalog-search') ? document.getElementById('test-catalog-search').value : '').toLowerCase().trim();
    const secFilterEl = document.getElementById('test-catalog-section-filter');
    const selectedSec = secFilterEl ? secFilterEl.value : 'all';
    const container = document.getElementById('config-table-container');
    if (!container) return;
    const rows = container.querySelectorAll('tbody tr');
    let currentSecMatches = false;
    let secHeader = null;
    let anyChildMatchedInSec = false;

    rows.forEach(tr => {
      if (tr.hasAttribute('data-section-header')) {
        secHeader = tr;
        const secName = tr.getAttribute('data-section-name') || tr.textContent.toLowerCase();
        const secId = tr.getAttribute('data-section-id') || '';
        const secMatchesFilter = (selectedSec === 'all' || selectedSec === secId || selectedSec === secName);
        const secMatchesSearch = (q === '' || secName.includes(q));
        currentSecMatches = secMatchesFilter && secMatchesSearch;
        anyChildMatchedInSec = false;
        tr.style.display = currentSecMatches ? '' : 'none';
      } else {
        const rowSecId = tr.getAttribute('data-section-id') || '';
        const rowSecName = tr.getAttribute('data-section-name') || '';
        const secMatchesFilter = (selectedSec === 'all' || selectedSec === rowSecId || selectedSec === rowSecName);
        const text = tr.textContent.toLowerCase();
        const matchesSearch = (q === '' || text.includes(q));
        const visible = secMatchesFilter && matchesSearch;
        
        // If parent panel is collapsed, keep child row hidden unless searching
        const isChild = tr.hasAttribute('data-parent-id');
        if (isChild && q === '' && tr.style.display === 'none') {
          // Keep collapsed state
        } else {
          tr.style.display = visible ? '' : 'none';
        }
        
        if (visible) {
          anyChildMatchedInSec = true;
          if (secHeader && secMatchesFilter) {
            secHeader.style.display = '';
          }
        }
      }
    });
  },

  submitReferenceRangeModal: __async(function*(event) {
    event.preventDefault();
    const id = document.getElementById('ref-range-modal-id').value;
    const param = document.getElementById('ref-range-modal-param').value.trim();
    const ageMin = document.getElementById('ref-range-modal-age-min').value;
    const ageMax = document.getElementById('ref-range-modal-age-max').value;
    const sex = document.getElementById('ref-range-modal-sex').value || null;
    const normMin = document.getElementById('ref-range-modal-norm-min').value;
    const normMax = document.getElementById('ref-range-modal-norm-max').value;
    const critMin = document.getElementById('ref-range-modal-crit-min').value;
    const critMax = document.getElementById('ref-range-modal-crit-max').value;
    const sanityMin = document.getElementById('ref-range-modal-sanity-min').value;
    const sanityMax = document.getElementById('ref-range-modal-sanity-max').value;
    const plausibleMin = document.getElementById('ref-range-modal-plausible-min').value;
    const plausibleMax = document.getElementById('ref-range-modal-plausible-max').value;
    const unit = document.getElementById('ref-range-modal-unit').value.trim() || null;

    // Check non-negative constraints
    const numericFields = [normMin, normMax, critMin, critMax, sanityMin, sanityMax, plausibleMin, plausibleMax];
    for (const val of numericFields) {
      if (val !== '' && parseFloat(val) < 0) {
        this.showNotificationModal("Validation Error", "Reference intervals and sanity limits must be non-negative (>= 0).", true);
        return;
      }
    }

    const payload = {
      parameter_name: param,
      age_min: ageMin !== '' ? parseInt(ageMin, 10) : 0,
      age_max: ageMax !== '' ? parseInt(ageMax, 10) : 999,
      sex: sex,
      normal_min: normMin !== '' ? parseFloat(normMin) : null,
      normal_max: normMax !== '' ? parseFloat(normMax) : null,
      critical_min: critMin !== '' ? parseFloat(critMin) : null,
      critical_max: critMax !== '' ? parseFloat(critMax) : null,
      sanity_min: sanityMin !== '' ? parseFloat(sanityMin) : null,
      sanity_max: sanityMax !== '' ? parseFloat(sanityMax) : null,
      plausible_min: plausibleMin !== '' ? parseFloat(plausibleMin) : null,
      plausible_max: plausibleMax !== '' ? parseFloat(plausibleMax) : null,
      unit: unit
    };

    try {
      let res;
      if (id) {
        res = yield fetch(`/api/config/reference-ranges/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = yield fetch('/api/config/reference-ranges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        this.closeModal('reference-range-modal');
        app.loadReferenceRangesConfig();
      } else {
        const err = yield res.json();
        app.showNotificationModal("Error", err.detail || "Failed to save reference range rule.", true);
      }
    } catch(e) {
      console.error(e);
      app.showNotificationModal("Error", "Network error saving reference range rule.", true);
    }
  }),

  deleteReferenceRange: function(id, paramName) {
    this.confirmAction(
      "Delete Reference Range Rule",
      `Are you sure you want to delete the reference interval rule for "${paramName}"?`,
      () => {
        __async(function*() {
          try {
            const res = yield fetch(`/api/config/reference-ranges/${id}`, { method: 'DELETE' });
            if (res.ok) {
              app.loadReferenceRangesConfig();
            } else {
              const err = yield res.json();
              app.showNotificationModal("Error", err.detail || "Failed to delete reference range rule.", true);
            }
          } catch(e) {
            console.error(e);
            app.showNotificationModal("Error", "Network error deleting rule.", true);
          }
        })();
      }
    );
  },

  loadConfigData: __async(function*() {
    try {
      // 1. Load sections first so we can display names
      if (!this.sections) {
        try {
          const secRes = yield fetch('/api/config/sections');
          if (secRes.ok) this.sections = yield secRes.json();
          else this.sections = [];
        } catch(e) { this.sections = []; }
      }
      const sectionMap = {};
      (this.sections || []).forEach(s => { sectionMap[s.id] = s.name; });

      // 2. Load test catalog
      const res = yield fetch('/api/config/tests');
      if (res.ok) {
        const tests = yield res.json();
        this.testCatalog = tests;

        // Populate section filter dropdown
        const secFilterSelect = document.getElementById('test-catalog-section-filter');
        if (secFilterSelect) {
          const currentVal = secFilterSelect.value || 'all';
          let secOptions = '<option value="all">All Sections</option>';
          (this.sections || []).forEach(s => {
            secOptions += `<option value="${s.id}">${this.escape(s.name)}</option>`;
          });
          secFilterSelect.innerHTML = secOptions;
          secFilterSelect.value = currentVal;
        }

        // Build section name lookup
        const sectionMap = {};
        (this.sections || []).forEach(s => { sectionMap[s.id] = s.name; });

        // Identify panel parents: result_type === 'panel' and no parent_rollup_id
        const parentIds = new Set(
          tests.filter(t => t.result_type === 'panel' && !t.parent_rollup_id).map(t => t.id)
        );

        // Group all tests by section name, in section order
        const bySection = {};
        const sectionOrder = (this.sections || []).map(s => s.name);
        tests.forEach(t => {
          const secName = sectionMap[t.section_id] || `Section ${t.section_id}`;
          if (!bySection[secName]) bySection[secName] = [];
          bySection[secName].push(t);
        });

        let tableHtml = `
          <table class="data-table" style="table-layout: auto; width: 100%;">
            <thead>
              <tr>
                <th>Test / Parameter Name</th>
                <th style="white-space: nowrap;">Type & Unit</th>
                <th style="white-space: nowrap;">Surveillance Tracking</th>
                <th style="white-space: nowrap;">Actions</th>
              </tr>
            </thead>
            <tbody>
        `;

        // Render in section order, then any extra sections
        const orderedSections = sectionOrder.filter(n => bySection[n]);
        Object.keys(bySection).forEach(n => { if (!orderedSections.includes(n)) orderedSections.push(n); });

        orderedSections.forEach(secName => {
          const secTests = bySection[secName];
          const secObj = (this.sections || []).find(s => s.name === secName);
          const secId = secObj ? secObj.id : '';

          // Section header row
          tableHtml += `
            <tr data-section-header="true" data-section-id="${secId}" data-section-name="${this.escape(secName.toLowerCase())}" style="background-color: var(--primary-color); color: white;">
              <td colspan="4" style="font-weight: 700; padding: 6px 12px; font-size: 0.82rem; letter-spacing: 0.06em;">
                ${this.escape(secName.toUpperCase())}
              </td>
            </tr>
          `;

          const panelsInSec = secTests.filter(t => parentIds.has(t.id));
          const childrenMap = {};
          secTests.filter(t => t.parent_rollup_id && parentIds.has(t.parent_rollup_id)).forEach(t => {
            if (!childrenMap[t.parent_rollup_id]) childrenMap[t.parent_rollup_id] = [];
            childrenMap[t.parent_rollup_id].push(t);
          });
          const standalones = secTests.filter(t => !parentIds.has(t.id) && !t.parent_rollup_id);

          // Panel parent rows (collapsed by default)
          panelsInSec.forEach(parent => {
            const children = childrenMap[parent.id] || [];
            const count = children.length;
            tableHtml += `
              <tr data-section-id="${secId}" data-section-name="${this.escape(secName.toLowerCase())}" style="background-color: #EEF2FF; font-weight: 600;">
                <td style="padding-left: 12px;">
                  <button
                    id="toggle-btn-${parent.id}"
                    class="btn btn-secondary"
                    style="padding: 1px 7px; font-size: 0.75rem; margin-right: 8px; min-width: 22px;"
                    onclick="app.togglePanelGroup(${parent.id})"
                  >+</button>${this.escape(parent.name)}<span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 400; margin-left: 10px;">${count} parameter${count !== 1 ? 's' : ''}</span>
                </td>
                <td>Panel</td>
                <td>${parent.is_tracked ? 'Tracked (Positive / Abnormal)' : 'Standard (Done Only)'}</td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">System panel</td>
              </tr>
            `;
            // Child rows hidden by default
            children.forEach(child => {
              const typeLabel = child.result_type === 'quantitative' 
                ? `Quantitative (${child.default_unit || 'No unit'})` 
                : (child.result_type === 'semi_quantitative' ? 'Semi-Quantitative' : 'Qualitative');
              tableHtml += `
                <tr data-section-id="${secId}" data-section-name="${this.escape(secName.toLowerCase())}" data-parent-id="${parent.id}" style="display: none; background-color: #FAFAFA;">
                  <td style="padding-left: 40px; font-size: 0.9rem;">${this.escape(child.name)}</td>
                  <td>${this.escape(typeLabel)}</td>
                  <td style="font-size: 0.85rem;">${child.is_tracked ? 'Tracked (Positive / Abnormal)' : 'Standard (Done Only)'}</td>
                  <td>
                    <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.openTestConfigModal(${child.id})">Edit</button>
                    <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; color: var(--danger-color);" onclick="app.deleteTest(${child.id})">Delete</button>
                  </td>
                </tr>
              `;
            });
          });

          // Standalone tests (flat rows with Edit + Delete)
          standalones.forEach(t => {
            const typeLabel = t.result_type === 'quantitative' 
              ? `Quantitative (${t.default_unit || 'No unit'})` 
              : (t.result_type === 'semi_quantitative' ? 'Semi-Quantitative' : 'Qualitative');
            tableHtml += `
              <tr data-section-id="${secId}" data-section-name="${this.escape(secName.toLowerCase())}">
                <td style="padding-left: 12px;"><strong>${this.escape(t.name)}</strong></td>
                <td>${this.escape(typeLabel)}</td>
                <td>${t.is_tracked ? 'Tracked (Positive / Abnormal)' : 'Standard (Done Only)'}</td>
                <td>
                  <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem;" onclick="app.openTestConfigModal(${t.id})">Edit</button>
                  <button class="btn btn-secondary" style="padding: 2px 8px; font-size: 0.8rem; color: var(--danger-color);" onclick="app.deleteTest(${t.id})">Delete</button>
                </td>
              </tr>
            `;
          });
        });

        tableHtml += `</tbody></table>`;

        const catalogContainer = document.getElementById('config-table-container');
        if (catalogContainer) catalogContainer.innerHTML = tableHtml;
      }

      // 3. Load clinicians config
      yield this.loadCliniciansConfig();

      // 4. Load wards config
      yield this.loadWardsConfig();

      // 5. Load user management for admin/superadmin
      if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin')) {
        const userRes = yield fetch('/api/auth/users');
        if (userRes.ok) {
          const users = yield userRes.json();

          // Split into pending and active
          const pendingUsers = users.filter(u => !u.is_active);
          const activeUsers = users.filter(u => u.is_active);

          // 2a. Render Pending Registrations
          const pendingContainer = document.getElementById('pending-users-container');
          if (pendingContainer) {
            if (pendingUsers.length === 0) {
              pendingContainer.innerHTML = '<p style="padding: 12px; color: var(--text-muted);">No pending registration requests.</p>';
            } else {
              let pendingRows = '';
              pendingUsers.forEach(u => {
                const formattedDate = u.created_at ? u.created_at.replace('T', ' ').substring(0, 19) : 'â€”';
                pendingRows += `
                  <tr>
                    <td><strong>${this.escape(u.full_name)}</strong></td>
                    <td><code>${this.escape(u.username)}</code></td>
                    <td>${this.escape(u.cadre || 'None')}</td>
                    <td>${this.escape(formattedDate)}</td>
                    <td>
                      <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn btn-success" style="padding: 4px 10px; font-size: 0.8rem;" onclick="app.approveUser(${u.id}, '${this.escape(u.role)}', '${this.escape(u.cadre || '')}')">Approve</button>
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem; background: var(--danger-color); color: white; border: none;" onclick="app.rejectUser(${u.id}, '${this.escape(u.username)}')">Reject</button>
                      </div>
                    </td>
                  </tr>
                `;
              });

              pendingContainer.innerHTML = `
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Cadre</th>
                      <th>Registered On</th>
                      <th style="width: 180px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pendingRows}
                  </tbody>
                </table>
              `;
            }
          }

          // 2b. Render Active Staff
          const activeContainer = document.getElementById('active-users-container');
          if (activeContainer) {
            if (activeUsers.length === 0) {
              activeContainer.innerHTML = '<p style="padding: 12px; color: var(--text-muted);">No active staff accounts found.</p>';
            } else {
              let activeRows = '';
              activeUsers.forEach(u => {
                const isSelf = u.id === this.currentUser.id;
                const canEdit = !isSelf && !(this.currentUser.role === 'admin' && u.role === 'superadmin');
                const statusBadge = u.password_reset_required
                  ? 'Temporary (Reset Required)'
                  : 'Active';

                const superAdminOption = u.role === 'superadmin' ? `<option value="superadmin" selected>Super Admin</option>` : '';

                const roleSelect = `
                  <select id="role-select-${u.id}" onchange="app.changeUserFields(${u.id}, true)" ${!canEdit ? 'disabled' : ''} style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem;">
                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    ${superAdminOption}
                  </select>
                `;
                
                const cadreSelect = `
                  <select id="cadre-select-${u.id}" onchange="app.changeUserFields(${u.id}, true)" ${!canEdit ? 'disabled' : ''} style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.85rem; max-width: 200px;">
                    <option value="">None</option>
                    <option value="Medical Laboratory Assistant" ${u.cadre === 'Medical Laboratory Assistant' ? 'selected' : ''}>Medical Laboratory Assistant</option>
                    <option value="Medical Laboratory Technician" ${u.cadre === 'Medical Laboratory Technician' ? 'selected' : ''}>Medical Laboratory Technician</option>
                    <option value="Senior Medical Laboratory Technician" ${u.cadre === 'Senior Medical Laboratory Technician' ? 'selected' : ''}>Senior Medical Laboratory Technician</option>
                    <option value="Principal Medical Laboratory Technician" ${u.cadre === 'Principal Medical Laboratory Technician' ? 'selected' : ''}>Principal Medical Laboratory Technician</option>
                    <option value="Medical Laboratory Technologist / Scientist" ${u.cadre === 'Medical Laboratory Technologist / Scientist' ? 'selected' : ''}>Medical Laboratory Technologist / Scientist</option>
                    <option value="Senior Medical Laboratory Technologist" ${u.cadre === 'Senior Medical Laboratory Technologist' ? 'selected' : ''}>Senior Medical Laboratory Technologist</option>
                    <option value="Principal Medical Laboratory Technologist" ${u.cadre === 'Principal Medical Laboratory Technologist' ? 'selected' : ''}>Principal Medical Laboratory Technologist</option>
                  </select>
                `;

                const deactivateBtn = canEdit
                  ? `<button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem; color: var(--danger-color); border-color: var(--danger-color);" onclick="app.deactivateUser(${u.id}, '${this.escape(u.role)}', '${this.escape(u.cadre || '')}')">Deactivate</button>`
                  : '';

                const canReset = !isSelf && u.role !== 'superadmin' && !(this.currentUser.role === 'admin' && (u.role === 'admin' || u.role === 'superadmin'));
                const resetBtn = canReset
                  ? `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="app.promptResetPassword(${u.id}, '${this.escape(u.username)}', '${this.escape(u.role)}', '${this.escape(u.cadre || '')}')">Reset Password</button>`
                  : '';

                activeRows += `
                  <tr>
                    <td><strong>${this.escape(u.full_name)}</strong> ${isSelf ? '<small style="color: var(--primary-color); font-weight: 600;">(You)</small>' : ''}</td>
                    <td><code>${this.escape(u.username)}</code></td>
                    <td>${roleSelect}</td>
                    <td>${cadreSelect}</td>
                    <td>${statusBadge}</td>
                    <td>
                      <div style="display: flex; gap: 6px; align-items: center;">
                        ${resetBtn}
                        ${deactivateBtn}
                        ${!resetBtn && !deactivateBtn ? '<span style="color:var(--text-muted); font-size:0.85rem;">—</span>' : ''}
                      </div>
                    </td>
                  </tr>
                `;
              });

              activeContainer.innerHTML = `
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Cadre</th>
                      <th>Status</th>
                      <th style="width: 220px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${activeRows}
                  </tbody>
                </table>
              `;
            }
          }
        }
      }
    } catch (e) {
      console.error('Config loading error:', e);
    }
  }),

  approveUser: __async(function*(userId, role, cadre) {
    yield this.saveUserUpdate(userId, { role: role || 'staff', cadre: cadre || null, is_active: true });
    this.showNotificationModal("Success", 'User registration approved successfully!', false);
  }),

  rejectUser: __async(function*(userId, username) {
    app.confirmAction("Reject User", `Are you sure you want to reject and delete the registration for '${username}'?`, __async(function*() {
      try {
        const res = yield fetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
          app.showNotificationModal("Success", `Registration for '${username}' rejected and removed.`, false);
          yield app.loadConfigData();
        } else {
          const err = yield res.json();
          app.showNotificationModal("Error", err.detail || 'Failed to reject registration.', true);
        }
      } catch (e) {
        app.showNotificationModal("Error", 'Connection error rejecting registration.', true);
      }
    }));
  }),

  deactivateUser: __async(function*(userId, role, cadre) {
    app.confirmAction("Deactivate User", "Are you sure you want to deactivate this account?", __async(function*() {
      yield app.saveUserUpdate(userId, { role: role, cadre: cadre || null, is_active: false });
      app.showNotificationModal("Success", 'User account deactivated.', false);
    }));
  }),

  changeUserFields: __async(function*(userId, isActive) {
    const roleEl = document.getElementById(`role-select-${userId}`);
    const cadreEl = document.getElementById(`cadre-select-${userId}`);
    if (!roleEl || !cadreEl) return;
    
    yield this.saveUserUpdate(userId, { role: roleEl.value, cadre: cadreEl.value || null, is_active: isActive });
    this.showNotificationModal("Success", 'User details updated successfully.', false);
  }),

  promptAction: function(title, message, callback) {
    const modal = document.getElementById('prompt-modal');
    if (!modal) {
      const result = prompt(message);
      if (result !== null) callback(result);
      return;
    }
    document.getElementById('prompt-title').textContent = title;
    document.getElementById('prompt-message').textContent = message;
    const input = document.getElementById('prompt-input');
    input.value = '';
    
    const cancelBtn = document.getElementById('prompt-cancel-btn');
    const okBtn = document.getElementById('prompt-ok-btn');
    
    const newCancel = cancelBtn.cloneNode(true);
    const newOk = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    
    newCancel.addEventListener('click', () => {
      app.closeModal(modal);
    });
    
    newOk.addEventListener('click', () => {
      app.closeModal(modal);
      callback(input.value);
    });

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        newOk.click();
      }
    };
    
    this.openModal(modal);
    input.focus();
  },

  promptResetPassword: __async(function*(userId, username, role, cadre) {
    app.promptAction("Reset Password", `Enter a new temporary password for user '${username}' (leave empty for default 'MLIS@1234'):`, __async(function*(tempPw) {
      try {
        const payload = tempPw && tempPw.trim().length > 0 ? { temporary_password: tempPw.trim() } : {};
        const res = yield fetch(`/api/auth/users/${userId}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = yield res.json();
          app.showNotificationModal("Success", `Password reset for '${username}'. Temporary password: ${data.temporary_password}`, false);
          yield app.loadConfigData();
        } else {
          const err = yield res.json();
          app.showNotificationModal("Error", err.detail || 'Failed to reset password.', true);
        }
      } catch(e) {
        app.showNotificationModal("Error", 'Connection error resetting password.', true);
      }
    }));
  }),

  saveUserUpdate: __async(function*(userId, updateBody) {
    try {
      const res = yield fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });
      if (res.ok) {
        if (userId === this.currentUser.id) {
          yield this.checkAuth();
        } else {
          yield this.loadConfigData();
        }
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || 'Failed to update user account.', true);
      }
    } catch (e) {
      this.showNotificationModal("Error", 'Connection error updating account.', true);
    }
  }),

  togglePanelGroup: function(panelId) {
    const rows = document.querySelectorAll(`tr[data-parent-id="${panelId}"]`);
    const btn = document.getElementById(`toggle-btn-${panelId}`);
    if (!rows || rows.length === 0) return;
    const isHidden = rows[0].style.display === 'none' || getComputedStyle(rows[0]).display === 'none';
    rows.forEach(row => { row.style.display = isHidden ? 'table-row' : 'none'; });
    if (btn) btn.textContent = isHidden ? '-' : '+';
  },

  openTestConfigModal: __async(function*(testId) {
    if (typeof testId === 'undefined') testId = null;
    // If editing, look up the test object from testCatalog (already loaded) or fetch it
    let test = null;
    if (testId !== null) {
      if (this.testCatalog && this.testCatalog.length > 0) {
        test = this.testCatalog.find(t => t.id === testId) || null;
      }
      if (!test) {
        try {
          const res = yield fetch('/api/config/tests');
          if (res.ok) {
            this.testCatalog = yield res.json();
            test = this.testCatalog.find(t => t.id === testId) || null;
          }
        } catch(e) {}
      }
    }
    
    // Load sections if not loaded
    if (!this.sections) {
      try {
        const res = yield fetch('/api/config/sections');
        if (res.ok) this.sections = yield res.json();
        else this.sections = [];
      } catch(e) { this.sections = []; }
    }

    const modal = document.getElementById('test-config-modal');
    const form = document.getElementById('test-config-form');
    form.reset();
    
    const secSelect = document.getElementById('test-config-section');
    secSelect.innerHTML = '<option value="">-- Select Section --</option>';
    this.sections.forEach(s => {
      secSelect.innerHTML += `<option value="${s.id}">${this.escape(s.name)}</option>`;
    });

    // Populate parent panel selector
    const parentSelect = document.getElementById('test-config-parent');
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">None (standalone test)</option>';
      const panels = (this.testCatalog || []).filter(t => t.result_type === 'panel' && t.is_active !== 0);
      panels.forEach(p => {
        parentSelect.innerHTML += `<option value="${p.id}">${this.escape(p.name)}</option>`;
      });
      parentSelect.value = (test && test.parent_rollup_id) ? test.parent_rollup_id : '';
    }

    if (test) {
      document.getElementById('test-config-title').textContent = 'Edit Test';
      document.getElementById('test-config-id').value = test.id;
      document.getElementById('test-config-name').value = test.name;
      document.getElementById('test-config-section').value = test.section_id;
      document.getElementById('test-config-result-type').value = test.result_type || 'qualitative';
      document.getElementById('test-config-unit').value = test.default_unit || '';
      const hasSecondary = !!test.secondary_unit;
      const multiCheckbox = document.getElementById('test-config-multi-units');
      if (multiCheckbox) multiCheckbox.checked = hasSecondary;
      const secGroup = document.getElementById('test-config-secondary-unit-group');
      if (secGroup) secGroup.style.display = hasSecondary ? 'block' : 'none';
      const secInput = document.getElementById('test-config-secondary-unit');
      if (secInput) secInput.value = test.secondary_unit || '';
      try {
        document.getElementById('test-config-options').value = test.options ? JSON.parse(test.options).join(', ') : '';
      } catch(e) {
        document.getElementById('test-config-options').value = '';
      }
      document.getElementById('test-config-tracked').checked = !!test.is_tracked;
      document.getElementById('test-config-tracks-stock').checked = !!test.tracks_stock;
      document.getElementById('test-config-consumable-name').value = test.consumable_name || '';
      document.getElementById('test-config-comments').value = test.clinical_comments || '';
    } else {
      document.getElementById('test-config-title').textContent = 'Add New Test';
      document.getElementById('test-config-id').value = '';
      document.getElementById('test-config-result-type').value = 'qualitative';
      document.getElementById('test-config-unit').value = '';
      const multiCheckbox = document.getElementById('test-config-multi-units');
      if (multiCheckbox) multiCheckbox.checked = false;
      const secGroup = document.getElementById('test-config-secondary-unit-group');
      if (secGroup) secGroup.style.display = 'none';
      const secInput = document.getElementById('test-config-secondary-unit');
      if (secInput) secInput.value = '';
      document.getElementById('test-config-options').value = '';
      document.getElementById('test-config-tracked').checked = true;
      document.getElementById('test-config-tracks-stock').checked = false;
      document.getElementById('test-config-consumable-name').value = '';
      document.getElementById('test-config-comments').value = '';
    }
    this.handleTestResultTypeChange();
    this.handleTestStockTrackingToggle();
    this.openModal(modal);
    
    form.onsubmit = __async(function*(e) {
      e.preventDefault();
      yield app.saveTestConfig();
    });
  }),

  handleTestMultiUnitsToggle: function() {
    const multiEl = document.getElementById('test-config-multi-units');
    const isMulti = multiEl ? multiEl.checked : false;
    const group = document.getElementById('test-config-secondary-unit-group');
    if (group) group.style.display = isMulti ? 'block' : 'none';
    if (!isMulti) {
      const secInput = document.getElementById('test-config-secondary-unit');
      if (secInput) secInput.value = '';
    }
  },

  handleTestStockTrackingToggle: function() {
    const isTracks = document.getElementById('test-config-tracks-stock').checked;
    const group = document.getElementById('test-config-consumable-group');
    if (group) group.style.display = isTracks ? 'block' : 'none';
    if (isTracks) {
      const nameInput = document.getElementById('test-config-consumable-name');
      if (nameInput && !nameInput.value.trim()) {
        const testName = document.getElementById('test-config-name').value.trim();
        if (testName) nameInput.value = testName;
      }
    }
  },

  handleTestResultTypeChange: function() {
    const rType = document.getElementById('test-config-result-type').value;
    const unitGroup = document.getElementById('test-config-unit-group');
    const unitInput = document.getElementById('test-config-unit');
    const unitLabel = document.getElementById('test-config-unit-label');
    const optionsGroup = document.getElementById('test-config-options-group');
    const trackedCheckbox = document.getElementById('test-config-tracked');
    const isNew = !document.getElementById('test-config-id').value;
    
    if (rType === 'quantitative') {
      unitGroup.style.display = 'block';
      if (unitLabel) unitLabel.textContent = 'Primary / Default Reporting Unit:';
      if (unitInput) unitInput.required = true;
      optionsGroup.style.display = 'none';
      document.getElementById('test-config-options').value = '';
      if (isNew) {
        trackedCheckbox.checked = false;
      }
    } else if (rType === 'semi_quantitative') {
      unitGroup.style.display = 'block';
      if (unitLabel) unitLabel.textContent = 'Reporting Unit (Optional):';
      if (unitInput) unitInput.required = false;
      optionsGroup.style.display = 'block';
      if (isNew) {
        trackedCheckbox.checked = true;
      }
    } else {
      // qualitative / options
      unitGroup.style.display = 'none';
      if (unitInput) {
        unitInput.required = false;
        unitInput.value = '';
      }
      optionsGroup.style.display = 'block';
      if (isNew) {
        trackedCheckbox.checked = true;
      }
    }
  },

  saveTestConfig: __async(function*() {
    const id = document.getElementById('test-config-id').value;
    const name = document.getElementById('test-config-name').value.trim();
    const section_id = parseInt(document.getElementById('test-config-section').value, 10);
    const result_type = document.getElementById('test-config-result-type').value;
    const default_unit = document.getElementById('test-config-unit').value.trim() || null;
    const multiEl = document.getElementById('test-config-multi-units');
    const isMultiUnit = multiEl ? multiEl.checked : false;
    const secUnitEl = document.getElementById('test-config-secondary-unit');
    const secUnitVal = (secUnitEl ? secUnitEl.value : '').trim();
    const secondary_unit = (isMultiUnit && secUnitVal) ? secUnitVal : null;
    const optionsRaw = document.getElementById('test-config-options').value;
    const is_tracked = document.getElementById('test-config-tracked').checked;
    const tracks_stock = document.getElementById('test-config-tracks-stock').checked;
    const consumable_name = tracks_stock ? (document.getElementById('test-config-consumable-name').value.trim() || name) : null;
    const clinical_comments = document.getElementById('test-config-comments').value.trim() || null;
    const parentRaw = document.getElementById('test-config-parent') ? document.getElementById('test-config-parent').value : '';
    const parent_rollup_id = parentRaw ? parseInt(parentRaw, 10) : null;

    if (result_type === 'quantitative' && !default_unit) {
      this.showNotificationModal("Validation Error", "Reporting unit is required for quantitative tests.", true);
      return;
    }
    
    let options = null;
    if (optionsRaw.trim() && (result_type === 'qualitative' || result_type === 'semi_quantitative')) {
      options = JSON.stringify(optionsRaw.split(',').map(s => s.trim()).filter(s => s));
    }

    const payload = { name, section_id, is_tracked, result_type, default_unit, secondary_unit, options, sort_order: 0, parent_rollup_id, tracks_stock, consumable_name, clinical_comments };
    
    try {
      let res;
      if (id) {
        res = yield fetch(`/api/config/tests/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = yield fetch(`/api/config/tests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      if (res.ok) {
        this.closeModal('test-config-modal');
        this.showNotificationModal("Success", `Test ${id ? 'updated' : 'added'} successfully.`);
        yield this.loadConfigData();
      } else {
        let errMessage = 'Failed to save test.';
        try {
          const err = yield res.json();
          if (err && err.detail) {
            errMessage = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
          }
        } catch(parseErr) {
          errMessage = `Server returned status ${res.status} (${res.statusText}).`;
        }
        this.showNotificationModal("Unable to Save Test", errMessage, true);
      }
    } catch (e) {
      this.showNotificationModal(
        "Connection Error",
        "Could not reach backend service. Verify server is running on port 8756 and retry.",
        true
      );
    }
  }),

  deleteTest: __async(function*(testId) {
    // Guard: block deletion of panel parent that still has children
    const hasChildren = (this.testCatalog || []).some(t => t.parent_rollup_id === testId);
    if (hasChildren) {
      this.showNotificationModal(
        "Cannot Delete Panel",
        "This panel still has parameters configured under it. Remove or reassign all parameters before deleting the panel.",
        true
      );
      return;
    }

    try {
      const usageRes = yield fetch(`/api/config/tests/${testId}/usage`);
      let confirmMsg = "Are you sure you want to deactivate this test from the catalog?";
      if (usageRes.ok) {
        const usage = yield usageRes.json();
        if (usage.has_history) {
          confirmMsg = `This test has historical clinical data (${usage.orders_count} order(s), ${usage.results_count} result(s)). Deactivating will hide it from future orders while safely preserving historical records. Proceed?`;
        } else if (usage.reference_ranges_count > 0) {
          confirmMsg = `This test has ${usage.reference_ranges_count} reference range rule(s) configured. Deactivating will remove it from the active menu. Proceed?`;
        }
      }

      app.confirmAction("Confirm Deactivation", confirmMsg, __async(function*() {
        try {
          const res = yield fetch(`/api/config/tests/${testId}`, { method: 'DELETE' });
          if (res.ok) {
            app.loadConfigData();
            app.showNotificationModal("Success", "Test successfully deactivated.", false);
          } else {
            const err = yield res.json();
            app.showNotificationModal("Error", (err && err.detail) ? err.detail : 'Failed to delete test.', true);
          }
        } catch (e) {
          app.showNotificationModal("Error", 'Connection error.', true);
        }
      }));
    } catch (e) {
      app.showNotificationModal("Error", 'Connection error retrieving test usage.', true);
    }
  }),


  renderAuditLog: __async(function*(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${this.icon('shield-check')} System Audit Trail</span>
        </div>
        <div id="audit-table-container">
          <p>Loading audit log...</p>
        </div>
      </div>
    `;
    try {
      const res = yield fetch('/api/audit-log');
      if (!res.ok) throw new Error('API returned ' + res.status);
      const logs = yield res.json();

      let rows = '';
      logs.forEach(l => {
        rows += `
          <tr>
            <td>${l.timestamp ? l.timestamp.replace('T', ' ').substring(0, 19) : ''}</td>
            <td><strong>${this.escape(l.username)}</strong></td>
            <td><code>${this.escape(l.action)}</code></td>
            <td>${this.escape(l.detail || '')}</td>
          </tr>
        `;
      });

      document.getElementById('audit-table-container').innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 180px;">Timestamp</th>
              <th style="width: 140px;">User</th>
              <th style="width: 160px;">Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    } catch (e) {
      console.error('Audit log error:', e);
    }
  }),


  });
})(window.app);

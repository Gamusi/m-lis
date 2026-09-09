// M-LIS Backlog Register & Matrix Workflow Module
(function(app) {
  Object.assign(app, {
  renderBacklog: __async(function*(container) {
    if (!this._backlogDate) {
      this._backlogDate = new Date().toISOString().split('T')[0];
    }
    const curDate = this._backlogDate;

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="card-title">${this.icon('book-open')} Historical & Backlog Register Entry</span>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 4px 0 0 0;">
              Record physical laboratory test register summary counts and source breakdown for any date.
            </p>
          </div>
          <div class="controls-row" style="flex-wrap: wrap; gap: 8px;">
            <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px; margin-bottom: 0;">
              <label for="backlog-date" style="font-weight: 600;">Entry Date:</label>
              <input type="date" id="backlog-date" value="${curDate}" onchange="app.onBacklogDateChange(this.value)" style="padding: 6px 10px; font-size: 0.9rem;">
              <div class="btn-group" style="display: flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(0)">Today</button>
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(-1, true)">Yesterday</button>
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(-1)">${this.icon('chevron-left')} Prev</button>
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(1)">Next ${this.icon('chevron-right')}</button>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="app.openBacklogCoverageModal()" title="View Coverage Calendar">
                ${this.icon('calendar')} Coverage Status
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="app.checkBacklogUnsavedChanges(() => app.loadBacklogData(document.getElementById('backlog-date').value))" title="Discard uncommitted changes">Reset Changes</button>
              <button type="button" id="btn-save-backlog" class="btn btn-primary btn-sm" onclick="app.saveBacklogData()" style="padding: 6px 14px; font-weight: 600;" title="Save backlog entries (Ctrl+S)">
                ${this.icon('save')} Save Backlog Entries
              </button>
            </div>
          </div>
        </div>

        <!-- Filters Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <label for="backlog-section-filter" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Section:</label>
              <select id="backlog-section-filter" onchange="app.filterBacklogTable()" style="padding: 4px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px;">
                <option value="all">All Sections</option>
              </select>
            </div>
            <div class="btn-group" style="display: flex; gap: 4px;">
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.78rem;" onclick="app.toggleAllBacklogSections(true)" title="Expand all sections">Expand All</button>
              <button type="button" class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 0.78rem;" onclick="app.toggleAllBacklogSections(false)" title="Collapse all sections">Collapse All</button>
            </div>
          </div>
          <input type="text" id="backlog-search" placeholder="Search tests..." onkeyup="app.filterBacklogTable()" style="padding: 4px 8px; font-size: 0.85rem; width: 180px; border: 1px solid var(--border-color); border-radius: 4px;">
        </div>

        <!-- Summary KPI Banner -->
        <div id="backlog-summary-container" style="background: var(--bg-color); padding: 12px 16px; margin-bottom: 20px; border-radius: 6px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; border: 1px solid var(--border-color);">
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Total Tests Done</span><strong style="font-size: 1.2rem; color: var(--primary-color);" id="backlog-summary-done">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Positive / Abnormal</span><strong style="font-size: 1.2rem; color: #DC2626;" id="backlog-summary-pos">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">In-House</span><strong style="font-size: 1.2rem; color: #2563EB;" id="backlog-summary-inhouse">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Referrals</span><strong style="font-size: 1.2rem; color: #D97706;" id="backlog-summary-ref">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Outreach</span><strong style="font-size: 1.2rem; color: #059669;" id="backlog-summary-outreach">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Self-Request</span><strong style="font-size: 1.2rem; color: #7C3AED;" id="backlog-summary-self">0</strong></div>
        </div>

        <div id="backlog-sections-container">
          <p style="color: var(--text-muted);">Loading backlog register...</p>
        </div>
      </div>
    `;

    yield this.loadBacklogData(curDate);
  }),

  _backlogIsDirty: false,

  setBacklogDirty: function(dirty) {
    this._backlogIsDirty = !!dirty;
    const saveBtn = document.getElementById('btn-save-backlog');
    if (saveBtn) {
      if (this._backlogIsDirty) {
        saveBtn.classList.remove('btn-primary');
        saveBtn.classList.add('btn-warning');
        saveBtn.innerHTML = `${this.icon('save')} Save Backlog Entries *`;
      } else {
        saveBtn.classList.remove('btn-warning');
        saveBtn.classList.add('btn-primary');
        saveBtn.innerHTML = `${this.icon('save')} Save Backlog Entries`;
      }
    }
  },

  checkBacklogUnsavedChanges: function(callback) {
    if (!this._backlogIsDirty) {
      callback();
      return;
    }
    this.confirmAction(
      "Unsaved Changes",
      "You have unsaved backlog entries. Switching date or resetting will discard them. Discard changes?",
      () => {
        this.setBacklogDirty(false);
        callback();
      }
    );
  },

  onBacklogDateChange: function(dateVal) {
    this.checkBacklogUnsavedChanges(() => {
      this._backlogDate = dateVal;
      this.loadBacklogData(dateVal);
    });
  },

  setBacklogDate: function(dateVal) {
    this.checkBacklogUnsavedChanges(() => {
      this._backlogDate = dateVal;
      const inp = document.getElementById('backlog-date');
      if (inp) inp.value = dateVal;
      this.loadBacklogData(dateVal);
    });
  },

  shiftBacklogDate: function(offset, isYesterday) {
    const inp = document.getElementById('backlog-date');
    let target = new Date();
    if (isYesterday) {
      target.setDate(target.getDate() - 1);
    } else if (offset !== 0 && inp && inp.value) {
      target = new Date(inp.value);
      target.setDate(target.getDate() + offset);
    } else if (offset === 0) {
      target = new Date();
    }
    const dStr = target.toISOString().split('T')[0];
    this.setBacklogDate(dStr);
  },

  toggleAllBacklogSections: function(openState) {
    document.querySelectorAll('.backlog-section-block').forEach(secBlock => {
      secBlock.open = !!openState;
    });
  },

  loadBacklogData: __async(function*(dateStr) {
    this.setBacklogDirty(false);
    const secContainer = document.getElementById('backlog-sections-container');
    if (!secContainer) return;

    try {
      secContainer.innerHTML = '<p style="color: var(--text-muted); padding: 20px 0;">Loading backlog register data...</p>';
      const res = yield fetch(`/api/backlog?date=${dateStr}`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = yield res.json();
      
      this._backlogCurrentData = data;

      // Update Section Filter Dropdown
      const filterSelect = document.getElementById('backlog-section-filter');
      if (filterSelect) {
        const curVal = filterSelect.value || 'all';
        let optionsHtml = '<option value="all">All Sections</option>';
        data.sections.forEach(s => {
          optionsHtml += `<option value="${s.section_id}">${this.escape(s.section_name)}</option>`;
        });
        filterSelect.innerHTML = optionsHtml;
        filterSelect.value = curVal;
      }

      // Render Tables
      secContainer.innerHTML = '';
      data.sections.forEach(sec => {
        let rowsHtml = '';
        sec.tests.forEach(t => {
          const tid = t.test_id;
          const done = t.done || 0;
          const pos = (t.positive !== null && t.positive !== undefined) ? t.positive : (t.is_tracked ? 0 : '');
          const inHouse = t.in_house !== undefined ? t.in_house : 0;
          const referral = t.referral || 0;
          const outreach = t.outreach || 0;
          const selfReq = t.self_request || 0;

          const posInputHtml = t.is_tracked
            ? `<input type="number" min="0" class="backlog-input backlog-input-pos" data-test-id="${tid}" data-tracked="1" value="${pos}" oninput="app.autoBalanceBacklogRow(${tid}, 'pos')" onkeydown="app.handleBacklogKeyNav(event, ${tid}, 'pos')" style="width: 70px; text-align: center; padding: 4px 6px; border: 1px solid #FCA5A5; border-radius: 4px; background: #FEF2F2;">`
            : `<span style="color: var(--text-muted); font-size: 0.8rem;">—</span>`;

          rowsHtml += `
            <tr class="backlog-row" data-test-id="${tid}" data-section-id="${sec.section_id}" data-test-name="${this.escape(t.test_name).toLowerCase()}">
              <td>
                <div style="font-weight: 600; color: var(--text-dark);">${this.escape(t.test_name)}</div>
              </td>
              <td style="text-align: center;">
                <input type="number" min="0" class="backlog-input backlog-input-inhouse" data-test-id="${tid}" value="${inHouse}" oninput="app.autoBalanceBacklogRow(${tid}, 'inhouse')" onkeydown="app.handleBacklogKeyNav(event, ${tid}, 'inhouse')" style="width: 70px; text-align: center; padding: 4px 6px; border: 1px solid #BFDBFE; border-radius: 4px; background: #EFF6FF;">
              </td>
              <td style="text-align: center;">
                <input type="number" min="0" class="backlog-input backlog-input-ref" data-test-id="${tid}" value="${referral}" oninput="app.autoBalanceBacklogRow(${tid}, 'ref')" onkeydown="app.handleBacklogKeyNav(event, ${tid}, 'ref')" style="width: 70px; text-align: center; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px;">
              </td>
              <td style="text-align: center;">
                <input type="number" min="0" class="backlog-input backlog-input-outreach" data-test-id="${tid}" value="${outreach}" oninput="app.autoBalanceBacklogRow(${tid}, 'outreach')" onkeydown="app.handleBacklogKeyNav(event, ${tid}, 'outreach')" style="width: 70px; text-align: center; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px;">
              </td>
              <td style="text-align: center;">
                <input type="number" min="0" class="backlog-input backlog-input-self" data-test-id="${tid}" value="${selfReq}" oninput="app.autoBalanceBacklogRow(${tid}, 'self')" onkeydown="app.handleBacklogKeyNav(event, ${tid}, 'self')" style="width: 70px; text-align: center; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px;">
              </td>
              <td style="text-align: center;">
                <input type="number" class="backlog-input backlog-input-done" data-test-id="${tid}" value="${done}" readonly tabindex="-1" style="width: 75px; text-align: center; font-weight: 700; padding: 4px 6px; border: 1px solid var(--border-color); border-radius: 4px; background: #F1F5F9; color: var(--text-dark); cursor: default;">
              </td>
              <td style="text-align: center;">
                ${posInputHtml}
              </td>
            </tr>
          `;
        });

        secContainer.innerHTML += `
          <details class="card backlog-section-block" data-section-id="${sec.section_id}" open style="margin-bottom: 16px;">
            <summary class="card-header" style="cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; user-select: none;">
              <span class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                ${this.icon('file-text')} Section: ${this.escape(sec.section_name)}
              </span>
              <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted); background: #F1F5F9; padding: 3px 10px; border-radius: 4px; border: 1px solid var(--border-color);">
                Total Done: <strong id="sec-done-total-${sec.section_id}" style="color: var(--primary-color);">0</strong> | 
                Positive / Abnormal: <strong id="sec-pos-total-${sec.section_id}" style="color: #DC2626;">0</strong>
              </span>
            </summary>
            <div style="padding: 16px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th style="width: 85px; text-align: center;">In-House</th>
                    <th style="width: 85px; text-align: center;">Referral</th>
                    <th style="width: 85px; text-align: center;">Outreach</th>
                    <th style="width: 85px; text-align: center;">Self-Req</th>
                    <th style="width: 90px; text-align: center;">Total Done</th>
                    <th style="width: 130px; text-align: center;">Positive / Abnormal</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>
          </details>
        `;
      });

      this.recalcBacklogTotals();
    } catch (e) {
      secContainer.innerHTML = `<p style="color: var(--danger-color); padding: 20px 0;">Failed to load backlog register: ${e.message}</p>`;
    }
  }),

  autoBalanceBacklogRow: function(testId, fieldChanged) {
    const doneInp = document.querySelector(`.backlog-input-done[data-test-id="${testId}"]`);
    const posInp = document.querySelector(`.backlog-input-pos[data-test-id="${testId}"]`);
    const inHouseInp = document.querySelector(`.backlog-input-inhouse[data-test-id="${testId}"]`);
    const refInp = document.querySelector(`.backlog-input-ref[data-test-id="${testId}"]`);
    const outreachInp = document.querySelector(`.backlog-input-outreach[data-test-id="${testId}"]`);
    const selfInp = document.querySelector(`.backlog-input-self[data-test-id="${testId}"]`);

    if (!doneInp) return;

    let inHouseVal = inHouseInp ? (parseInt(inHouseInp.value, 10) || 0) : 0;
    let refVal = refInp ? (parseInt(refInp.value, 10) || 0) : 0;
    let outreachVal = outreachInp ? (parseInt(outreachInp.value, 10) || 0) : 0;
    let selfVal = selfInp ? (parseInt(selfInp.value, 10) || 0) : 0;

    // Total Done is strictly calculated
    let doneVal = inHouseVal + refVal + outreachVal + selfVal;
    doneInp.value = doneVal;

    if (posInp && doneVal > 0) {
      let pVal = parseInt(posInp.value, 10) || 0;
      if (pVal > doneVal) {
        posInp.value = doneVal;
      }
    }

    this.recalcBacklogTotals();
    this.setBacklogDirty(true);
  },

  recalcBacklogTotals: function() {
    let grandDone = 0;
    let grandPos = 0;
    let grandInHouse = 0;
    let grandRef = 0;
    let grandOutreach = 0;
    let grandSelf = 0;

    document.querySelectorAll('.backlog-section-block').forEach(secBlock => {
      const secId = secBlock.getAttribute('data-section-id');
      let secDone = 0;
      let secPos = 0;

      secBlock.querySelectorAll('.backlog-row').forEach(row => {
        const tid = row.getAttribute('data-test-id');
        const doneInp = row.querySelector('.backlog-input-done');
        const posInp = row.querySelector('.backlog-input-pos');
        const inHouseInp = row.querySelector('.backlog-input-inhouse');
        const refInp = row.querySelector('.backlog-input-ref');
        const outreachInp = row.querySelector('.backlog-input-outreach');
        const selfInp = row.querySelector('.backlog-input-self');

        const d = doneInp ? (parseInt(doneInp.value, 10) || 0) : 0;
        const p = posInp ? (parseInt(posInp.value, 10) || 0) : 0;
        const ih = inHouseInp ? (parseInt(inHouseInp.value, 10) || 0) : 0;
        const r = refInp ? (parseInt(refInp.value, 10) || 0) : 0;
        const o = outreachInp ? (parseInt(outreachInp.value, 10) || 0) : 0;
        const s = selfInp ? (parseInt(selfInp.value, 10) || 0) : 0;

        secDone += d;
        secPos += p;

        grandDone += d;
        grandPos += p;
        grandInHouse += ih;
        grandRef += r;
        grandOutreach += o;
        grandSelf += s;
      });

      const secDoneEl = document.getElementById(`sec-done-total-${secId}`);
      const secPosEl = document.getElementById(`sec-pos-total-${secId}`);
      if (secDoneEl) secDoneEl.textContent = secDone;
      if (secPosEl) secPosEl.textContent = secPos;
    });

    const sumDone = document.getElementById('backlog-summary-done');
    const sumPos = document.getElementById('backlog-summary-pos');
    const sumInHouse = document.getElementById('backlog-summary-inhouse');
    const sumRef = document.getElementById('backlog-summary-ref');
    const sumOutreach = document.getElementById('backlog-summary-outreach');
    const sumSelf = document.getElementById('backlog-summary-self');

    if (sumDone) sumDone.textContent = grandDone;
    if (sumPos) sumPos.textContent = grandPos;
    if (sumInHouse) sumInHouse.textContent = grandInHouse;
    if (sumRef) sumRef.textContent = grandRef;
    if (sumOutreach) sumOutreach.textContent = grandOutreach;
    if (sumSelf) sumSelf.textContent = grandSelf;
  },

  handleBacklogKeyNav: function(event, testId, fieldName) {
    const key = event.key;
    const currentInput = event.target;
    const currentRow = currentInput ? currentInput.closest('.backlog-row') : null;

    if (key === 'Enter' || key === 'ArrowDown') {
      event.preventDefault();
      const allInputs = Array.from(document.querySelectorAll(`.backlog-input-${fieldName}`)).filter(el => el.offsetParent !== null);
      const curIdx = allInputs.indexOf(currentInput);
      if (curIdx >= 0 && curIdx < allInputs.length - 1) {
        allInputs[curIdx + 1].focus();
        allInputs[curIdx + 1].select();
      }
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      const allInputs = Array.from(document.querySelectorAll(`.backlog-input-${fieldName}`)).filter(el => el.offsetParent !== null);
      const curIdx = allInputs.indexOf(currentInput);
      if (curIdx > 0) {
        allInputs[curIdx - 1].focus();
        allInputs[curIdx - 1].select();
      }
    } else if (key === 'ArrowRight' && currentRow) {
      const rowInputs = Array.from(currentRow.querySelectorAll('.backlog-input:not([readonly])')).filter(el => el.offsetParent !== null);
      const curIdx = rowInputs.indexOf(currentInput);
      if (curIdx >= 0 && curIdx < rowInputs.length - 1) {
        event.preventDefault();
        rowInputs[curIdx + 1].focus();
        rowInputs[curIdx + 1].select();
      }
    } else if (key === 'ArrowLeft' && currentRow) {
      const rowInputs = Array.from(currentRow.querySelectorAll('.backlog-input:not([readonly])')).filter(el => el.offsetParent !== null);
      const curIdx = rowInputs.indexOf(currentInput);
      if (curIdx > 0) {
        event.preventDefault();
        rowInputs[curIdx - 1].focus();
        rowInputs[curIdx - 1].select();
      }
    }
  },

  filterBacklogTable: function() {
    const secVal = document.getElementById('backlog-section-filter') ? document.getElementById('backlog-section-filter').value : 'all';
    const query = document.getElementById('backlog-search') ? document.getElementById('backlog-search').value.toLowerCase().trim() : '';

    document.querySelectorAll('.backlog-section-block').forEach(secBlock => {
      const secId = secBlock.getAttribute('data-section-id');
      const matchSection = (secVal === 'all' || secVal === secId);
      let visibleRows = 0;

      secBlock.querySelectorAll('.backlog-row').forEach(row => {
        const testName = row.getAttribute('data-test-name') || '';
        const matchQuery = !query || testName.includes(query);

        if (matchSection && matchQuery) {
          row.style.display = '';
          visibleRows++;
        } else {
          row.style.display = 'none';
        }
      });

      secBlock.style.display = (matchSection && visibleRows > 0) ? '' : 'none';
      if (query && visibleRows > 0) {
        secBlock.open = true;
      }
    });
  },

  saveBacklogData: __async(function*() {
    const dateStr = document.getElementById('backlog-date').value;
    if (!dateStr) {
      this.showNotificationModal("Error", 'Please select a valid date.', true);
      return;
    }

    const entries = [];
    document.querySelectorAll('.backlog-row').forEach(row => {
      const tid = parseInt(row.getAttribute('data-test-id'), 10);
      const doneInp = row.querySelector('.backlog-input-done');
      const posInp = row.querySelector('.backlog-input-pos');
      const inHouseInp = row.querySelector('.backlog-input-inhouse');
      const refInp = row.querySelector('.backlog-input-ref');
      const outreachInp = row.querySelector('.backlog-input-outreach');
      const selfInp = row.querySelector('.backlog-input-self');

      let doneVal = doneInp ? (parseInt(doneInp.value, 10) || 0) : 0;
      const posVal = posInp ? (parseInt(posInp.value, 10) || 0) : null;
      const inHouseVal = inHouseInp ? (parseInt(inHouseInp.value, 10) || 0) : 0;
      const refVal = refInp ? (parseInt(refInp.value, 10) || 0) : 0;
      const outreachVal = outreachInp ? (parseInt(outreachInp.value, 10) || 0) : 0;
      const selfVal = selfInp ? (parseInt(selfInp.value, 10) || 0) : 0;
      const catSum = inHouseVal + refVal + outreachVal + selfVal;

      if (doneVal <= 0 && catSum > 0) {
        doneVal = catSum;
      }

      if (doneVal > 0 || (posVal !== null && posVal > 0) || catSum > 0) {
        entries.push({
          test_id: tid,
          done: doneVal,
          positive: posVal,
          in_house: inHouseVal,
          referral: refVal,
          outreach: outreachVal,
          self_request: selfVal
        });
      }
    });

    try {
      const res = yield fetch('/api/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: dateStr, entries: entries })
      });

      if (res.ok) {
        this.showNotificationModal("Success", `Backlog entries for ${dateStr} saved successfully!`, false);
        this.loadBacklogData(dateStr);
      } else {
        const err = yield res.json();
        this.showNotificationModal("Error", err.detail || 'Failed to save backlog entries.', true);
      }
    } catch (e) {
      this.showNotificationModal("Error", 'Connection error while saving backlog entries.', true);
    }
  }),

  openBacklogCoverageModal: function() {
    const today = new Date().toISOString().split('T')[0];
    const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const sInput = document.getElementById('coverage-start-date');
    const eInput = document.getElementById('coverage-end-date');
    
    if (sInput && !sInput.value) sInput.value = defaultStart;
    if (eInput && !eInput.value) eInput.value = today;

    this.openModal('backlog-coverage-modal');
    this.loadBacklogCoverageMatrix();
  },

  loadBacklogCoverageMatrix: __async(function*() {
    const sDate = document.getElementById('coverage-start-date').value;
    const eDate = document.getElementById('coverage-end-date').value;
    const container = document.getElementById('coverage-matrix-container');

    if (!sDate || !eDate) {
      if (container) container.innerHTML = '<p style="padding: 16px; color: var(--danger-color);">Please select both start and end dates.</p>';
      return;
    }

    try {
      if (container) container.innerHTML = '<p style="padding: 16px; color: var(--text-muted);">Loading coverage matrix...</p>';
      const res = yield fetch(`/api/backlog/status?start_date=${sDate}&end_date=${eDate}`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = yield res.json();

      const loggedEl = document.getElementById('cov-days-logged');
      const totalEl = document.getElementById('cov-total-days');
      const rateEl = document.getElementById('cov-rate');
      const totalTestsEl = document.getElementById('cov-total-tests');
      const totalPosEl = document.getElementById('cov-total-pos');

      if (loggedEl) loggedEl.textContent = data.total_days_logged;
      if (totalEl) totalEl.textContent = data.total_calendar_days;
      if (rateEl) rateEl.textContent = data.completion_rate + '%';
      if (totalTestsEl) totalTestsEl.textContent = data.total_tests_done;
      if (totalPosEl) totalPosEl.textContent = data.total_positive;

      let rowsHtml = '';
      data.days.forEach(d => {
        const statusText = d.has_data
          ? `Logged (${d.tests_done} tests)`
          : `Pending`;

        rowsHtml += `
          <tr style="${d.has_data ? 'background: #FAFDFA;' : ''}">
            <td><strong>${d.date}</strong></td>
            <td style="color: ${d.has_data ? '#166534' : 'var(--text-muted)'}; font-weight: ${d.has_data ? '600' : 'normal'};">${statusText}</td>
            <td style="text-align: right; font-weight: 500;">${d.tests_done}</td>
            <td style="text-align: right; color: #DC2626;">${d.positives}</td>
            <td style="text-align: right;">${d.in_house}</td>
            <td style="text-align: right;">${d.referral}</td>
            <td style="text-align: right;">${d.outreach}</td>
            <td style="text-align: right;">${d.self_request}</td>
            <td style="text-align: center;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="app.jumpToBacklogDate('${d.date}')" style="padding: 2px 8px; font-size: 0.75rem;">Open Date</button>
            </td>
          </tr>
        `;
      });

      if (container) {
        container.innerHTML = `
          <table class="data-table" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th style="text-align: right;">Tests Done</th>
                <th style="text-align: right;">Findings</th>
                <th style="text-align: right;">In-House</th>
                <th style="text-align: right;">Referral</th>
                <th style="text-align: right;">Outreach</th>
                <th style="text-align: right;">Self-Req</th>
                <th style="text-align: center;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      if (container) container.innerHTML = `<p style="padding: 16px; color: var(--danger-color);">Error loading matrix: ${e.message}</p>`;
    }
  }),

  jumpToBacklogDate: function(dateVal) {
    this.closeModal('backlog-coverage-modal');
    this.setBacklogDate(dateVal);
  }
  });
})(window.app);


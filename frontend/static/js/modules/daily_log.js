// M-LIS Daily Log & Shift Audit Workflow Module
(function(app) {
  Object.assign(app, {
  shiftLogDate: function(offsetDays) {
    const dateInput = document.getElementById('log-date');
    if (!dateInput) return;

    let current = new Date(dateInput.value || new Date());
    if (isNaN(current.getTime())) current = new Date();
    
    if (offsetDays === 0) {
      current = new Date();
    } else {
      current.setDate(current.getDate() + offsetDays);
    }

    const newDateStr = current.toISOString().split('T')[0];
    dateInput.value = newDateStr;
    this.loadDailyLogData(newDateStr);
  },

  // Daily Log View
  renderDailyLog: __async(function*(container) {
    const today = new Date().toISOString().split('T')[0];
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${this.icon('clipboard-list')} Daily Laboratory Tests Log</span>
          <div class="controls-row">
            <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">
              <label for="log-date">Entry Date:</label>
              <input type="date" id="log-date" value="${today}" onchange="app.loadDailyLogData(this.value)">
              <div class="btn-group" style="display: flex; gap: 4px;">
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="app.shiftLogDate(0)">Today</button>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="app.shiftLogDate(-1)">Yesterday</button>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="app.shiftLogDate(-1)">${this.icon('chevron-left')} Prev</button>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="app.shiftLogDate(1)">Next ${this.icon('chevron-right')}</button>
              </div>
            </div>
          </div>
        </div>

        <div id="daily-summary-container" style="background: var(--bg-color); padding: 12px; margin-bottom: 20px; border-radius: 6px; display: flex; gap: 32px; border: 1px solid var(--border-color);">
          <div><strong>Tests Done:</strong> <span id="summary-done">0</span></div>
          <div><strong>Tracked Findings:</strong> <span id="summary-pos">0</span></div>
          <div><strong>Pending Orders:</strong> <span id="summary-pending">0</span></div>
          <div><strong>Completed Orders:</strong> <span id="summary-completed">0</span></div>
        </div>

        <div id="daily-sections-container">
          <p style="color: var(--text-muted);">Loading daily log...</p>
        </div>
      </div>
    `;
    yield this.loadDailyLogData(today);
  }),

  loadDailyLogData: __async(function*(dateStr) {
    try {
      const res = yield fetch(`/api/daily-log?date=${dateStr}`);
      if (!res.ok) throw new Error('API returned ' + res.status);
      const data = yield res.json();
      
      if (data.today_check) {
        const doneEl = document.getElementById('summary-done');
        const posEl = document.getElementById('summary-pos');
        if (doneEl) doneEl.textContent = data.today_check.total_done;
        if (posEl) posEl.textContent = data.today_check.total_positive;
      }

      if (data.order_summary) {
        const pendEl = document.getElementById('summary-pending');
        const compEl = document.getElementById('summary-completed');
        if (pendEl) pendEl.textContent = data.order_summary.pending;
        if (compEl) compEl.textContent = data.order_summary.completed;
      }

      const secContainer = document.getElementById('daily-sections-container');
      secContainer.innerHTML = '';

      data.sections.forEach(sec => {
        let rowsHtml = '';
        let secDone = 0;
        let secPos = 0;

        sec.tests.forEach(t => {
          const done = t.done || 0;
          const pos = (t.positive !== null && t.positive !== undefined) ? t.positive : null;
          
          secDone += done;
          if (pos !== null) {
            secPos += pos;
          }

          let rateStr = '-';
          if (t.is_tracked && done > 0 && pos !== null) {
            rateStr = ((pos / done) * 100).toFixed(1) + '%';
          }

          const posDisplay = t.is_tracked 
            ? (pos !== null ? pos : 0)
            : 'N/A';

          rowsHtml += `
            <tr>
              <td><strong>${this.escape(t.test_name)}</strong></td>
              <td>${t.is_tracked ? 'Tracked' : 'Standard'}</td>
              <td style="text-align: right; font-weight: 500;">${done}</td>
              <td style="text-align: center; font-weight: 500;">${posDisplay}</td>
              <td style="text-align: right; color: var(--text-muted);">${rateStr}</td>
            </tr>
          `;
        });

        let secRateStr = '-';
        if (secDone > 0 && secPos > 0) {
          secRateStr = ((secPos / secDone) * 100).toFixed(1) + '%';
        }

        secContainer.innerHTML += `
          <details class="card" ${secDone > 0 ? 'open' : ''} style="margin-bottom: 16px;">
            <summary class="card-header" style="cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; user-select: none;">
              <span class="card-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">
                ${this.icon('file-text')} Section: ${this.escape(sec.section_name)}
              </span>
              <span style="font-size: 0.85rem; font-weight: 500; color: ${secDone > 0 ? 'var(--primary-color)' : 'var(--text-muted)'}; background: ${secDone > 0 ? 'rgba(37, 99, 235, 0.08)' : '#F1F5F9'}; padding: 3px 10px; border-radius: 4px; border: 1px solid var(--border-color);">
                Done: ${secDone} | Tracked: ${secPos}
              </span>
            </summary>
            <div style="padding: 16px;">
              <table class="data-table" data-section-id="${sec.section_id}">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th style="width: 110px;">Surveillance</th>
                    <th style="width: 120px; text-align: right;">Done Count</th>
                    <th style="width: 160px; text-align: center;">Tracked Findings</th>
                    <th style="width: 130px; text-align: right;">Incidence Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #F8FAFC; font-weight: 700;">
                    <td colspan="2">Subtotal &mdash; ${this.escape(sec.section_name)}</td>
                    <td style="text-align: right;">${secDone}</td>
                    <td style="text-align: center;">${secPos}</td>
                    <td style="text-align: right;">${secRateStr}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        `;
      });
    } catch (e) {
      console.error('Error loading daily log:', e);
    }
  }),

  // Backlog View

  });
})(window.app);

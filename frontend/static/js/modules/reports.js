// M-LIS Surveillance & Performance Reports Module
(function(app) {
  Object.assign(app, {
  renderReports: __async(function*(container) {
    if (!this.activeReportSubtab) {
      this.activeReportSubtab = 'operations';
    }
    
    container.innerHTML = `
      <div class="card">
        <div class="subtab-nav">
          <button id="report-subtab-ops" class="btn ${this.activeReportSubtab === 'operations' ? 'btn-primary' : 'btn-secondary'}" onclick="app.switchReportSubtab('operations')">
            ${this.icon('activity')} Operations & Performance
          </button>
          <button id="report-subtab-surv" class="btn ${this.activeReportSubtab === 'surveillance' ? 'btn-primary' : 'btn-secondary'}" onclick="app.switchReportSubtab('surveillance')">
            ${this.icon('shield')} Epidemiological Surveillance
          </button>
        </div>
        <div id="report-subtab-content"></div>
      </div>
    `;

    yield this.renderActiveReportSubtab();
  }),

  switchReportSubtab: __async(function*(tabName) {
    this.activeReportSubtab = tabName;
    var btnOps = document.getElementById('report-subtab-ops');
    var btnSurv = document.getElementById('report-subtab-surv');
    if (btnOps && btnSurv) {
      if (tabName === 'operations') {
        btnOps.className = 'btn btn-primary';
        btnSurv.className = 'btn btn-secondary';
      } else {
        btnOps.className = 'btn btn-secondary';
        btnSurv.className = 'btn btn-primary';
      }
    }
    yield this.renderActiveReportSubtab();
  }),

  renderActiveReportSubtab: __async(function*() {
    var subtabContainer = document.getElementById('report-subtab-content');
    if (!subtabContainer) return;
    if (this.activeReportSubtab === 'surveillance') {
      yield this.renderSurveillanceSubtab(subtabContainer);
    } else {
      yield this.renderOperationsSubtab(subtabContainer);
    }
  }),

  renderSurveillanceSubtab: __async(function*(container) {
    var today = new Date().toISOString().split('T')[0];
    container.innerHTML = `
      <div class="card-header" style="margin-top: 4px;">
        <span class="card-title">${this.icon('shield')} Laboratory Epidemiological Surveillance</span>
        <div class="controls-row">
          <div class="form-group">
            <label>Period Type:</label>
            <select id="surv-period-type" onchange="app.loadSurveillanceReport()">
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month" selected>Month</option>
              <option value="Quarter">Quarter</option>
              <option value="Half-Year">Half-Year</option>
              <option value="Financial Year">Financial Year (July-June)</option>
              <option value="Calendar Year">Calendar Year</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reference Date:</label>
            <input type="date" id="surv-ref-date" value="${today}" onchange="app.loadSurveillanceReport()">
          </div>
          <button class="btn btn-primary" onclick="app.printSurveillancePDF()">${this.icon('printer')} Print PDF</button>
          <button class="btn btn-secondary" onclick="app.exportSurveillanceCSV()">${this.icon('download')} Export CSV</button>
        </div>
      </div>

      <div id="surv-content-container">
        <p>Loading surveillance analytics...</p>
      </div>
    `;
    yield this.loadSurveillanceReport();
  }),

  renderOperationsSubtab: __async(function*(container) {
    var today = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="card-header" style="margin-top: 4px;">
        <span class="card-title">${this.icon('activity')} Laboratory Operations & Performance</span>
        <div class="controls-row">
          <div class="form-group">
            <label>Period Type:</label>
            <select id="ops-period-type" onchange="app.loadOperationsReport()">
              <option value="Day">Day</option>
              <option value="Week">Week</option>
              <option value="Month" selected>Month</option>
              <option value="Quarter">Quarter</option>
              <option value="Half-Year">Half-Year</option>
              <option value="Financial Year">Financial Year (July-June)</option>
              <option value="Calendar Year">Calendar Year</option>
            </select>
          </div>
          <div class="form-group">
            <label>Reference Date:</label>
            <input type="date" id="ops-ref-date" value="${today}" onchange="app.loadOperationsReport()">
          </div>
          <button class="btn btn-primary" onclick="app.printOperationsPDF()">${this.icon('printer')} Print PDF</button>
          <button class="btn btn-secondary" onclick="app.exportOperationsCSV()">${this.icon('download')} Export CSV</button>
        </div>
      </div>

      <div id="ops-content-container">
        <p>Loading operations analytics...</p>
      </div>
    `;
    yield this.loadOperationsReport();
  }),

  loadOperationsReport: __async(function*() {
    var pTypeEl = document.getElementById('ops-period-type');
    var rDateEl = document.getElementById('ops-ref-date');

    if (!pTypeEl || !rDateEl) return;
    var pType = pTypeEl.value;
    var rDate = rDateEl.value;

    var url = '/api/reports/operations?period_type=' + encodeURIComponent(pType) + '&reference_date=' + encodeURIComponent(rDate);

    try {
      var res = yield fetch(url);
      if (!res.ok) throw new Error('API returned ' + res.status);
      var data = yield res.json();
      this.currentOperationsData = data;
      this.renderOperationsDashboard(data);
    } catch(e) {
      console.error('Error loading operations report:', e);
      var container = document.getElementById('ops-content-container');
      if (container) {
        container.innerHTML = '<p style="color: var(--danger-color);">Failed to load operations metrics.</p>';
      }
    }
  }),

  renderOperationsDashboard: function(data) {
    var container = document.getElementById('ops-content-container');
    if (!container) return;

    var s = data.summary || {};
    var p = data.period || {};
    var em = data.emergency || {};
    var sections = data.sections_breakdown || [];
    var wards = data.wards_breakdown || [];
    var demand = data.demand_dynamics || {};

    var totDone = s.total_done !== undefined ? s.total_done : (s.total_tests_completed || 0);
    var totClients = s.total_clients !== undefined ? s.total_clients : (s.total_visits || 0);
    var menuCov = s.menu_coverage_percent !== undefined ? s.menu_coverage_percent : (s.menu_fulfillment_rate_percent || 0);

    // 1. 3 Clean KPI Cards (No subtext)
    var kpiHtml = `
      <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="kpi-card">
          <div class="kpi-title">TOTAL DONE</div>
          <div class="kpi-value">${totDone}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">TOTAL CLIENTS</div>
          <div class="kpi-value">${totClients}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">TEST MENU COVERAGE</div>
          <div class="kpi-value">${menuCov}%</div>
        </div>
      </div>
    `;

    // 2. Section Workload and TAT Table
    var secRows = '';
    sections.forEach(function(sec) {
      var rangeStr = sec.test_count > 0 ? (sec.min_tat_mins + 'm – ' + sec.max_tat_mins + 'm') : '—';
      secRows += `
        <tr>
          <td><strong>${app.escape(sec.section_name)}</strong></td>
          <td style="text-align: right;">${sec.test_count}</td>
          <td style="text-align: right;">${sec.volume_percentage}%</td>
          <td style="text-align: right;">${sec.avg_tat_mins}m</td>
          <td style="text-align: right;">${rangeStr}</td>
        </tr>
      `;
    });
    if (sections.length === 0) {
      secRows = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No section records in this period.</td></tr>';
    }

    var secTableHtml = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: var(--primary-color); font-size: 0.95rem; margin-bottom: 8px; font-weight: 700;">Section Workload and TAT</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Section Name</th>
              <th style="width: 120px; text-align: right;">Tests Done</th>
              <th style="width: 120px; text-align: right;">Share (%)</th>
              <th style="width: 120px; text-align: right;">Average TAT</th>
              <th style="width: 150px; text-align: right;">TAT Range (Min – Max)</th>
            </tr>
          </thead>
          <tbody>
            ${secRows}
          </tbody>
        </table>
      </div>
    `;

    // 3. Priority & Ward of Origin Summary
    var emergencyStatusText = em.has_emergency_data
      ? `${em.stat_count} orders (Avg TAT: ${em.stat_avg_tat_mins}m)`
      : '<span style="color: var(--text-muted); font-style: italic;">None recorded in this period</span>';

    // 3. Ward of Origin & Test Category Breakdown
    var catRows = '';
    (data.categories_breakdown || []).forEach(function(c) {
      catRows += `
        <tr>
          <td><strong>${app.escape(c.category)}</strong></td>
          <td style="text-align: right;">${c.count}</td>
          <td style="text-align: right;">${c.percentage}%</td>
        </tr>
      `;
    });

    var wardRows = '';
    wards.forEach(function(w) {
      wardRows += `
        <tr>
          <td><strong>${app.escape(w.ward)}</strong></td>
          <td style="text-align: right;">${w.count}</td>
          <td style="text-align: right;">${w.percentage}%</td>
        </tr>
      `;
    });
    if (wards.length === 0) {
      wardRows = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No ward records.</td></tr>';
    }

    // 4. Demand Dynamics (Top 5 vs Bottom 5 vs Unrequested)
    var top5Rows = '';
    (demand.top_requested_tests || []).forEach(function(t) {
      top5Rows += `
        <tr>
          <td><strong>${app.escape(t.test_name)}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${app.escape(t.section_name)})</span></td>
          <td style="text-align: right; font-weight: 700;">${t.count}</td>
        </tr>
      `;
    });
    if (!demand.top_requested_tests || demand.top_requested_tests.length === 0) {
      top5Rows = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">-</td></tr>';
    }

    var bottom5Rows = '';
    (demand.least_requested_tests || []).forEach(function(b) {
      bottom5Rows += `
        <tr>
          <td><strong>${app.escape(b.test_name)}</strong> <span style="font-size: 0.8rem; color: var(--text-muted);">(${app.escape(b.section_name)})</span></td>
          <td style="text-align: right; color: var(--text-muted);">${b.count}</td>
        </tr>
      `;
    });
    if (!demand.least_requested_tests || demand.least_requested_tests.length === 0) {
      bottom5Rows = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">-</td></tr>';
    }

    var unreqCount = (demand.unrequested_tests || []).length;

    var twoColumnHtml = `
      <div class="ops-charts-grid">
        <!-- Left: Ward of Origin & Category Breakdown -->
        <div class="card" style="margin-bottom: 0;">
          <h3 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 10px; font-weight: 700;">Workload by Ward of Origin</h3>
          <table class="data-table" style="margin-bottom: 14px;">
            <thead>
              <tr>
                <th>Ward of Origin</th>
                <th style="width: 100px; text-align: right;">Tests</th>
                <th style="width: 100px; text-align: right;">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${wardRows}
            </tbody>
          </table>

          <h3 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 8px; font-weight: 700;">Test Category Distribution</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style="width: 100px; text-align: right;">Tests Done</th>
                <th style="width: 100px; text-align: right;">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${catRows}
            </tbody>
          </table>
        </div>

        <!-- Right: Test Demand -->
        <div class="card" style="margin-bottom: 0;">
          <h3 style="font-size: 0.95rem; color: var(--primary-color); margin-bottom: 10px; font-weight: 700;">Test Demand</h3>
          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Top 5 Most Requested Tests</div>
            <table class="data-table">
              <tbody>
                ${top5Rows}
              </tbody>
            </table>
          </div>
          <div style="margin-bottom: 12px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Bottom 5 Least Requested Tests (Ordered ≥ 1)</div>
            <table class="data-table">
              <tbody>
                ${bottom5Rows}
              </tbody>
            </table>
          </div>
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; font-size: 0.82rem; color: var(--text-muted);">
            <strong>Unrequested Catalog Tests:</strong> ${unreqCount} active menu tests had zero requests in this period.
          </div>
        </div>
      </div>
    `;

    container.innerHTML = kpiHtml + secTableHtml + twoColumnHtml;
  },

  printOperationsPDF: function() {
    var pTypeEl = document.getElementById('ops-period-type');
    var rDateEl = document.getElementById('ops-ref-date');
    if (!pTypeEl || !rDateEl) return;
    var pType = pTypeEl.value;
    var rDate = rDateEl.value;

    var url = '/api/reports/operations/pdf?period_type=' + encodeURIComponent(pType) + '&reference_date=' + encodeURIComponent(rDate);
    window.open(url, '_blank');
  },

  exportOperationsCSV: function() {
    var data = this.currentOperationsData;
    if (!data) {
      this.showNotificationModal("Error", "No operations report data loaded.", true);
      return;
    }

    var s = data.summary || {};
    var p = data.period || {};
    var demand = data.demand_dynamics || {};
    var appTests = data.appendix_menu_activity || [];

    var csv = "Laboratory Operations & Performance Report\n";
    csv += "Reporting Period," + (p.formatted_period || p.period_type || '') + "\n";
    csv += "Date Range,Start: " + (p.start_date || '') + " to End: " + (p.end_date || '') + "\n\n";

    csv += "Key Performance Indicators\n";
    csv += "Total Done," + (s.total_done || s.total_tests_completed || 0) + "\n";
    csv += "Total Clients," + (s.total_clients || s.total_visits || 0) + "\n";
    csv += "Test Menu Coverage (%)," + (s.menu_coverage_percent || s.menu_fulfillment_rate_percent || 0) + "\n";
    csv += "Active Tests Ordered," + (s.unique_tests_ordered || 0) + " of " + (s.total_active_menu_items || 0) + "\n\n";

    csv += "Test Category Distribution\n";
    csv += "Category,Tests Done,Volume Share (%)\n";
    (data.categories_breakdown || []).forEach(function(c) {
      csv += '"' + c.category + '",' + c.count + ',' + c.percentage + '\n';
    });
    csv += "\n";

    csv += "Section Workload and TAT\n";
    csv += "Section Name,Tests Done,Share (%),Average TAT (mins),Min TAT (mins),Max TAT (mins)\n";
    (data.sections_breakdown || []).forEach(function(sec) {
      csv += '"' + sec.section_name + '",' + sec.test_count + ',' + sec.volume_percentage + ',' + sec.avg_tat_mins + ',' + (sec.min_tat_mins || 0) + ',' + (sec.max_tat_mins || 0) + '\n';
    });
    csv += "\n";

    csv += "Workload by Ward of Origin\n";
    csv += "Ward of Origin,Tests Processed,Volume Share (%)\n";
    (data.wards_breakdown || []).forEach(function(w) {
      csv += '"' + w.ward + '",' + w.count + ',' + w.percentage + '\n';
    });
    csv += "\n";

    csv += "Top 5 Most Requested Tests\n";
    csv += "Test Name,Section,Tests Done\n";
    (demand.top_requested_tests || []).forEach(function(t) {
      csv += '"' + t.test_name + '","' + (t.section_name || '') + '",' + t.count + '\n';
    });
    csv += "\n";

    csv += "Bottom 5 Least Requested Tests (Ordered >= 1)\n";
    csv += "Test Name,Section,Tests Done\n";
    (demand.least_requested_tests || []).forEach(function(b) {
      csv += '"' + b.test_name + '","' + (b.section_name || '') + '",' + b.count + '\n';
    });
    csv += "\n";

    csv += "Appendix: Complete Diagnostic Menu Activity\n";
    csv += "Section,Test Name,Completed Orders\n";
    appTests.forEach(function(at) {
      csv += '"' + at.section_name + '","' + at.test_name + '",' + at.completed_count + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'MLIS_Operations_Report_' + (p.period_type || 'Period') + '_' + (p.reference_date || 'date') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showNotificationModal("Success", 'Operations CSV exported successfully!', false);
  },

  loadSurveillanceReport: __async(function*() {
    var pTypeEl = document.getElementById('surv-period-type');
    var rDateEl = document.getElementById('surv-ref-date');

    if (!pTypeEl || !rDateEl) return;
    var pType = pTypeEl.value;
    var rDate = rDateEl.value;

    var url = '/api/reports/surveillance?period_type=' + encodeURIComponent(pType) + '&reference_date=' + encodeURIComponent(rDate);

    try {
      var res = yield fetch(url);
      if (!res.ok) {
        throw new Error('API returned ' + res.status);
      }
      var data = yield res.json();
      this.currentSurveillanceData = data;
      this.renderSurveillanceDashboard(data);
    } catch (e) {
      console.error('Surveillance report error:', e);
      var container = document.getElementById('surv-content-container');
      if (container) {
        container.innerHTML = '<div style="color: var(--danger-color); padding: 12px;">Failed to load surveillance analytics: ' + this.escape(e.message) + '</div>';
      }
    }
  }),

  renderSurveillanceDashboard: function(data) {
    var container = document.getElementById('surv-content-container');
    if (!container) return;

    var s = data.summary || {};
    var sections = data.sections_breakdown || [];
    var ledger = data.surveillance_ledger || [];
    var wards = data.wards_breakdown || [];

    // 1. 3 Clean KPI Cards
    var kpiHtml = `
      <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
        <div class="kpi-card">
          <div class="kpi-title">TOTAL EVALUATED</div>
          <div class="kpi-value">${s.total_evaluated || 0}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--danger-color, #B91C1C);">
          <div class="kpi-title">POSITIVE / INCIDENT CASES</div>
          <div class="kpi-value" style="color: #B91C1C;">${s.total_incident_cases || 0}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">INCIDENCE / POSITIVITY RATE</div>
          <div class="kpi-value">${s.overall_incidence_rate || 0.0}%</div>
        </div>
      </div>
    `;

    // 2. Section Surveillance Summary Table
    var secRows = '';
    sections.forEach(function(sec) {
      secRows += `
        <tr>
          <td><strong>${app.escape(sec.section_name)}</strong></td>
          <td style="text-align: right;">${sec.evaluated_count}</td>
          <td style="text-align: right; color: #B91C1C; font-weight: 700;">${sec.incident_count}</td>
          <td style="text-align: right;">${sec.incidence_rate_percent}%</td>
        </tr>
      `;
    });
    if (sections.length === 0) {
      secRows = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No section records in this period.</td></tr>';
    }

    var secTableHtml = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: var(--primary-color); font-size: 0.95rem; margin-bottom: 8px; font-weight: 700;">Section Surveillance Summary</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Section Name</th>
              <th style="width: 140px; text-align: right;">Tests Evaluated</th>
              <th style="width: 140px; text-align: right;">Positive / Incident</th>
              <th style="width: 140px; text-align: right;">Incidence Rate (%)</th>
            </tr>
          </thead>
          <tbody>
            ${secRows}
          </tbody>
        </table>
      </div>
    `;

    // 3. Disease & Syndrome Surveillance Ledger Table
    var ledgerRows = '';
    ledger.forEach(function(item) {
      ledgerRows += `
        <tr>
          <td><strong>${app.escape(item.test_name)}</strong></td>
          <td><span style="font-size: 0.82rem; color: var(--text-muted);">${app.escape(item.section_name)}</span></td>
          <td style="text-align: right;">${item.evaluated}</td>
          <td style="text-align: right; color: #B91C1C; font-weight: 700;">${item.positive}</td>
          <td style="text-align: right;">${item.negative}</td>
          <td style="text-align: right; font-weight: 700;">${item.incidence_rate}%</td>
        </tr>
      `;
    });
    if (ledger.length === 0) {
      ledgerRows = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No tracked surveillance tests recorded.</td></tr>';
    }

    var ledgerTableHtml = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: var(--primary-color); font-size: 0.95rem; margin-bottom: 8px; font-weight: 700;">Disease & Syndrome Surveillance Ledger</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Disease / Condition / Assay</th>
              <th style="width: 180px;">Section</th>
              <th style="width: 100px; text-align: right;">Evaluated</th>
              <th style="width: 100px; text-align: right;">Positive</th>
              <th style="width: 100px; text-align: right;">Negative</th>
              <th style="width: 130px; text-align: right;">Incidence Rate (%)</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerRows}
          </tbody>
        </table>
      </div>
    `;

    // 4. Positive Cases by Ward of Origin
    var wardRows = '';
    wards.forEach(function(w) {
      wardRows += `
        <tr>
          <td><strong>${app.escape(w.ward)}</strong></td>
          <td style="text-align: right;">${w.evaluated}</td>
          <td style="text-align: right; color: #B91C1C; font-weight: 700;">${w.positive_cases}</td>
          <td style="text-align: right;">${w.incidence_rate}%</td>
        </tr>
      `;
    });
    if (wards.length === 0) {
      wardRows = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No ward records in this period.</td></tr>';
    }

    var wardTableHtml = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: var(--primary-color); font-size: 0.95rem; margin-bottom: 8px; font-weight: 700;">Positive Cases by Ward of Origin</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Ward of Origin</th>
              <th style="width: 130px; text-align: right;">Evaluated Tests</th>
              <th style="width: 130px; text-align: right;">Positive Cases</th>
              <th style="width: 140px; text-align: right;">Positivity Rate (%)</th>
            </tr>
          </thead>
          <tbody>
            ${wardRows}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = kpiHtml + secTableHtml + ledgerTableHtml + wardTableHtml;
  },

  printSurveillancePDF: function() {
    var pTypeEl = document.getElementById('surv-period-type');
    var rDateEl = document.getElementById('surv-ref-date');
    if (!pTypeEl || !rDateEl) return;
    var pType = pTypeEl.value;
    var rDate = rDateEl.value;

    var url = '/api/reports/surveillance/pdf?period_type=' + encodeURIComponent(pType) + '&reference_date=' + encodeURIComponent(rDate);
    window.open(url, '_blank');
  },

  exportSurveillanceCSV: function() {
    var data = this.currentSurveillanceData;
    if (!data) {
      this.showNotificationModal("Error", "No surveillance report data loaded.", true);
      return;
    }

    var s = data.summary || {};
    var p = data.period || {};

    var csv = "Laboratory Epidemiological Surveillance Report\n";
    csv += "Reporting Period," + (p.formatted_period || p.period_type || '') + "\n";
    csv += "Date Range,Start: " + (p.start_date || '') + " to End: " + (p.end_date || '') + "\n\n";

    csv += "Key Epidemiological Indicators\n";
    csv += "Total Evaluated," + (s.total_evaluated || 0) + "\n";
    csv += "Positive / Incident Cases," + (s.total_incident_cases || 0) + "\n";
    csv += "Incidence / Positivity Rate (%)," + (s.overall_incidence_rate || 0.0) + "\n\n";

    csv += "Section Surveillance Summary\n";
    csv += "Section Name,Tests Evaluated,Positive Cases,Incidence Rate (%)\n";
    (data.sections_breakdown || []).forEach(function(sec) {
      csv += '"' + sec.section_name + '",' + sec.evaluated_count + ',' + sec.incident_count + ',' + sec.incidence_rate_percent + '\n';
    });
    csv += "\n";

    csv += "Disease & Syndrome Surveillance Ledger\n";
    csv += "Disease / Condition / Assay,Section,Evaluated,Positive,Negative,Incidence Rate (%)\n";
    (data.surveillance_ledger || []).forEach(function(item) {
      csv += '"' + item.test_name + '","' + item.section_name + '",' + item.evaluated + ',' + item.positive + ',' + item.negative + ',' + item.incidence_rate + '\n';
    });
    csv += "\n";

    csv += "Positive Cases by Ward of Origin\n";
    csv += "Ward of Origin,Evaluated Tests,Positive Cases,Positivity Rate (%)\n";
    (data.wards_breakdown || []).forEach(function(w) {
      csv += '"' + w.ward + '",' + w.evaluated + ',' + w.positive_cases + ',' + w.incidence_rate + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'MLIS_Surveillance_Report_' + (p.period_type || 'Period') + '_' + (p.reference_date || 'date') + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showNotificationModal("Success", 'Surveillance CSV exported successfully!', false);
  }
  });
})(window.app);


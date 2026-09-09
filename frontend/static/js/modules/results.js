// M-LIS Test Result Entry & Analyzer Clipboard Portal Module
(function(app) {
  Object.assign(app, {
  parseAndPopulateAnalyzerData: __async(function*() {
    const rawText = document.getElementById('analyzer-raw-input').value.trim();
    const statusSpan = document.getElementById('analyzer-parse-status');
    if (!rawText) {
      this.showNotificationModal("Error", "Please paste raw output from the analyzer first.", true);
      return;
    }

    try {
      const res = yield fetch('/api/integrations/parse-analyzer-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyzer_type: 'nihon_kohden', raw_text: rawText })
      });

      if (!res.ok) {
        const err = yield res.json();
        this.showNotificationModal("Parsing Failed", err.detail || "Failed to parse analyzer output.", true);
        return;
      }

      const data = yield res.json();
      if (data.status !== 'success' || !data.parameters) {
        this.showNotificationModal("Error", "No parameters extracted from output.", true);
        return;
      }

      // Populate each parameter input row by matching name
      let populatedCount = 0;
      const paramRows = document.querySelectorAll('.modal-param-row');
      data.parameters.forEach(p => {
        paramRows.forEach(row => {
          const nameEl = row.querySelector('strong');
          if (nameEl && nameEl.textContent.trim().toLowerCase() === p.name.trim().toLowerCase()) {
            const input = row.querySelector('.modal-param-val');
            if (input) {
              input.value = p.value;
              // store device flag if present
              if (p.flag) {
                row.setAttribute('data-device-flag', p.flag);
              }
              populatedCount++;
            }
          }
        });
      });

      if (statusSpan) {
        statusSpan.textContent = `Captured: ${populatedCount} parameters (Sample: ${data.sample_id || 'N/A'})`;
      }
      this.showNotificationModal("Success", `Captured ${populatedCount} CBC parameters from ${data.device_model || 'Analyzer'}. Review values and save.`, false);
      this.toggleAnalyzerPaste(false);
    } catch(err) {
      console.error(err);
      this.showNotificationModal("Error", "Failed to connect to parser service.", true);
    }
  }),

  handleUrinalysisMultiSelect: function(checkboxEl) {
    if (!checkboxEl) return;
    const container = checkboxEl.closest('.modal-param-multiselect');
    if (!container) return;
    const val = checkboxEl.value.trim();
    const allCbs = container.querySelectorAll('.modal-param-checkbox');

    if (val === 'Not Seen') {
      if (checkboxEl.checked) {
        allCbs.forEach(cb => {
          if (cb !== checkboxEl) cb.checked = false;
        });
      }
    } else {
      if (checkboxEl.checked) {
        allCbs.forEach(cb => {
          if (cb.value.trim() === 'Not Seen') cb.checked = false;
        });
      } else {
        // If nothing is checked, re-check "Not Seen"
        const anyChecked = Array.from(allCbs).some(cb => cb.checked);
        if (!anyChecked) {
          allCbs.forEach(cb => {
            if (cb.value.trim() === 'Not Seen') cb.checked = true;
          });
        }
      }
    }
  },

  showEnterResultModal: __async(function*(orderId, testId, testName, existingVal, existingUnit, visitId, specimenName) {
    if (typeof existingVal === 'undefined') existingVal = null;
    if (typeof existingUnit === 'undefined') existingUnit = null;
    if (typeof visitId === 'undefined') visitId = null;
    if (typeof specimenName === 'undefined') specimenName = null;
    document.getElementById('result-entry-order-id').value = orderId;
    document.getElementById('result-entry-test-id').value = testId;
    document.getElementById('result-entry-visit-id').value = visitId || '';
    document.getElementById('result-entry-test-name').textContent = testName;

    const specBadge = document.getElementById('result-entry-specimen-badge');
    if (specBadge) {
      if (specimenName) {
        specBadge.textContent = 'Specimen: ' + specimenName;
        specBadge.style.display = 'inline-block';
      } else {
        specBadge.textContent = '';
        specBadge.style.display = 'none';
      }
    }

    const isEdit = existingVal !== null && existingVal !== undefined && existingVal !== '';
    document.getElementById('result-entry-is-edit').value = isEdit ? '1' : '0';
    
    const titleElem = document.getElementById('result-entry-modal-title');
    if (titleElem) titleElem.textContent = isEdit ? 'Edit Result' : 'Enter Result';

    const reasonGroup = document.getElementById('result-entry-reason-group');
    const reasonInput = document.getElementById('result-entry-reason');
    if (reasonGroup) {
      reasonGroup.style.display = isEdit ? 'block' : 'none';
      if (reasonInput) reasonInput.value = '';
    }

    const analyzerSection = document.getElementById('result-entry-analyzer-section');
    const isCBC = testName.toLowerCase().includes('cbc') || testName.toLowerCase().includes('complete blood count');
    if (analyzerSection) {
      analyzerSection.style.display = isCBC ? 'block' : 'none';
      this.toggleAnalyzerPaste(false);
      const rawInput = document.getElementById('analyzer-raw-input');
      if (rawInput) rawInput.value = '';
      const statusSpan = document.getElementById('analyzer-parse-status');
      if (statusSpan) statusSpan.textContent = '';
    }
    
    // Ensure testCatalog and reference ranges are loaded
    if (!this.testCatalog || this.testCatalog.length === 0) {
      try {
        const res = yield fetch('/api/config/tests');
        if (res.ok) this.testCatalog = yield res.json();
      } catch(e) {}
    }
    if (!this.referenceRangesList || this.referenceRangesList.length === 0) {
      try {
        const refRes = yield fetch('/api/config/reference-ranges');
        if (refRes.ok) this.referenceRangesList = yield refRes.json();
      } catch(e) {}
    }
    
    const singleContainer = document.getElementById('result-entry-single-container');
    const paramsContainer = document.getElementById('result-entry-params-container');
    const trackGroup = document.getElementById('result-entry-tracked-group');
    if (trackGroup) trackGroup.style.display = 'none';

    const submitBtn = document.getElementById('result-entry-submit-btn');
    if (submitBtn) {
      submitBtn.style.display = 'inline-block';
      submitBtn.textContent = 'Save Result';
      submitBtn.onclick = null;
    }
    const saveNextBtn = document.getElementById('result-entry-save-next-btn');
    if (saveNextBtn) {
      saveNextBtn.style.display = 'none';
      saveNextBtn.onclick = null;
    }
    
    paramsContainer.style.display = 'none';
    singleContainer.style.display = 'block';
    
    const nameLower = testName.toLowerCase();
    const test = (this.testCatalog || []).find(t => t.id === testId) || {};
    
    // Tailored Forms
    if (nameLower.indexOf('cross-matching') !== -1 || nameLower.indexOf('compatibility testing') !== -1) {
       singleContainer.style.display = 'none';
       paramsContainer.style.display = 'block';
       if (submitBtn) {
         submitBtn.textContent = 'Close';
         var selfApp = this;
         submitBtn.onclick = function(ev) {
           ev.preventDefault();
           selfApp.closeModal('result-entry-modal');
         };
       }

       var selfApp = this;
       function loadCrossmatchUnits() {
         fetch('/api/clients/orders/' + orderId + '/crossmatches')
           .then(function(res) { return res.json(); })
           .then(function(units) {
             var listContainer = document.getElementById('crossmatch-units-list');
             if (!listContainer) return;
             if (!units || units.length === 0) {
               listContainer.innerHTML = '<div style="padding:10px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:4px; text-align:center; color:#64748b; font-size:0.85rem;">No donor units recorded yet for this order.</div>';
               return;
             }
             var uHtml = '<table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-top:4px;">' +
               '<thead><tr style="background:#f1f5f9; text-align:left; border-bottom:1px solid #cbd5e1;">' +
               '<th style="padding:6px;">Unit Barcode</th>' +
               '<th style="padding:6px;">Group</th>' +
               '<th style="padding:6px;">Product</th>' +
               '<th style="padding:6px;">Expiry</th>' +
               '<th style="padding:6px;">Compatibility</th>' +
               '<th style="padding:6px; text-align:right;">Actions</th>' +
               '</tr></thead><tbody>';
             units.forEach(function(u) {
               var isCompat = u.compatibility_status === 'COMPATIBLE';
               var badgeColor = isCompat ? '#15803d' : '#b91c1c';
               var badgeBg = isCompat ? '#dcfce7' : '#fee2e2';
               uHtml += '<tr style="border-bottom:1px solid #e2e8f0;">' +
                 '<td style="padding:6px; font-weight:600;">' + selfApp.escape(u.donor_unit_id) + '</td>' +
                 '<td style="padding:6px;">' + selfApp.escape(u.donor_blood_group) + '</td>' +
                 '<td style="padding:6px;">' + selfApp.escape(u.product_type) + '</td>' +
                 '<td style="padding:6px;">' + selfApp.escape(u.expiry_date) + '</td>' +
                 '<td style="padding:6px;"><span style="padding:2px 6px; border-radius:3px; font-weight:600; font-size:0.75rem; color:' + badgeColor + '; background:' + badgeBg + ';">' + selfApp.escape(u.compatibility_status) + '</span></td>' +
                 '<td style="padding:6px; text-align:right; white-space:nowrap;">';
               if (isCompat) {
                 uHtml += '<button type="button" class="btn btn-sm btn-outline-primary print-label-btn" data-cm-id="' + u.id + '" style="padding:2px 8px; font-size:0.75rem; margin-right:4px;">Print Label</button>';
               }
               uHtml += '<button type="button" class="btn btn-sm btn-outline-danger delete-cm-btn" data-cm-id="' + u.id + '" style="padding:2px 8px; font-size:0.75rem;">Delete</button>';
               uHtml += '</td></tr>';
             });
             uHtml += '</tbody></table>';
             listContainer.innerHTML = uHtml;

             listContainer.querySelectorAll('.print-label-btn').forEach(function(btn) {
               btn.onclick = function() {
                 var cmId = btn.getAttribute('data-cm-id');
                 window.open('/api/reports/crossmatch/' + cmId + '/bag-label', '_blank');
               };
             });

             listContainer.querySelectorAll('.delete-cm-btn').forEach(function(btn) {
               btn.onclick = function() {
                 var cmId = btn.getAttribute('data-cm-id');
                 if (confirm('Delete this donor crossmatch record?')) {
                   fetch('/api/clients/crossmatches/' + cmId, { method: 'DELETE' })
                     .then(function(r) { return r.json(); })
                     .then(function(res) {
                       if (res.status === 'deleted') {
                         loadCrossmatchUnits();
                         if (selfApp.loadVisits) selfApp.loadVisits();
                       } else {
                         selfApp.showNotificationModal('Error', res.detail || 'Could not delete crossmatch.', true);
                       }
                     })
                     .catch(function(err) {
                       selfApp.showNotificationModal('Error', 'Failed to delete: ' + err.message, true);
                     });
                 }
               };
             });
           });
       }

       var cmHtml = '<div style="display:flex; flex-direction:column; gap:16px;">' +
         '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px;">' +
           '<h5 style="margin:0 0 6px 0; color:var(--primary-color); font-size:0.95rem;">Cross-Matched Donor Units</h5>' +
           '<div id="crossmatch-units-list"><div style="padding:10px; text-align:center; color:#64748b; font-size:0.85rem;">Loading recorded units...</div></div>' +
         '</div>' +
         '<div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:12px;">' +
           '<h5 style="margin:0 0 10px 0; color:var(--primary-color); font-size:0.95rem;">Add New Donor Unit Cross-Match</h5>' +
           '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 14px;">' +
             '<div>' +
               '<label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:3px;">Donor Unit Barcode / ID:</label>' +
               '<input type="text" id="cm-donor-unit-id" placeholder="e.g. UG-BTS-2026-98715" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem; text-transform:uppercase;">' +
             '</div>' +
             '<div>' +
               '<label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:3px;">Donor Blood Group:</label>' +
               '<select id="cm-donor-group" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' +
                 '<option value="O Rh(D) Positive">O Rh(D) Positive</option>' +
                 '<option value="O Rh(D) Negative">O Rh(D) Negative</option>' +
                 '<option value="A Rh(D) Positive">A Rh(D) Positive</option>' +
                 '<option value="A Rh(D) Negative">A Rh(D) Negative</option>' +
                 '<option value="B Rh(D) Positive">B Rh(D) Positive</option>' +
                 '<option value="B Rh(D) Negative">B Rh(D) Negative</option>' +
                 '<option value="AB Rh(D) Positive">AB Rh(D) Positive</option>' +
                 '<option value="AB Rh(D) Negative">AB Rh(D) Negative</option>' +
               '</select>' +
             '</div>' +
             '<div>' +
               '<label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:3px;">Product Type:</label>' +
               '<select id="cm-product-type" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' +
                 '<option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>' +
                 '<option value="Whole Blood">Whole Blood</option>' +
                 '<option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>' +
                 '<option value="Platelets (Platelet Concentrate)">Platelets (Platelet Concentrate)</option>' +
               '</select>' +
             '</div>' +
             '<div>' +
               '<label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:3px;">Unit Expiry Date:</label>' +
               '<input type="date" id="cm-expiry-date" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' +
             '</div>' +
           '</div>' +
           '<div style="margin-top:12px; padding-top:10px; border-top:1px dashed #cbd5e1;">' +
             '<label style="font-size:0.8rem; font-weight:600; color:var(--text-dark); display:block; margin-bottom:6px;">Multi-Phase Agglutination Results:</label>' +
             '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
               '<div>' +
                 '<span style="font-size:0.75rem; color:#64748b; display:block;">Phase 1: Immediate Spin</span>' +
                 '<select id="cm-phase-is" style="width:100%; padding:5px 6px; border:1px solid var(--border-color); border-radius:4px; font-size:0.82rem;">' +
                   '<option value="Negative">Negative</option><option value="Trace">Trace</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option><option value="4+">4+</option>' +
                 '</select>' +
               '</div>' +
               '<div>' +
                 '<span style="font-size:0.75rem; color:#64748b; display:block;">Phase 2: 37C Thermophase</span>' +
                 '<select id="cm-phase-thermo" style="width:100%; padding:5px 6px; border:1px solid var(--border-color); border-radius:4px; font-size:0.82rem;">' +
                   '<option value="Negative">Negative</option><option value="Trace">Trace</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option><option value="4+">4+</option>' +
                 '</select>' +
               '</div>' +
               '<div>' +
                 '<span style="font-size:0.75rem; color:#64748b; display:block;">Phase 3: AHG / Coombs</span>' +
                 '<select id="cm-phase-ahg" style="width:100%; padding:5px 6px; border:1px solid var(--border-color); border-radius:4px; font-size:0.82rem;">' +
                   '<option value="Negative">Negative</option><option value="Trace">Trace</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option><option value="4+">4+</option>' +
                 '</select>' +
               '</div>' +
             '</div>' +
           '</div>' +
           '<div style="margin-top:14px; text-align:right;">' +
             '<button type="button" id="cm-submit-unit-btn" class="btn btn-primary" style="padding:6px 14px; font-size:0.85rem;">Record & Verify Donor Unit</button>' +
           '</div>' +
         '</div>' +
       '</div>';

       paramsContainer.innerHTML = cmHtml;
       loadCrossmatchUnits();

       var recordBtn = document.getElementById('cm-submit-unit-btn');
       if (recordBtn) {
         recordBtn.onclick = function() {
           var unitId = (document.getElementById('cm-donor-unit-id').value || '').trim().toUpperCase();
           var dGroup = document.getElementById('cm-donor-group').value;
           var pType = document.getElementById('cm-product-type').value;
           var expDate = document.getElementById('cm-expiry-date').value;
           var pIs = document.getElementById('cm-phase-is').value;
           var pTh = document.getElementById('cm-phase-thermo').value;
           var pAhg = document.getElementById('cm-phase-ahg').value;

           if (!unitId) {
             selfApp.showNotificationModal('Validation Error', 'Donor Unit Barcode / ID is required.', true);
             return;
           }
           if (!expDate) {
             selfApp.showNotificationModal('Validation Error', 'Unit Expiry Date is required.', true);
             return;
           }

           fetch('/api/clients/orders/' + orderId + '/crossmatch', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               donor_unit_id: unitId,
               donor_blood_group: dGroup,
               product_type: pType,
               expiry_date: expDate,
               phase_is: pIs,
               phase_thermophase: pTh,
               phase_ahg: pAhg
             })
           })
           .then(function(res) {
             return res.json().then(function(data) {
               if (!res.ok) {
                 throw new Error(data.detail || 'Cross-match failed.');
               }
               return data;
             });
           })
           .then(function(data) {
             var msg = 'Donor unit ' + data.donor_unit_id + ' recorded as ' + data.compatibility_status + ' (' + data.release_status + ').';
             selfApp.showNotificationModal('Cross-Match Recorded', msg, data.compatibility_status === 'INCOMPATIBLE');
             document.getElementById('cm-donor-unit-id').value = '';
             loadCrossmatchUnits();
             if (selfApp.loadVisits) selfApp.loadVisits();
           })
           .catch(function(err) {
             selfApp.showNotificationModal('Compatibility Safety Block', err.message, true);
           });
         };
       }
    } else if (nameLower.indexOf('blood group') !== -1) {
       singleContainer.style.display = 'none';
       paramsContainer.style.display = 'block';
       var bgParamRes = yield fetch('/api/config/tests/' + testId + '/parameters');
       var bgParams = [];
       if (bgParamRes.ok) {
         bgParams = yield bgParamRes.json();
       }
       bgParams.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

       var selfApp = this;
       var bgHtml = '<div style="margin-bottom: 14px;">' +
         '<h5 style="margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--primary-color);">Forward Typing (Direct Cell Agglutination)</h5>' +
         '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">';
       
       var fwdParams = bgParams.filter(function(p) { return (p.parameter_name || '').indexOf('Forward') !== -1; });
       var revParams = bgParams.filter(function(p) { return (p.parameter_name || '').indexOf('Reverse') !== -1; });
       var cbgParam = bgParams.find(function(p) { return (p.parameter_name || '').indexOf('Consolidated') !== -1; });

       fwdParams.forEach(function(p) {
         bgHtml += '<div class="modal-param-row" data-param-id="' + p.id + '" data-param-name="' + selfApp.escape(p.parameter_name) + '" style="display:flex; flex-direction:column; gap:4px;">' +
           '<label style="font-size:0.8rem; font-weight:600;">' + selfApp.escape(p.parameter_name) + '</label>' +
           '<select class="modal-param-val bg-eval-trigger" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' +
             '<option value="No Agglutination (-)">No Agglutination (-)</option>' +
             '<option value="Agglutination (+)">Agglutination (+)</option>' +
           '</select>' +
         '</div>';
       });
       bgHtml += '</div></div>';

       bgHtml += '<div style="margin-bottom: 14px;">' +
         '<h5 style="margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--primary-color);">Reverse Typing (Serum/Plasma Confirmation)</h5>' +
         '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">';
       
       revParams.forEach(function(p) {
         bgHtml += '<div class="modal-param-row" data-param-id="' + p.id + '" data-param-name="' + selfApp.escape(p.parameter_name) + '" style="display:flex; flex-direction:column; gap:4px;">' +
           '<label style="font-size:0.8rem; font-weight:600;">' + selfApp.escape(p.parameter_name) + '</label>' +
           '<select class="modal-param-val bg-eval-trigger" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' +
             '<option value="Not Done" selected>Not Done</option>' +
             '<option value="No Agglutination (-)">No Agglutination (-)</option>' +
             '<option value="Agglutination (+)">Agglutination (+)</option>' +
           '</select>' +
         '</div>';
       });
       bgHtml += '</div></div>';

       if (cbgParam) {
         bgHtml += '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-top:8px;" class="modal-param-row" data-param-id="' + cbgParam.id + '" data-param-name="' + selfApp.escape(cbgParam.parameter_name) + '">' +
           '<label style="font-size:0.82rem; font-weight:700; color:var(--text-dark); display:block; margin-bottom:4px;">Consolidated Concordant Blood Group:</label>' +
           '<input type="text" id="bg-consolidated-val" class="modal-param-val" readonly style="width:100%; padding:6px 10px; font-weight:700; font-size:0.9rem; background:#fff; border:1px solid #94a3b8; border-radius:4px;" value="O Rh(D) Negative">' +
           '<div id="bg-discordance-alert" style="display:none; margin-top:6px; padding:6px 10px; background:#fef2f2; border:1px solid #f87171; border-radius:4px; color:#b91c1c; font-size:0.8rem; font-weight:600;">Grouping Discrepancy detected between forward and reverse typing. Unit release blocked.</div>' +
         '</div>';
       }
       paramsContainer.innerHTML = bgHtml;

       function updateBgEval() {
         var antiA = '', antiB = '', antiD = '', a1 = '', bCells = '';
         paramsContainer.querySelectorAll('.modal-param-row').forEach(function(row) {
           var pn = row.getAttribute('data-param-name') || '';
           var val = (row.querySelector('.modal-param-val') ? row.querySelector('.modal-param-val').value : '') || '';
           if (pn.indexOf('Anti-A') !== -1) antiA = val;
           if (pn.indexOf('Anti-B') !== -1) antiB = val;
           if (pn.indexOf('Anti-D') !== -1) antiD = val;
           if (pn.indexOf('A1-cells') !== -1) a1 = val;
           if (pn.indexOf('B-cells') !== -1) bCells = val;
         });

         var posA = antiA.indexOf('+') !== -1;
         var posB = antiB.indexOf('+') !== -1;
         var posD = antiD.indexOf('+') !== -1;

         var fwd = (posA && !posB) ? 'A' : (!posA && posB) ? 'B' : (posA && posB) ? 'AB' : 'O';

         function isOmitted(v) {
           if (!v) return true;
           var s = v.toLowerCase();
           return s.indexOf('not done') !== -1 || s === '-' || s === 'none' || s === 'omitted';
         }

         var revSkipped = isOmitted(a1) && isOmitted(bCells);
         var rev = null;
         if (!revSkipped) {
           var posA1 = a1.indexOf('+') !== -1;
           var posBCells = bCells.indexOf('+') !== -1;
           rev = (!posA1 && posBCells) ? 'A' : (posA1 && !posBCells) ? 'B' : (!posA1 && !posBCells) ? 'AB' : (posA1 && posBCells) ? 'O' : null;
         }

         var cVal = document.getElementById('bg-consolidated-val');
         var dAlert = document.getElementById('bg-discordance-alert');
         if (cVal) {
            if (revSkipped || fwd === rev) {
              cVal.value = fwd + ' Rh(D) ' + (posD ? 'Positive' : 'Negative');
              cVal.style.color = '#0f172a';
              cVal.style.borderColor = '#94a3b8';
              if (dAlert) dAlert.style.display = 'none';
            } else {
              cVal.value = 'Grouping Discrepancy';
              cVal.style.color = '#b91c1c';
              cVal.style.borderColor = '#f87171';
              if (dAlert) dAlert.style.display = 'block';
            }
          }
        }
        paramsContainer.querySelectorAll('.bg-eval-trigger').forEach(function(el) {
          el.onchange = updateBgEval;
        });
        updateBgEval();
     } else if (nameLower.indexOf('urinalysis') !== -1) {
        // URINALYSIS FULL MODAL — 3-section panel via API sub-parameters
        singleContainer.style.display = 'none';
        paramsContainer.style.display = 'block';
        var uaParamRes = yield fetch('/api/config/tests/' + testId + '/parameters');
        var uaParams = [];
        if (uaParamRes.ok) {
          uaParams = yield uaParamRes.json();
        }
       uaParams.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

       var UA_SECTIONS = [
         { label: 'Macroscopy', min: 1, max: 2 },
         { label: 'Microscopy', min: 3, max: 7 },
         { label: 'Dry Chemistry Dipstick', min: 8, max: 17 }
       ];

       var uaHtml = '';
       UA_SECTIONS.forEach(function(sec) {
         var secParams = uaParams.filter(function(p) {
           var so = p.sort_order || 0;
           return so >= sec.min && so <= sec.max;
         });
         if (!secParams.length) return;
         uaHtml += '<div style="margin-bottom: 18px;">';
         uaHtml += '<h5 style="margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-color); color: var(--primary-color);">' + sec.label + '</h5>';
         uaHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px;">';
         secParams.forEach(function(p) {
           var pName = p.parameter_name || p.name || '';
           var opts = [];
           try { if (p.options) opts = JSON.parse(p.options); } catch(e) {}
           var inputHtml = '';
           if (opts && opts.length > 0) {
             var optsHtml = opts.map(function(o) {
               return '<option value="' + o.split('"').join('&quot;') + '">' + o + '</option>';
             }).join('');
             inputHtml = '<select class="modal-param-val" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' + optsHtml + '</select>';
           } else {
             inputHtml = '<input type="text" class="modal-param-val" placeholder="Value" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">';
           }
           uaHtml += '<div class="modal-param-row" data-param-id="' + p.id + '" style="display:flex; flex-direction:column; gap:3px;">';
           uaHtml += '<label style="font-size:0.8rem; font-weight:600; color:var(--text-dark);">' + pName + '</label>';
           uaHtml += inputHtml;
           uaHtml += '</div>';
         });
         uaHtml += '</div></div>';
       });
       paramsContainer.innerHTML = uaHtml;
    } else if (nameLower.indexOf('widal') !== -1) {
       singleContainer.style.display = 'block';
       paramsContainer.style.display = 'none';

       var widalParamRes = yield fetch('/api/config/tests/' + testId + '/parameters');
       var widalParams = [];
       if (widalParamRes.ok) {
         widalParams = yield widalParamRes.json();
       }
       widalParams.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

       var isPos = isEdit && existingVal && existingVal.toLowerCase().indexOf('positive') !== -1;
       var widalHtml = '<div style="margin-bottom: 12px;">' +
         '<label style="font-size:0.85rem; font-weight:600; color:var(--text-dark);">WIDAL Primary Result:</label>' +
         '<select id="widal-res" onchange="var c = document.getElementById(\'widal-titers-container\'); if(c) c.style.display = (this.value === \'Positive\' ? \'block\' : \'none\');" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:4px; margin-top:4px; font-size:0.9rem;">' +
           '<option value="Negative"' + (!isPos ? ' selected' : '') + '>Negative (Non-Reactive)</option>' +
           '<option value="Positive"' + (isPos ? ' selected' : '') + '>Positive (Reactive)</option>' +
         '</select>' +
       '</div>' +
       '<div id="widal-titers-container" style="display:' + (isPos ? 'block' : 'none') + '; padding:12px; background:var(--bg-light, #f8fafc); border:1px solid var(--border-color, #e2e8f0); border-radius:6px; margin-top:10px;">' +
         '<div style="font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:8px;">Antigen Titration Breakdown (Optional):</div>' +
         '<div id="widal-antigen-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">';

       var DEFAULT_TITERS = ["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"];
       widalParams.forEach(function(p) {
         var pName = p.parameter_name || p.name || '';
         var opts = DEFAULT_TITERS;
         try { if (p.options) opts = JSON.parse(p.options); } catch(e) {}
         var optsHtml = opts.map(function(o) {
           return '<option value="' + o.split('"').join('&quot;') + '">' + o + '</option>';
         }).join('');
         widalHtml += '<div class="widal-param-row" data-param-id="' + p.id + '" data-param-name="' + pName.split('"').join('&quot;') + '" style="display:flex; flex-direction:column; gap:3px;">' +
           '<label style="font-size:0.8rem; font-weight:600; color:var(--text-dark);">' + pName + '</label>' +
           '<select class="widal-param-val" style="width:100%; padding:6px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:0.85rem;">' + optsHtml + '</select>' +
         '</div>';
       });

       widalHtml += '</div></div>';
       singleContainer.innerHTML = widalHtml;
    } else if (nameLower.indexOf('culture & sensitivity') !== -1 || nameLower.indexOf('c&s') !== -1) {
       this.initCultureSensitivityModal(orderId, testId, testName);
    } else {
        // Use the new dynamic system
        let options = [];
        try {
            if (test.options) options = JSON.parse(test.options);
        } catch (e) {}

        if (test.result_type === 'qualitative' || test.result_type === 'semi_quantitative' || test.result_type === 'options' || (options && options.length > 0)) {
            let rdtHint = '';
            if (nameLower.indexOf('cd4') !== -1 && (nameLower.indexOf('rapid') !== -1 || nameLower.indexOf('rdt') !== -1 || nameLower.indexOf('strip') !== -1)) {
              rdtHint = '<small style="display:block; margin-top:6px; padding:6px 8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; color:var(--text-dark); font-size:0.8rem;"><b>Clinical Staging SOP:</b> Below 200 cells/µL defines Advanced HIV Disease (AHD). If "Invalid", cassette run cannot be released—discard and repeat test.</small>';
            }
            if (options && options.length > 0) {
                let optsHtml = options.map(o => `<option value="${this.escape(o)}"${isEdit && existingVal === o ? ' selected' : ''}>${this.escape(o)}</option>`).join('');
                singleContainer.innerHTML = `
                  <label>Result:</label>
                  <select id="qual-res" style="width:100%; padding:8px;">
                    ${optsHtml}
                  </select>
                  ${rdtHint}
                `;
                if (isEdit && existingVal) {
                  const sel = document.getElementById('qual-res');
                  if (sel) sel.value = existingVal;
                }
            } else {
                singleContainer.innerHTML = `
                  <label>Result:</label>
                  <input type="text" id="result-entry-value" value="${isEdit ? this.escape(existingVal) : ''}" placeholder="Enter text result" style="width:100%; padding:8px;">
                  ${rdtHint}
                `;
            }
        } else {
            // quantitative
            let unitHtml = '';
            if (test.default_unit && test.secondary_unit) {
                unitHtml = `<select id="result-entry-unit" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;">
                    <option value="${this.escape(test.default_unit)}">${this.escape(test.default_unit)}</option>
                    <option value="${this.escape(test.secondary_unit)}">${this.escape(test.secondary_unit)}</option>
                </select>`;
            } else if (test.default_unit) {
                unitHtml = `<span style="padding: 8px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px;">${this.escape(test.default_unit)}</span>`;
            }
            let placeholderText = "Enter Value" + (test.ref_range ? '. Ref: ' + test.ref_range : '');
            let clinicalHint = '';
            if (nameLower.includes('hcg') && nameLower.includes('blood')) {
              placeholderText = "e.g. 150.0 (Non-pregnant: <5.0, Pregnant: >=25.0 mIU/mL)";
              clinicalHint = '<small style="display:block; margin-top:4px; color:var(--text-muted); font-size:0.75rem;"><b>Pregnancy Staging:</b> Baseline < 5.0 mIU/mL (Non-pregnant); >= 25.0 mIU/mL (Positive). Normal early gestation exhibits rapid doubling times (every 48-72h).</small>';
            } else if (nameLower.indexOf('percent') !== -1 || nameLower.indexOf('%') !== -1) {
              placeholderText = "e.g. 32.5 (Normal: >= 25.0%)";
              clinicalHint = '<small style="display:block; margin-top:6px; padding:6px 8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; color:var(--text-dark); font-size:0.8rem;"><b>Clinical Decision Support:</b> CD4% < 25.0% defines Pediatric Advanced HIV Disease (AHD) in clients under 5 years (< 60 months). Immediate pediatric ART regimen escalation and opportunistic infection screening indicated.</small>';
            } else if (nameLower.indexOf('cd4') !== -1 && nameLower.indexOf('rapid') === -1 && nameLower.indexOf('strip') === -1 && nameLower.indexOf('rdt') === -1) {
              placeholderText = "e.g. 450 (Adult Normal: 500 - 1500 cells/µL)";
              clinicalHint = '<small style="display:block; margin-top:6px; padding:6px 8px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:4px; color:var(--text-dark); font-size:0.8rem;"><b>Clinical Decision Support:</b> Absolute CD4 count < 200 cells/µL defines Advanced HIV Disease (AHD). Immediately initiate the national AHD package of care, including Urine TB-LAM, Sputum GeneXpert Ultra, and Serum CrAg screening.</small>';
            }

            singleContainer.innerHTML = `
              <div class="form-group" style="margin-bottom: 16px;">
                <label>Result Value:</label>
                <div style="display: flex; gap: 8px;">
                    <input type="number" step="any" id="result-entry-value" value="${isEdit ? this.escape(existingVal) : ''}" placeholder="${this.escape(placeholderText)}" style="flex: 1; padding: 8px;" oninput="app.evaluateResultPlausibilityLive(this, '${this.escape(testName)}')">
                    ${unitHtml}
                </div>
                <div id="result-entry-plausibility-msg" style="display: none; font-size: 0.82rem; margin-top: 6px; padding: 6px 10px; border-radius: 4px;"></div>
                ${clinicalHint}
              </div>
            `;
            if (isEdit && existingUnit && document.getElementById('result-entry-unit')) {
              document.getElementById('result-entry-unit').value = existingUnit;
            }
        }
        // Check for test parameters from test_parameters table
        try {
          const paramRes = yield fetch(`/api/config/tests/${testId}/parameters`);
          let paramsList = [];
          if (paramRes.ok) {
            paramsList = yield paramRes.json();
          }

          if (paramsList && paramsList.length > 0) {
            singleContainer.style.display = 'none';
            paramsContainer.style.display = 'block';
            let titleText = 'Panel Parameters:';
            if (nameLower.indexOf('hiv') !== -1) {
              titleText = 'HIV Diagnostic Kits & Protocols:';
            } else if (nameLower.indexOf('malaria') !== -1 && nameLower.indexOf('rdt') === -1) {
              titleText = 'Malaria Microscopy (Thick & Thin Film):';
            }
            let html = '<h5 style="color: var(--primary-color); margin-bottom: 8px;">' + titleText + '</h5>';
            const isHiv = nameLower.indexOf('hiv') !== -1;
            paramsList.forEach(p => {
              let unitDisplay = '';
              if (p.unit && p.secondary_unit) {
                unitDisplay = `<select class="modal-param-unit" onchange="const inp = this.closest('.modal-param-row').querySelector('.modal-param-val'); if (inp) app.evaluateResultPlausibilityLive(inp, '${this.escape(p.parameter_name)}');" style="padding: 6px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; font-weight: 500;">
                  <option value="${this.escape(p.unit)}">${this.escape(p.unit)}</option>
                  <option value="${this.escape(p.secondary_unit)}">${this.escape(p.secondary_unit)}</option>
                </select>`;
              } else if (p.unit) {
                unitDisplay = `<span class="modal-param-unit" data-unit="${this.escape(p.unit)}" style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); min-width: 48px;">${this.escape(p.unit)}</span>`;
              }

              let valInputHtml = '';
              let pOpts = [];
              try { if (p.options) pOpts = JSON.parse(p.options); } catch(e) {}
              if (isHiv && pOpts && pOpts.length > 0 && pOpts.indexOf('Not Done') === -1) {
                pOpts = ['Not Done'].concat(pOpts);
              }
              const pNameLower = (p.parameter_name || '').toLowerCase().trim();
              const isMultiOption = (pNameLower === 'casts' || pNameLower === 'crystals');

              if (isMultiOption && pOpts && pOpts.length > 0) {
                valInputHtml = `
                  <div class="modal-param-multiselect" style="display: flex; flex-wrap: wrap; gap: 4px; max-height: 120px; overflow-y: auto; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff;">
                    ${pOpts.map(o => `
                      <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; padding: 2px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; cursor: pointer; user-select: none;">
                        <input type="checkbox" class="modal-param-checkbox" value="${this.escape(o)}" onchange="app.handleUrinalysisMultiSelect(this)" ${o === 'Not Seen' ? 'checked' : ''}>
                        <span>${this.escape(o)}</span>
                      </label>
                    `).join('')}
                  </div>
                `;
              } else if (pOpts && pOpts.length > 0) {
                let optsHtml = pOpts.map(o => `<option value="${this.escape(o)}">${this.escape(o)}</option>`).join('');
                valInputHtml = `<select class="modal-param-val" style="width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.88rem;">${optsHtml}</select>`;
              } else {
                valInputHtml = `<input type="text" class="modal-param-val" placeholder="Result" style="width: 100%; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 4px; box-sizing: border-box; font-size: 0.88rem;" oninput="app.evaluateResultPlausibilityLive(this, '${this.escape(p.parameter_name)}')">`;
              }

              html += `
                <div style="padding: 8px 4px; border-bottom: 1px solid #edf2f7;" class="modal-param-row" data-param-id="${p.id}" data-param-name="${this.escape(p.parameter_name)}">
                  <div style="display: grid; grid-template-columns: 2fr 1.3fr; gap: 14px; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <strong style="font-size: 0.88rem; color: var(--text-dark);">${this.escape(p.parameter_name)}</strong>
                      ${p.ref_range ? `<span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.2;">Ref: ${this.escape(p.ref_range)}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <div style="flex: 1;">${valInputHtml}</div>
                      ${unitDisplay}
                    </div>
                  </div>
                  <div class="modal-param-plausibility-msg" style="display: none; font-size: 0.8rem; margin-top: 4px; padding: 4px 8px; border-radius: 4px;"></div>
                </div>
              `;
            });
            paramsContainer.innerHTML = html;
          }
        } catch(e) { console.error(e); }
    }

    // If editing and orderId is present, fetch existing order results to pre-populate panel inputs
    if (isEdit && orderId) {
      try {
        const existingResultsRes = yield fetch(`/api/orders/${orderId}/results`);
        if (existingResultsRes.ok) {
          const existingResults = yield existingResultsRes.json();
          if (existingResults && existingResults.length > 0) {
            existingResults.forEach(er => {
              if (er.parameter_id) {
                const row = paramsContainer.querySelector(`.modal-param-row[data-param-id="${er.parameter_id}"]`)
                  || (singleContainer ? singleContainer.querySelector(`.widal-param-row[data-param-id="${er.parameter_id}"]`) : null);
                if (row) {
                  const valInp = row.querySelector('.modal-param-val') || row.querySelector('.widal-param-val');
                  if (valInp && er.result_value !== null && er.result_value !== undefined) {
                    valInp.value = er.result_value;
                    if (valInp.classList.contains('bg-eval-trigger') && typeof updateBgEval === 'function') {
                      updateBgEval();
                    }
                  }
                  // Handle multiselect checkboxes (e.g. Urinalysis casts/crystals)
                  const mContainer = row.querySelector('.modal-param-multiselect');
                  if (mContainer && er.result_value) {
                    const vals = er.result_value.split(',').map(s => s.trim());
                    mContainer.querySelectorAll('.modal-param-checkbox').forEach(cb => {
                      cb.checked = vals.includes(cb.value.trim());
                    });
                  }
                  // Handle unit dropdown if present
                  const unitSelect = row.querySelector('select.modal-param-unit');
                  if (unitSelect && er.result_unit) {
                    unitSelect.value = er.result_unit;
                  }
                }
              }
            });
          }
        }
      } catch(err) {
        console.error('Failed to pre-populate panel parameter results:', err);
      }
    }

    // Save & Next Test: Check if this visit has other pending test orders
    let nextPendingOrder = null;
    if (visitId && !isEdit) {
      try {
        const vRes = yield fetch(`/api/visits/${visitId}`);
        if (vRes.ok) {
          const vData = yield vRes.json();
          if (vData.orders && vData.orders.length > 0) {
            nextPendingOrder = vData.orders.find(o => o.order_id !== orderId && o.status === 'pending');
          }
        }
      } catch (err) {
        console.debug('Error checking next pending order for visit:', err);
      }
    }

    if (saveNextBtn) {
      if (nextPendingOrder) {
        saveNextBtn.style.display = 'inline-block';
        saveNextBtn.textContent = `Save & Next: ${nextPendingOrder.test_name}`;
        const selfApp = this;
        saveNextBtn.onclick = function() {
          selfApp._shouldOpenNextPending = nextPendingOrder;
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        };
      } else {
        saveNextBtn.style.display = 'none';
        saveNextBtn.onclick = null;
      }
    }
    this._shouldOpenNextPending = null;

    this.openModal('result-entry-modal');
    
    // Add keyboard navigation
    const form = document.getElementById('result-entry-form');
    const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea')).filter(function(el) {
      return el.offsetParent !== null;
    });
    inputs.forEach((input, index) => {
      input.onkeydown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          return;
        }

        if (e.key === 'Enter') {
          if (input.tagName === 'TEXTAREA') return;
          e.preventDefault();
          const nextInput = inputs[index + 1];
          if (nextInput) {
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
          } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        } else if (e.key === 'ArrowDown' && input.tagName !== 'SELECT' && input.tagName !== 'TEXTAREA') {
          const nextInput = inputs[index + 1];
          if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
          }
        } else if (e.key === 'ArrowUp' && input.tagName !== 'SELECT' && input.tagName !== 'TEXTAREA') {
          const prevInput = inputs[index - 1];
          if (prevInput) {
            e.preventDefault();
            prevInput.focus();
            if (typeof prevInput.select === 'function') prevInput.select();
          }
        }
      };
    });
    
    form.onsubmit = __async(function*(e) {
       e.preventDefault();
       
       let finalVal = null;
       let paramResults = null;
       
       if (paramsContainer.style.display === 'block') {
         paramResults = [];
         let anyReactive = false;
         let anyTested = false;
         const rows = paramsContainer.querySelectorAll('.modal-param-row');
         rows.forEach(r => {
            const pid = parseInt(r.getAttribute('data-param-id'), 10);
            const valEl = r.querySelector('.modal-param-val');
            let pval = '';
            if (valEl) {
              pval = valEl.value.trim();
            } else {
              const checked = Array.from(r.querySelectorAll('.modal-param-checkbox:checked')).map(cb => cb.value.trim());
              pval = checked.length > 0 ? checked.join(', ') : 'Not Seen';
            }
            const uElem = r.querySelector('.modal-param-unit');
            let punit = null;
            if (uElem) {
              punit = uElem.tagName === 'SELECT' ? uElem.value : (uElem.getAttribute('data-unit') || uElem.textContent.trim());
            }
            if (pval && pval !== 'Not Done' && pval.indexOf('Not Done') === -1) {
              anyTested = true;
              if (pval === 'Reactive' || pval === 'Positive (Detected)') {
                anyReactive = true;
              }
              paramResults.push({ parameter_id: pid, result_value: pval, result_unit: punit });
            }
         });

         if (nameLower.indexOf('hiv') !== -1) {
           finalVal = anyReactive ? 'Reactive' : (anyTested ? 'Non-Reactive' : 'Completed');
         } else if (nameLower.indexOf('malaria') !== -1 && nameLower.indexOf('rdt') === -1) {
           let methodVal = '';
           let densityVal = 'No malaria parasites seen';
           let speciesVal = '';

           rows.forEach(r => {
             const pname = (r.getAttribute('data-param-name') || '').toLowerCase();
             const pval = r.querySelector('.modal-param-val').value.trim();
             if (pname.indexOf('method') !== -1 || pname.indexOf('film done') !== -1) methodVal = pval;
             if (pname.indexOf('density') !== -1 || pname.indexOf('thick') !== -1) densityVal = pval;
             if (pname.indexOf('species') !== -1 || pname.indexOf('thin') !== -1) speciesVal = pval;
           });

           if (densityVal.indexOf('No malaria parasites seen') !== -1) {
             if (speciesVal && speciesVal.indexOf('Not Seen') === -1 && speciesVal.indexOf('Not Done') === -1) {
               finalVal = 'Parasites seen: ' + speciesVal;
             } else {
               finalVal = 'No malaria parasites seen';
             }
           } else if (densityVal && densityVal !== 'Not Done') {
             if (speciesVal && speciesVal.indexOf('Not Seen') === -1 && speciesVal.indexOf('Not Done') === -1) {
               finalVal = densityVal + ' (' + speciesVal + ')';
             } else {
               finalVal = densityVal;
             }
           } else if (speciesVal && speciesVal.indexOf('Not Seen') === -1 && speciesVal.indexOf('Not Done') === -1) {
             finalVal = 'Parasites seen: ' + speciesVal;
           } else {
             finalVal = 'No malaria parasites seen';
           }
         } else if (nameLower.indexOf('blood group') !== -1) {
           var cbgEl = document.getElementById('bg-consolidated-val');
           finalVal = cbgEl ? cbgEl.value : 'Completed';
         } else {
           finalVal = 'Completed';
         }

       } else if (nameLower.indexOf('widal') !== -1) {
         const wRes = document.getElementById('widal-res').value;
         if (wRes === 'Positive') {
           const wRows = singleContainer.querySelectorAll('.widal-param-row');
           const wSummary = [];
           const wParamsList = [];
           wRows.forEach(r => {
             const pid = parseInt(r.getAttribute('data-param-id'), 10);
             const pname = r.getAttribute('data-param-name') || '';
             const pval = r.querySelector('.widal-param-val').value;
             if (pval && pval !== 'Not Done') {
               wParamsList.push({ parameter_id: pid, result_value: pval });
               let shortName = pname;
               if (pname.indexOf('(') !== -1 && pname.indexOf(')') !== -1) {
                 shortName = pname.split('(')[1].split(')')[0];
               }
               wSummary.push(shortName + ' ' + pval);
             }
           });
           if (wSummary.length > 0) {
             finalVal = 'Positive (' + wSummary.join(', ') + ')';
             paramResults = wParamsList;
           } else {
             finalVal = 'Positive';
             paramResults = null;
           }
         } else {
           finalVal = 'Negative';
           paramResults = null;
         }
        } else if (document.getElementById('qual-res')) {
          finalVal = document.getElementById('qual-res').value;
          if (nameLower.indexOf('cd4') !== -1 && (nameLower.indexOf('rapid') !== -1 || nameLower.indexOf('rdt') !== -1 || nameLower.indexOf('strip') !== -1)) {
            if (finalVal === 'Invalid') {
              app.showNotificationModal("Invalid Test Run", "Invalid RDT cassette run cannot be released as a final client result. Discard cassette, log wastage in inventory, and repeat test with a new cassette.", true);
              return;
            }
          }
        } else {
         finalVal = document.getElementById('result-entry-value').value.trim();
       }
       
       if ((!paramResults || paramResults.length === 0) && !finalVal) {
           app.showNotificationModal("Error", "Result cannot be empty.", true);
           return;
       }

       // Pre-submission physiological sanity check
       if (paramResults && paramResults.length > 0) {
         for (let i = 0; i < paramResults.length; i++) {
           const pr = paramResults[i];
           const pRow = paramsContainer.querySelector(`.modal-param-row[data-param-id="${pr.parameter_id}"]`);
           const pName = pRow ? (pRow.getAttribute('data-param-name') || '') : '';
           const check = app.checkPlausibilityLimits(pName, pr.result_value);
           if (check && check.level === 'sanity') {
             app.showNotificationModal("Physiological Sanity Breach", `Parameter '${pName}': ${check.message}`, true);
             return;
           }
         }
       } else if (finalVal) {
         const check = app.checkPlausibilityLimits(testName, finalVal);
         if (check && check.level === 'sanity') {
           app.showNotificationModal("Physiological Sanity Breach", check.message, true);
           return;
         }
       }
       
       try {
         if (paramResults && paramResults.length > 0) {
           const isEditMode = document.getElementById('result-entry-is-edit') ? document.getElementById('result-entry-is-edit').value === '1' : false;
           const editReason = document.getElementById('result-entry-reason') ? document.getElementById('result-entry-reason').value.trim() : '';
           if (isEditMode && !editReason) {
             app.showNotificationModal("Error", "Reason for edit is required.", true);
             return;
           }

           const res = yield fetch('/api/clients/results', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               order_id: orderId,
               result_value: "Completed",
               parameter_results: paramResults,
               edit_reason: isEditMode ? editReason : null
             })
           });
           if (!res.ok) {
             const err = yield res.json();
             app.showNotificationModal("Error", err.detail || "Failed to save results.", true);
             return;
           }
         } else {
            // Single order
            const unitElem = document.getElementById('result-entry-unit');
            const selectedUnit = unitElem ? (unitElem.tagName === 'SELECT' ? unitElem.value : unitElem.textContent.trim()) : null;
            const isEditMode = document.getElementById('result-entry-is-edit') ? document.getElementById('result-entry-is-edit').value === '1' : false;
            const editReason = document.getElementById('result-entry-reason') ? document.getElementById('result-entry-reason').value.trim() : '';

            if (isEditMode) {
              if (!editReason) {
                app.showNotificationModal("Error", "Reason for edit is required.", true);
                return;
              }
            }

            const payload = {
              order_id: orderId,
              result_value: finalVal,
              result_unit: selectedUnit,
              edit_reason: isEditMode ? editReason : null
            };
            const res = yield fetch('/api/clients/results', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) {
              const err = yield res.json();
              app.showNotificationModal("Error", err.detail || "Failed to save result.", true);
              return;
            }
         }
         
          const nextPending = app._shouldOpenNextPending;
          app._shouldOpenNextPending = null;

          if (app.currentClientId) {
             yield app.loadPendingTests(app.currentClientId);
             yield app.loadHistoricalVisits(app.currentClientId);
          }
          // Also refresh the edit visit modal tests list if it's currently open
          const editVisitId = (document.getElementById('edit-visit-id') ? document.getElementById('edit-visit-id').value : null);
          if (editVisitId && (document.getElementById('edit-visit-modal') ? document.getElementById('edit-visit-modal').style.display : null) !== 'none') {
            yield app.openEditVisitModal(parseInt(editVisitId, 10));
          }

          if (nextPending) {
            yield app.showEnterResultModal(nextPending.order_id, nextPending.test_id, nextPending.test_name, '', '', visitId);
          } else {
            app.showNotificationModal("Success", "Result saved successfully!", false);
            app.closeModal('result-entry-modal');
          }
       } catch(err) {
         console.error('Error saving result:', err);
         app.showNotificationModal("Error", "Connection error saving result.", true);
       }
    });
  }),

  findMatchingRefRangeRule: function(paramName, activeUnit) {
    if (!paramName || !this.referenceRangesList) return null;
    const nameLower = paramName.trim().toLowerCase();
    const unitLower = activeUnit ? activeUnit.trim().toLowerCase() : null;

    // Filter rules by parameter name
    let rules = this.referenceRangesList.filter(function(r) {
      return (r.parameter_name || '').trim().toLowerCase() === nameLower;
    });
    if (rules.length === 0) return null;

    // If unit is specified, prefer unit-matched rules
    if (unitLower) {
      const unitMatched = rules.filter(function(r) {
        return (r.unit || '').trim().toLowerCase() === unitLower;
      });
      if (unitMatched.length > 0) {
        rules = unitMatched;
      }
    }

    let clientAge = null;
    let clientSex = null;
    if (this.currentClientData) {
      clientSex = this.currentClientData.sex || null;
      if (this.currentClientData.age_years !== null && this.currentClientData.age_years !== undefined) {
        clientAge = parseFloat(this.currentClientData.age_years);
      }
    }

    // 1. Exact demographic match (age & sex)
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const aMin = r.age_min !== null ? r.age_min : 0;
      const aMax = r.age_max !== null ? r.age_max : 999;
      if (clientAge !== null && (clientAge < aMin || clientAge > aMax)) continue;
      if (r.sex && clientSex && r.sex.toLowerCase() !== clientSex.toLowerCase()) continue;
      return r;
    }

    // 2. Relax sex
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const aMin = r.age_min !== null ? r.age_min : 0;
      const aMax = r.age_max !== null ? r.age_max : 999;
      if (clientAge !== null && (clientAge < aMin || clientAge > aMax)) continue;
      return r;
    }

    return rules[0];
  },

  checkPlausibilityLimits: function(paramName, rawVal, activeUnit) {
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
      return null;
    }
    const valNum = parseFloat(String(rawVal).trim().split(' ')[0]);
    if (isNaN(valNum)) return null;

    const rule = this.findMatchingRefRangeRule(paramName, activeUnit);
    if (!rule) return null;

    const sMin = rule.sanity_min;
    const sMax = rule.sanity_max;
    const pMin = rule.plausible_min;
    const pMax = rule.plausible_max;
    const unitStr = rule.unit ? ` ${rule.unit}` : '';

    if ((sMin !== null && valNum < sMin) || (sMax !== null && valNum > sMax)) {
      const bStr = (sMin !== null && sMax !== null) ? `${sMin}–${sMax}` : (sMin !== null ? `>= ${sMin}` : `<= ${sMax}`);
      return {
        level: 'sanity',
        message: `Improbable physiological value (${valNum}${unitStr}). Bounds: ${bStr}. Verify dilution, sample integrity, or instrument calibration.`
      };
    }

    if ((pMin !== null && valNum < pMin) || (pMax !== null && valNum > pMax)) {
      const bStr = (pMin !== null && pMax !== null) ? `${pMin}–${pMax}` : (pMin !== null ? `>= ${pMin}` : `<= ${pMax}`);
      return {
        level: 'plausible',
        message: `Critical plausibility alert (${valNum}${unitStr}). Plausible: ${bStr}. Confirm before saving.`
      };
    }

    return null;
  },

  evaluateResultPlausibilityLive: function(inputEl, paramName) {
    if (!inputEl) return;
    const val = inputEl.value;

    // Detect active unit from sibling or parent row
    let activeUnit = null;
    const parentRow = inputEl.closest('.modal-param-row');
    if (parentRow) {
      const uEl = parentRow.querySelector('.modal-param-unit');
      if (uEl) {
        activeUnit = uEl.tagName === 'SELECT' ? uEl.value : (uEl.getAttribute('data-unit') || uEl.textContent.trim());
      }
    } else {
      const singleUnitEl = document.getElementById('result-entry-unit');
      if (singleUnitEl) {
        activeUnit = singleUnitEl.tagName === 'SELECT' ? singleUnitEl.value : singleUnitEl.textContent.trim();
      }
    }

    const check = this.checkPlausibilityLimits(paramName, val, activeUnit);

    // Locate feedback container (single modal container or modal-param-row container)
    let msgEl = null;
    if (parentRow) {
      msgEl = parentRow.querySelector('.modal-param-plausibility-msg');
    } else {
      msgEl = document.getElementById('result-entry-plausibility-msg');
    }

    if (!check) {
      inputEl.style.borderColor = '';
      inputEl.style.backgroundColor = '';
      if (msgEl) {
        msgEl.style.display = 'none';
        msgEl.textContent = '';
      }
    } else if (check.level === 'sanity') {
      inputEl.style.borderColor = '#B91C1C';
      inputEl.style.backgroundColor = '#FEF2F2';
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#991B1B';
        msgEl.style.backgroundColor = '#FEE2E2';
        msgEl.style.border = '1px solid #F87171';
        msgEl.textContent = check.message;
      }
    } else if (check.level === 'plausible') {
      inputEl.style.borderColor = '#D97706';
      inputEl.style.backgroundColor = '#FFFBEB';
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#92400E';
        msgEl.style.backgroundColor = '#FEF3C7';
        msgEl.style.border = '1px solid #FCD34D';
        msgEl.textContent = check.message;
      }
    }
  },

  submitTestResult: __async(function*(pid) {
    const tid = parseInt(document.getElementById('order-test-select').value, 10);
    const sampleId = document.getElementById('order-sample-id').value;
    const isPos = document.getElementById('order-result-pos').value === 'true';

    const paramRows = document.querySelectorAll('.panel-param-row');
    let paramResults = null;
    let mainResultValue = null;

    if (paramRows.length > 0) {
      paramResults = [];
      paramRows.forEach(row => {
        const paramId = parseInt(row.getAttribute('data-param-id'), 10);
        const val = row.querySelector('.param-val-input').value;
        const pos = row.querySelector('.param-pos-check').checked;
        if (val) {
          paramResults.push({ parameter_id: paramId, result_value: val, is_positive: pos });
        }
      });
      if (paramResults.length === 0) {
        this.showNotificationModal("Error", 'Please enter at least one parameter result for this panel.', true);
        return;
      }
    } else {
      mainResultValue = document.getElementById('order-result-value').value;
      if (!mainResultValue) {
        this.showNotificationModal("Error", 'Please enter a result value.', true);
        return;
      }
    }

    try {
      // 1. Create order
      const ordRes = yield fetch('/api/clients/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: pid, test_id: tid, sample_id: sampleId })
      });

      if (!ordRes.ok) throw new Error('Order creation failed');
      const ordData = yield ordRes.json();

      // 2. Submit result
      const resRes = yield fetch('/api/clients/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: ordData.order_id,
          result_value: mainResultValue,
          is_positive: isPos,
          parameter_results: paramResults
        })
      });

      if (resRes.ok) {
        this.showNotificationModal("Success", 'Result recorded successfully! Daily Log auto-incremented.', false);
        yield this.loadClientOrders(pid);
        // Print removed to avoid race conditions
      } else {
        this.showNotificationModal("Error", 'Failed to record result.', true);
      }
    } catch (e) {
      this.showNotificationModal("Error", 'Error submitting result.', true);
    }
  }),

  loadClientOrders: __async(function*(pid) {
    const frame = document.getElementById('report-frame');
    if (frame) {
      frame.src = `/api/reports/client/${pid}/pdf`;
    }
  }),

  showNewClientModal: function() {
    document.getElementById('new-client-form').reset();
    this.openModal('new-client-modal');
    document.getElementById('client-name').focus();
  },

  closeNewClientModal: function() {
    this.closeModal('new-client-modal');
  },

  updateAgePlaceholder: function() {
    const cat = document.getElementById('client-category').value;
    const ageInput = document.getElementById('client-age');
    if (!ageInput) return;
    if (cat === 'Neonate') ageInput.placeholder = "e.g. 14/365 or 14d";
    else if (cat === 'Infant') ageInput.placeholder = "e.g. 11/12 or 11m";
    else if (cat === 'Toddler') ageInput.placeholder = "e.g. 1 3/12 or 2y";
    else ageInput.placeholder = "e.g. 25, 25y";
  },


  initCultureSensitivityModal: function(orderId, testId, testName) {
    var singleContainer = document.getElementById('result-entry-single-container');
    var paramsContainer = document.getElementById('result-entry-params-container');
    var submitBtn = document.getElementById('result-entry-submit-btn');

    singleContainer.style.display = 'none';
    paramsContainer.style.display = 'block';
    if (submitBtn) {
      submitBtn.textContent = 'Save Culture Record';
    }

    var selfApp = this;
    var nameLower = (testName || '').toLowerCase();
    var isBlood = nameLower.indexOf('blood') !== -1;
    var isSterile = nameLower.indexOf('csf') !== -1 || nameLower.indexOf('sterile') !== -1;

    var csHtml = '<div style="display:flex; flex-direction:column; gap:14px;">' +
      '<div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
          '<span style="font-weight:700; font-size:0.9rem; color:#0f172a;">Diagnostic Culture Phase:</span>' +
          '<select id="cs-phase-select" style="padding:5px 8px; border:1px solid #94a3b8; border-radius:4px; font-weight:600; font-size:0.85rem;">' +
            '<option value="1">Phase 1: Preliminary Microscopy &amp; Smear</option>' +
            '<option value="2">Phase 2: Macroscopic Culture &amp; Colony Count</option>' +
            '<option value="3">Phase 3: Organism Identification</option>' +
            '<option value="4" selected>Phase 4: CLSI AST &amp; Final Interpretation</option>' +
          '</select>' +
        '</div>' +
        '<div id="cs-emergency-bar" style="display:' + (isBlood || isSterile ? 'flex' : 'none') + '; align-items:center; gap:8px; padding:6px 10px; background:#fef2f2; border:1px solid #f87171; border-radius:4px; font-size:0.82rem; color:#b91c1c;">' +
          '<input type="checkbox" id="cs-callback-done" style="accent-color:#dc2626;">' +
          '<label for="cs-callback-done" style="font-weight:600;">15-Minute Verbal Callback Communicated to Ward</label>' +
          '<input type="text" id="cs-callback-recipient" placeholder="Recipient Clinician / Nurse" style="margin-left:auto; padding:3px 6px; font-size:0.8rem; border:1px solid #f87171; border-radius:4px; width:180px;">' +
        '</div>' +
      '</div>' +

      '<div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px;">' +
        '<h5 style="margin:0 0 6px 0; font-size:0.85rem; color:#1e293b; font-weight:700;">Phase 1: Preliminary Microscopic Examination (Gram Stain / Wet Prep)</h5>' +
        '<textarea id="cs-prelim-micro" rows="2" placeholder="e.g., Moderate pus cells (10-15/hpf), Gram-negative rods seen" style="width:100%; padding:6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.85rem;"></textarea>' +
      '</div>' +

      '<div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px;">' +
        '<h5 style="margin:0 0 6px 0; font-size:0.85rem; color:#1e293b; font-weight:700;">Phase 2: Macroscopic Culture &amp; Colony Count Quantification</h5>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">' +
          '<div>' +
            '<label style="font-size:0.75rem; color:#64748b; display:block;">Colony Count (CFU/mL):</label>' +
            '<select id="cs-colony-count" style="width:100%; padding:5px 6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.82rem;">' +
              '<option value="< 10^3">&lt; 10^3 CFU/mL (No significant growth)</option>' +
              '<option value="10^3 - 10^4">10^3 - 10^4 CFU/mL (Suspicious low-count)</option>' +
              '<option value="10^4 - 10^5">10^4 - 10^5 CFU/mL</option>' +
              '<option value=">= 10^5" selected>&gt;= 10^5 CFU/mL (Significant bacteriuria)</option>' +
              '<option value="No Growth">No aerobic growth</option>' +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.75rem; color:#64748b; display:block;">Incubation Duration:</label>' +
            '<select id="cs-incubation-hours" style="width:100%; padding:5px 6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.82rem;">' +
              '<option value="24" selected>24 Hours</option>' +
              '<option value="48">48 Hours</option>' +
              '<option value="72">72 Hours</option>' +
              '<option value="120">5 Days (Blood culture)</option>' +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.75rem; color:#64748b; display:block;">Culture Media Used:</label>' +
            '<input type="text" id="cs-media-used" value="CLED &amp; MacConkey Agar" style="width:100%; padding:5px 6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.82rem;">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="border:1px solid #cbd5e1; border-radius:6px; padding:10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
          '<h5 style="margin:0; font-size:0.85rem; color:#1e293b; font-weight:700;">Phase 3 &amp; 4: Organism Identification &amp; CLSI Susceptibility (S-I-R) Grid</h5>' +
          '<div style="display:flex; gap:8px;">' +
            '<label style="font-size:0.8rem; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="cs-esbl-flag"> <b>ESBL Phenotype</b></label>' +
            '<label style="font-size:0.8rem; display:flex; align-items:center; gap:4px;"><input type="checkbox" id="cs-mrsa-flag"> <b>MRSA Phenotype</b></label>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:2fr 3fr; gap:10px; margin-bottom:8px;">' +
          '<div>' +
            '<label style="font-size:0.75rem; color:#64748b; display:block;">Identified Organism:</label>' +
            '<input type="text" id="cs-organism-name" value="Escherichia coli" placeholder="e.g., Escherichia coli" style="width:100%; padding:5px 6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.82rem; font-weight:600;">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.75rem; color:#64748b; display:block;">Colony Morphology &amp; Growth Characteristics:</label>' +
            '<input type="text" id="cs-morphology" value="Yellow lactose-fermenting colonies on CLED" placeholder="Colony appearance" style="width:100%; padding:5px 6px; border:1px solid #94a3b8; border-radius:4px; font-size:0.82rem;">' +
          '</div>' +
        '</div>' +

        '<div style="max-height:220px; overflow-y:auto; border:1px solid #cbd5e1; border-radius:4px;">' +
          '<table style="width:100%; border-collapse:collapse; font-size:0.8rem;">' +
            '<thead><tr style="background:#f1f5f9; text-align:left; position:sticky; top:0; z-index:1;">' +
              '<th style="padding:5px 8px;">Class</th>' +
              '<th style="padding:5px 8px;">Antimicrobial Agent</th>' +
              '<th style="padding:5px 8px; width:90px;">Zone (mm)</th>' +
              '<th style="padding:5px 8px; width:90px;">S-I-R</th>' +
            '</tr></thead>' +
            '<tbody id="cs-ast-tbody"></tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +

      '<div>' +
        '<label style="font-size:0.75rem; color:#64748b; display:block;">Clinical Microbiology Interpretation &amp; Diagnostic Notes:</label>' +
        '<textarea id="cs-clinical-notes" rows="2" placeholder="Clinical notes, consultation guidance..." style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:0.82rem;"></textarea>' +
      '</div>' +
    '</div>';

    paramsContainer.innerHTML = csHtml;

    var DEFAULT_AGENTS = [
      { cls: 'Penicillins', agent: 'Ampicillin', defaultSir: 'R', zone: 12 },
      { cls: 'Beta-Lactam/Inh.', agent: 'Amoxicillin/Clavulanate', defaultSir: 'S', zone: 19 },
      { cls: 'Cephalosporins', agent: 'Ceftriaxone', defaultSir: 'I', zone: 16 },
      { cls: 'Cephalosporins', agent: 'Cefotaxime', defaultSir: 'S', zone: 23 },
      { cls: 'Cephalosporins', agent: 'Cefepime', defaultSir: 'S', zone: 24 },
      { cls: 'Carbapenems', agent: 'Meropenem', defaultSir: 'S', zone: 28 },
      { cls: 'Fluoroquinolones', agent: 'Ciprofloxacin', defaultSir: 'S', zone: 22 },
      { cls: 'Aminoglycosides', agent: 'Gentamicin', defaultSir: 'R', zone: 10 },
      { cls: 'Aminoglycosides', agent: 'Amikacin', defaultSir: 'S', zone: 21 },
      { cls: 'Folate Inhibitors', agent: 'Trimethoprim/Sulfamethoxazole', defaultSir: 'R', zone: 8 },
      { cls: 'Nitrofurans', agent: 'Nitrofurantoin', defaultSir: 'S', zone: 20 }
    ];

    function renderAstRows(agents) {
      var tbody = document.getElementById('cs-ast-tbody');
      if (!tbody) return;
      var rowsHtml = '';
      agents.forEach(function(ag, idx) {
        rowsHtml += '<tr style="border-bottom:1px solid #f1f5f9;" data-agent-idx="' + idx + '">' +
          '<td style="padding:4px 8px; color:#475569;">' + ag.cls + '</td>' +
          '<td style="padding:4px 8px; font-weight:600;">' + ag.agent + '</td>' +
          '<td style="padding:4px 8px;"><input type="number" class="cs-ast-zone" data-agent="' + ag.agent + '" value="' + (ag.zone || '') + '" style="width:100%; padding:2px 4px; border:1px solid #cbd5e1; border-radius:3px; font-size:0.8rem;"></td>' +
          '<td style="padding:4px 8px;">' +
            '<select class="cs-ast-sir" data-agent="' + ag.agent + '" data-class="' + ag.cls + '" style="width:100%; padding:2px 4px; border:1px solid #cbd5e1; border-radius:3px; font-weight:700; font-size:0.8rem;">' +
              '<option value="S"' + (ag.defaultSir === 'S' ? ' selected' : '') + ' style="color:#15803d;">S</option>' +
              '<option value="I"' + (ag.defaultSir === 'I' ? ' selected' : '') + ' style="color:#d97706;">I</option>' +
              '<option value="R"' + (ag.defaultSir === 'R' ? ' selected' : '') + ' style="color:#b91c1c;">R</option>' +
            '</select>' +
          '</td>' +
        '</tr>';
      });
      tbody.innerHTML = rowsHtml;
    }

    renderAstRows(DEFAULT_AGENTS);

    fetch('/api/culture/order/' + orderId)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data) return;
        if (data.phase) document.getElementById('cs-phase-select').value = String(data.phase);
        if (data.preliminary_micro) document.getElementById('cs-prelim-micro').value = data.preliminary_micro;
        if (data.colony_count_cfu) document.getElementById('cs-colony-count').value = data.colony_count_cfu;
        if (data.incubation_hours) document.getElementById('cs-incubation-hours').value = String(data.incubation_hours);
        if (data.media_used) document.getElementById('cs-media-used').value = data.media_used;
        if (data.clinical_notes) document.getElementById('cs-clinical-notes').value = data.clinical_notes;
        if (data.is_emergency_callback_done) {
          document.getElementById('cs-callback-done').checked = true;
          if (data.emergency_callback_recipient) document.getElementById('cs-callback-recipient').value = data.emergency_callback_recipient;
        }
        if (data.isolates && data.isolates.length > 0) {
          var iso = data.isolates[0];
          document.getElementById('cs-organism-name').value = iso.organism_name || '';
          document.getElementById('cs-morphology').value = iso.colony_morphology || '';
          if (iso.ast_results && iso.ast_results.length > 0) {
            var mapped = iso.ast_results.map(function(ar) {
              return {
                cls: ar.antimicrobial_class,
                agent: ar.agent_name,
                defaultSir: ar.overridden_sir || ar.raw_sir,
                zone: ar.measurement_value
              };
            });
            renderAstRows(mapped);
          }
        }
      })
      .catch(function() {});

    if (submitBtn) {
      submitBtn.onclick = function(ev) {
        ev.preventDefault();
        var phaseVal = parseInt(document.getElementById('cs-phase-select').value, 10) || 1;
        var microVal = document.getElementById('cs-prelim-micro').value;
        var cfuVal = document.getElementById('cs-colony-count').value;
        var incHours = parseInt(document.getElementById('cs-incubation-hours').value, 10) || 24;
        var mediaVal = document.getElementById('cs-media-used').value;
        var notesVal = document.getElementById('cs-clinical-notes').value;
        var isCallback = document.getElementById('cs-callback-done').checked;
        var callbackRec = document.getElementById('cs-callback-recipient').value;
        var orgName = document.getElementById('cs-organism-name').value;
        var morphVal = document.getElementById('cs-morphology').value;
        var isEsbl = document.getElementById('cs-esbl-flag').checked;
        var isMrsa = document.getElementById('cs-mrsa-flag').checked;

        var astRows = [];
        var astElements = paramsContainer.querySelectorAll('#cs-ast-tbody tr');
        astElements.forEach(function(tr) {
          var sirSel = tr.querySelector('.cs-ast-sir');
          var zoneInp = tr.querySelector('.cs-ast-zone');
          if (sirSel && zoneInp) {
            astRows.push({
              antimicrobial_class: sirSel.getAttribute('data-class') || 'General',
              agent_name: sirSel.getAttribute('data-agent'),
              measurement_type: 'zone_mm',
              measurement_value: parseFloat(zoneInp.value) || null,
              raw_sir: sirSel.value
            });
          }
        });

        var isolatesPayload = [];
        if (orgName) {
          isolatesPayload.push({
            isolate_number: 1,
            organism_name: orgName,
            colony_morphology: morphVal,
            is_pathogen: true,
            is_contaminant: false,
            ast_results: astRows
          });
        }

        var savePayload = {
          phase: phaseVal,
          preliminary_micro: microVal,
          colony_count_cfu: cfuVal,
          incubation_hours: incHours,
          media_used: mediaVal,
          clinical_notes: notesVal,
          is_emergency_callback_done: isCallback,
          emergency_callback_recipient: callbackRec,
          is_esbl_positive: isEsbl,
          is_mrsa_positive: isMrsa,
          isolates: isolatesPayload
        };

        fetch('/api/culture/order/' + orderId + '/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savePayload)
        })
        .then(function(res) {
          return res.json().then(function(data) {
            if (!res.ok) throw new Error(data.detail || 'Save failed');
            return data;
          });
        })
        .then(function() {
          selfApp.showNotificationModal('Culture Record Saved', 'Culture &amp; Sensitivity findings updated successfully.', false);
          selfApp.closeModal('result-entry-modal');
          if (selfApp.loadVisits) selfApp.loadVisits();
        })
        .catch(function(err) {
          selfApp.showNotificationModal('Save Error', err.message, true);
        });
      };
    }
  }
  });
})(window.app);


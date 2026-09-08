// M-LIS Keyboard Shortcuts & Global Action Handlers
(function(app) {
  Object.assign(app, {
  setupGlobalKeyboardShortcuts: function() {
    document.addEventListener('keydown', (e) => {
      // 1. Enter key toggle for checkboxes
      if (e.key === 'Enter') {
        const el = document.activeElement;
        if (el && el.type === 'checkbox') {
          e.preventDefault();
          el.click();
          return;
        }
      }

      const hasModal = this._modalStack && this._modalStack.length > 0;
      const topModal = hasModal ? this._modalStack[this._modalStack.length - 1] : null;

      // 2. Escape handling: close topmost modal if dismissable
      if (e.key === 'Escape') {
        if (topModal) {
          if (topModal.id === 'login-modal' && !this.currentUser) return;
          if (topModal.id === 'reset-password-modal' && this.currentUser && this.currentUser.password_reset_required) return;
          e.preventDefault();
          this.closeModal(topModal);
          return;
        }
        const act = document.activeElement;
        if (act && (act.tagName === 'INPUT' || act.tagName === 'TEXTAREA' || act.tagName === 'SELECT')) {
          act.blur();
        }
        return;
      }

      // 3. Ctrl+Enter or Cmd+Enter: Submit active form/modal or create visit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (topModal) {
          const form = topModal.querySelector('form');
          if (form) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            return;
          }
          const primaryBtn = topModal.querySelector('.btn-primary, #confirm-ok-btn, #prompt-ok-btn');
          if (primaryBtn) {
            e.preventDefault();
            primaryBtn.click();
            return;
          }
        } else if (this.currentView === 'clients') {
          const createBtn = document.querySelector('#client-detail-box .btn-success');
          if (createBtn) {
            e.preventDefault();
            createBtn.click();
            return;
          }
        } else if (this.currentView === 'backlog') {
          const saveBtn = document.getElementById('btn-save-backlog');
          if (saveBtn) {
            e.preventDefault();
            saveBtn.click();
            return;
          }
        }
      }

      // 4. Ctrl+S or Alt+S: Save current context
      if ((e.ctrlKey || e.altKey) && (e.key === 's' || e.key === 'S')) {
        if (topModal) {
          const form = topModal.querySelector('form');
          if (form) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            return;
          }
        } else if (this.currentView === 'backlog') {
          e.preventDefault();
          this.saveBacklogData();
          return;
        }
      }

      // 5. Modal focus trapping (Tab / Shift+Tab)
      if (topModal && e.key === 'Tab') {
        const focusables = Array.from(topModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function(el) { return el.offsetParent !== null; });
        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !topModal.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !topModal.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
        return;
      }

      // 6. Global Navigation Alt+1..8 & Help Alt+H / ?
      const isAlt = e.altKey;
      const key = e.key;

      if (isAlt && (key >= '1' && key <= '7')) {
        e.preventDefault();
        const tabMap = {
          '1': 'clients',
          '2': 'daily-log',
          '3': 'backlog',
          '4': 'inventory',
          '5': 'reports',
          '6': 'config',
          '7': 'audit'
        };
        const targetView = tabMap[key];
        if (targetView) {
          this.navigate(targetView);
        }
        return;
      }

      if ((isAlt && (key === 'h' || key === 'H')) || key === 'F1') {
        e.preventDefault();
        this.openShortcutsModal();
        return;
      }

      if (isAlt && (key === 'n' || key === 'N')) {
        e.preventDefault();
        if (this.currentView === 'clients') {
          this.showNewClientModal();
        } else if (this.currentView === 'inventory') {
          this.openReceiveStockModal();
        }
        return;
      }

      if (isAlt && (key === 't' || key === 'T')) {
        if (this.currentView === 'clients') {
          const search = document.getElementById('visit-test-search');
          if (search) {
            e.preventDefault();
            search.focus();
            search.select();
            return;
          }
        }
      }

      if (isAlt && (key === 'a' || key === 'A')) {
        if (this.currentView === 'daily-log') {
          const tallyInp = document.getElementById('paper-register-input');
          if (tallyInp) {
            e.preventDefault();
            tallyInp.focus();
            tallyInp.select();
            return;
          }
        }
      }

      if (isAlt && (key === 'e' || key === 'E')) {
        const isPrivileged = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
        if (isPrivileged) {
          e.preventDefault();
          this.openBulkExportModal();
          return;
        }
      }

      if (isAlt && (key === 'i' || key === 'I')) {
        const isPrivileged = this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin');
        if (isPrivileged) {
          e.preventDefault();
          this.openBulkImportModal();
          return;
        }
      }

      if (isAlt && (key === 'l' || key === 'L')) {
        e.preventDefault();
        this.confirmAction("Logout", "Are you sure you want to sign out?", () => {
          this.handleLogout();
        });
        return;
      }

      // 7. Non-input single key shortcuts
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      if (!isInputActive && !hasModal) {
        if (key === '?' || (e.shiftKey && key === '/')) {
          e.preventDefault();
          this.openShortcutsModal();
          return;
        }

        if (key === '/' || (e.ctrlKey && (key === 'k' || key === 'K'))) {
          e.preventDefault();
          this.focusPrimarySearch();
          return;
        }

        if (key === 'n' || key === 'N') {
          e.preventDefault();
          if (this.currentView === 'clients') {
            this.showNewClientModal();
          } else if (this.currentView === 'inventory') {
            this.openReceiveStockModal();
          }
          return;
        }

        // Daily Log & Backlog date shifting
        if (this.currentView === 'daily-log') {
          if (key === '[' || (isAlt && key === 'ArrowLeft')) {
            e.preventDefault();
            this.shiftLogDate(-1);
            return;
          }
          if (key === ']' || (isAlt && key === 'ArrowRight')) {
            e.preventDefault();
            this.shiftLogDate(1);
            return;
          }
          if (key === 't' || key === 'T') {
            e.preventDefault();
            this.shiftLogDate(0);
            return;
          }
        } else if (this.currentView === 'backlog') {
          if (key === '[' || (isAlt && key === 'ArrowLeft')) {
            e.preventDefault();
            this.shiftBacklogDate(-1);
            return;
          }
          if (key === ']' || (isAlt && key === 'ArrowRight')) {
            e.preventDefault();
            this.shiftBacklogDate(1);
            return;
          }
          if (key === 't' || key === 'T') {
            e.preventDefault();
            this.shiftBacklogDate(0);
            return;
          }
        }
      }
    });
  },

  focusPrimarySearch: function() {
    if (this.currentView === 'clients') {
      const el = document.getElementById('client-search-input');
      if (el) { el.focus(); el.select(); }
    } else if (this.currentView === 'backlog') {
      const el = document.getElementById('backlog-search');
      if (el) { el.focus(); el.select(); }
    } else if (this.currentView === 'inventory') {
      const el = document.getElementById('inventory-search');
      if (el) { el.focus(); el.select(); }
    }
  },

  saveOrderPref: function(key, val) {
    try {
      if (val !== undefined && val !== null) {
        localStorage.setItem('mlis_pref_' + key, val);
      }
    } catch (e) {}
  },

  getOrderPref: function(key, fallback) {
    try {
      const val = localStorage.getItem('mlis_pref_' + key);
      return val !== null ? val : fallback;
    } catch (e) {
      return fallback;
    }
  },

  showNotificationModal: function(title, message, isError) {
    if (typeof isError === 'undefined') isError = false;
    const modal = document.getElementById('notification-modal');
    if (!modal) return;
    document.getElementById('notif-title').textContent = title;
    document.getElementById('notif-title').style.color = isError ? 'var(--danger-color)' : 'var(--primary-color)';
    document.getElementById('notif-message').textContent = message;
    this.openModal(modal);
  },

  confirmAction: function(title, message, callback) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      if (confirm(message)) {
        if (typeof callback === 'function') callback.call(app);
      }
      return;
    }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');
    
    // Remove old listeners
    const newCancel = cancelBtn.cloneNode(true);
    const newOk = okBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    
    newCancel.addEventListener('click', () => {
      app.closeModal(modal);
    });
    
    newOk.addEventListener('click', () => {
      app.closeModal(modal);
      if (typeof callback === 'function') callback.call(app);
    });

    newCancel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        newOk.focus();
      }
    });

    newOk.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        newCancel.focus();
      }
    });
    
    this.openModal(modal);
  },


  });
})(window.app);

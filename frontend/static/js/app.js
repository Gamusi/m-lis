// ============================================================================
// Legacy Browser Polyfills & Coroutine Runner (Edge 12-18, IE11+, WebViews)
// ============================================================================

// Native ES6 Generator-to-Promise Coroutine (replaces ES2017 async/await)
function __async(generatorFunc) {
  return function() {
    var self = this;
    var args = arguments;
    return new Promise(function(resolve, reject) {
      var gen = generatorFunc.apply(self, args);
      function step(key, arg) {
        var info;
        try {
          info = gen[key](arg);
        } catch (error) {
          return reject(error);
        }
        if (info.done) {
          return resolve(info.value);
        }
        Promise.resolve(info.value).then(
          function(val) { step('next', val); },
          function(err) { step('throw', err); }
        );
      }
      step('next');
    });
  };
}

// NodeList & HTMLCollection .forEach polyfill for Edge 12-15
if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
  NodeList.prototype.forEach = Array.prototype.forEach;
}
if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
  HTMLCollection.prototype.forEach = Array.prototype.forEach;
}

// Element.prototype.matches & closest & remove for Edge 12-14
if (typeof Element !== 'undefined') {
  if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector || function(s) {
      var matches = (this.document || this.ownerDocument).querySelectorAll(s), i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) {}
      return i > -1;
    };
  }
  if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
      var el = this;
      do {
        if (el.matches(s)) return el;
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === 1);
      return null;
    };
  }
  if (!Element.prototype.remove) {
    Element.prototype.remove = function() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  }
}

// fetch polyfill for Edge 12-13
if (!window.fetch) {
  window.fetch = function(url, options) {
    options = options || {};
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      var method = (options.method || 'GET').toUpperCase();
      xhr.open(method, url, true);

      var headers = options.headers || {};
      if (headers) {
        if (typeof Headers !== 'undefined' && headers instanceof Headers) {
          headers.forEach(function(val, key) { xhr.setRequestHeader(key, val); });
        } else {
          for (var key in headers) {
            if (Object.prototype.hasOwnProperty.call(headers, key)) {
              xhr.setRequestHeader(key, headers[key]);
            }
          }
        }
      }

      xhr.onload = function() {
        var responseHeaders = {};
        var headerStr = xhr.getAllResponseHeaders() || '';
        headerStr.trim().split(/[\r\n]+/).forEach(function(line) {
          var parts = line.split(': ');
          var header = parts.shift();
          var value = parts.join(': ');
          if (header) responseHeaders[header.toLowerCase()] = value;
        });

        var response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            get: function(name) {
              return responseHeaders[name.toLowerCase()] || null;
            }
          },
          url: xhr.responseURL || url,
          text: function() {
            return Promise.resolve(xhr.responseText);
          },
          json: function() {
            try {
              return Promise.resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              return Promise.reject(e);
            }
          },
          blob: function() {
            return Promise.resolve(new Blob([xhr.response]));
          }
        };
        resolve(response);
      };

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'));
      };

      xhr.ontimeout = function() {
        reject(new TypeError('Network request timed out'));
      };

      if (options.body) {
        xhr.send(options.body);
      } else {
        xhr.send();
      }
    });
  };
}

// Array.prototype.includes (ES2016 polyfill for Edge 12-13)
if (!Array.prototype.includes) {
  Array.prototype.includes = function(searchElement, fromIndex) {
    var O = Object(this);
    var len = parseInt(O.length, 10) || 0;
    if (len === 0) return false;
    var n = parseInt(fromIndex, 10) || 0;
    var k = n >= 0 ? n : Math.max(0, len + n);
    while (k < len) {
      if (searchElement === O[k] || (searchElement !== searchElement && O[k] !== O[k])) {
        return true;
      }
      k++;
    }
    return false;
  };
}

// String.prototype.includes (ES6 polyfill)
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    if (typeof start !== 'number') start = 0;
    if (start + search.length > this.length) return false;
    return this.indexOf(search, start) !== -1;
  };
}

// Object.values (ES2017 polyfill for Edge 12-13)
if (!Object.values) {
  Object.values = function(obj) {
    var vals = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        vals.push(obj[key]);
      }
    }
    return vals;
  };
}

// Object.entries (ES2017 polyfill for Edge 12-13)
if (!Object.entries) {
  Object.entries = function(obj) {
    var entries = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        entries.push([key, obj[key]]);
      }
    }
    return entries;
  };
}

// Array.prototype.find (ES6 polyfill)
if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
    if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    for (var i = 0; i < length; i++) {
      var value = list[i];
      if (predicate.call(thisArg, value, i, list)) return value;
    }
    return undefined;
  };
}

// Object.assign (ES6 polyfill)
if (typeof Object.assign !== 'function') {
  Object.assign = function(target) {
    if (target == null) throw new TypeError('Cannot convert undefined or null to object');
    var to = Object(target);
    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];
      if (nextSource != null) {
        for (var nextKey in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

// Global Session Expiration & 401 Interceptor (EdgeHTML / ES6 safe)
(function() {
  var originalFetch = window.fetch;
  window.fetch = function() {
    var args = arguments;
    return originalFetch.apply(window, args).then(function(res) {
      if (res && res.status === 401) {
        var rawUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');
        if (rawUrl.indexOf('/api/auth/login') === -1 && rawUrl.indexOf('/api/auth/me') === -1) {
          if (window.app && window.app.currentUser) {
            console.warn('Session expired or unauthorized (401). Resetting session.');
            window.app.showLogin('Your session has expired. Please sign in again.');
          }
        }
      }
      return res;
    });
  };
})();

const app = {
  currentUser: null,
  currentView: 'clients',
  theme: null,
  inactivityTimer: null,
  inactivityTimeout: 15 * 60 * 1000, // 15 minutes in milliseconds
  lastActivityTime: 0,

  icons: {
    'landmark': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"></line><line x1="6" x2="6" y1="18"></line><line x1="10" x2="10" y1="18"></line><line x1="14" x2="14" y1="18"></line><line x1="18" x2="18" y1="18"></line><polygon points="12 2 20 7 4 7"></polygon><line x1="2" x2="22" y1="7" y2="7"></line></svg>`,
    'bed': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>`,
    'building': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>`,
    'stethoscope': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2v2"></path><path d="M5 2v2"></path><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"></path><path d="M8 15a6 6 0 0 0 12 0v-3"></path><circle cx="20" cy="10" r="2"></circle></svg>`,

    'clipboard-list': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>`,
    'bar-chart-2': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"></line><line x1="12" x2="12" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="14"></line></svg>`,
    'sliders': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"></line><line x1="4" x2="4" y1="10" y2="3"></line><line x1="12" x2="12" y1="21" y2="12"></line><line x1="12" x2="12" y1="8" y2="3"></line><line x1="20" x2="20" y1="21" y2="16"></line><line x1="20" x2="20" y1="12" y2="3"></line><line x1="2" x2="6" y1="14" y2="14"></line><line x1="10" x2="14" y1="8" y2="8"></line><line x1="18" x2="22" y1="16" y2="16"></line></svg>`,
    'trending-up': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>`,
    'file-text': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><line x1="10" x2="8" y1="9" y2="9"></line></svg>`,
    'settings': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    'shield-check': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
    'save': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
    'printer': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>`,
    'download': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`,
    'user': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    'users': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    'user-plus': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="16" x2="22" y1="11" y2="11"></line></svg>`,
    'plus': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>`,
    'chevron-left': `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    'chevron-right': `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
    'check-circle': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    'alert-triangle': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>`,
    'boxes': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>`,
    'refresh-cw': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>`,
    'log-out': `<svg class="lucide" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>`,
    'keyboard': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" ry="2"></rect><line x1="6" x2="6.01" y1="8" y2="8"></line><line x1="10" x2="10.01" y1="8" y2="8"></line><line x1="14" x2="14.01" y1="8" y2="8"></line><line x1="18" x2="18.01" y1="8" y2="8"></line><line x1="6" x2="6.01" y1="12" y2="12"></line><line x1="10" x2="10.01" y1="12" y2="12"></line><line x1="14" x2="14.01" y1="12" y2="12"></line><line x1="18" x2="18.01" y1="12" y2="12"></line><line x1="8" x2="16" y1="16" y2="16"></line></svg>`,
    'help-circle': `<svg class="lucide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>`
  },

  icon: function(name) {
    return this.icons[name] || '';
  },

  init: __async(function*() {
    yield this.loadTheme();
    yield this.checkAuth();
    this.setupInactivityListeners();
    this.setupGlobalKeyboardShortcuts();
  }),

  loadTheme: __async(function*() {
    try {
      let facData = null;
      try {
        const facRes = yield fetch('/api/config/facility?t=' + Date.now());
        if (facRes.ok) {
          facData = yield facRes.json();
        }
      } catch (err) {
        // Fallback gracefully if API not ready
      }

      const res = yield fetch('/assets/branding/theme.json?t=' + Date.now());
      if (res.ok) {
        this.theme = yield res.json();
      } else {
        this.theme = {};
      }

      if (facData) {
        this.theme.facility_name = facData.facility_name || this.theme.facility_name;
        this.theme.facility_acronym = facData.facility_acronym || this.theme.facility_acronym;
        this.facilitySettings = facData;
      }

      const appTitleEl = document.getElementById('app-title');
      const facNameEl = document.getElementById('facility-name');
      const footerEl = document.getElementById('footer-text');
      const logoEl = document.getElementById('header-logo');

      if (appTitleEl) appTitleEl.textContent = this.theme.app_title || 'M-LIS';
      if (facNameEl) facNameEl.textContent = this.theme.facility_name || 'Ahmadiyya Muslim Hospital';
      if (footerEl) footerEl.textContent = this.theme.footer_text || '© M-LIS 2026';
      if (logoEl) logoEl.src = this.theme.logo_path || '/assets/branding/logo_white.png';
    } catch (e) {
      console.warn('Theme loading warning:', e);
    }
  }),

  checkAuth: __async(function*() {
    try {
      const res = yield fetch('/api/auth/me');
      if (res.ok) {
        this.currentUser = yield res.json();
        this.renderUserNav();
        this.closeModal('login-modal');
        document.getElementById('app-nav').style.display = 'flex';
        this.startInactivityTimer();

        if (this.currentUser.password_reset_required) {
          this.showResetPasswordModal();
        } else {
          this.navigate(this.currentView);
        }
      } else {
        this.showLogin();
      }
    } catch (e) {
      this.showLogin();
    }
  }),

  showLogin: function(noticeMessage) {
    this.currentUser = null;
    this.stopInactivityTimer();
    this.cleanseDOM();
    document.getElementById('app-nav').style.display = 'none';
    document.getElementById('user-nav').innerHTML = '';
    this.openModal('login-modal');
    this.showLoginForm();
    if (noticeMessage) {
      const errDiv = document.getElementById('login-error');
      if (errDiv) {
        errDiv.textContent = noticeMessage;
        errDiv.style.display = 'block';
      }
    }
  },

  handleLogin: __async(function*(event) {
    event.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    errDiv.style.display = 'none';

    try {
      const res = yield fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });

      if (res.ok) {
        const data = yield res.json();
        this.currentUser = data.user;
        this.closeModal('login-modal');
        document.getElementById('app-nav').style.display = 'flex';
        this.renderUserNav();
        this.startInactivityTimer();

        if (data.status === 'reset_required' || (data.user && data.user.password_reset_required)) {
          this.showResetPasswordModal();
        } else {
          this.navigate('clients');
        }
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Login failed';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  handleLogout: __async(function*(noticeMessage) {
    this.stopInactivityTimer();
    yield fetch('/api/auth/logout', { method: 'POST' });
    this.showLogin(noticeMessage);
  }),

  showResetPasswordModal: function() {
    const modal = document.getElementById('reset-password-modal');
    if (modal) {
      this.openModal(modal);
      const err = document.getElementById('reset-password-error');
      if (err) {
        err.textContent = '';
        err.style.display = 'none';
      }
      const form = document.getElementById('reset-password-form');
      if (form) form.reset();
      const oldPw = document.getElementById('reset-old-password');
      if (oldPw) oldPw.focus();
    }
  },

  handleChangePassword: __async(function*(event) {
    event.preventDefault();
    const oldPassword = document.getElementById('reset-old-password').value;
    const newPassword = document.getElementById('reset-new-password').value;
    const confirmPassword = document.getElementById('reset-confirm-password').value;
    const errDiv = document.getElementById('reset-password-error');

    errDiv.style.display = 'none';

    if (!newPassword || newPassword.trim().length < 4) {
      errDiv.textContent = 'New password must be at least 4 characters.';
      errDiv.style.display = 'block';
      return;
    }

    if (newPassword !== confirmPassword) {
      errDiv.textContent = 'New password and confirmation do not match.';
      errDiv.style.display = 'block';
      return;
    }

    try {
      const res = yield fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      if (res.ok) {
        if (this.currentUser) {
          this.currentUser.password_reset_required = false;
        }
        this.closeModal('reset-password-modal');
        document.getElementById('reset-password-form').reset();
        this.showNotificationModal("Success", 'Password changed successfully!', false);
        this.navigate('clients');
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Failed to change password.';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  showRegisterForm: function(event) {
    if (event) event.preventDefault();
    document.getElementById('login-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'none';
    document.getElementById('register-form-container').style.display = 'block';
    document.getElementById('register-error').style.display = 'none';
    document.getElementById('register-success').style.display = 'none';
  },

  showLoginForm: function(event) {
    if (event) event.preventDefault();
    document.getElementById('register-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'none';
    document.getElementById('login-form-container').style.display = 'block';
    document.getElementById('login-error').style.display = 'none';
  },

  showForgotPassword: function(event) {
    if (event) event.preventDefault();
    document.getElementById('login-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    const forgot = document.getElementById('forgot-password-container');
    if (forgot) forgot.style.display = 'block';
  },

  handleRegister: __async(function*(event) {
    event.preventDefault();
    const fullname = document.getElementById('register-fullname').value.trim().toUpperCase();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const cadre = document.getElementById('register-cadre').value;
    const errDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');
    
    errDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
      const res = yield fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullname, username: username, password: password, cadre: cadre })
      });

      if (res.ok) {
        const data = yield res.json();
        if (data.is_active) {
          successDiv.textContent = 'Super Admin account registered successfully! Redirecting...';
        } else {
          successDiv.textContent = 'Registration submitted! Access is pending Admin approval.';
        }
        successDiv.style.display = 'block';
        document.getElementById('register-form').reset();
        setTimeout(() => {
          this.showLoginForm();
        }, 3000);
      } else {
        const err = yield res.json();
        errDiv.textContent = err.detail || 'Registration failed';
        errDiv.style.display = 'block';
      }
    } catch (e) {
      errDiv.textContent = 'Connection error. Please try again.';
      errDiv.style.display = 'block';
    }
  }),

  setupInactivityListeners: function() {
    const reset = () => this.resetInactivityTimer();
    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    window.addEventListener('click', reset);
    window.addEventListener('scroll', reset);
  },

  startInactivityTimer: function() {
    this.resetInactivityTimer();
  },

  resetInactivityTimer: function() {
    const now = Date.now();
    if (now - this.lastActivityTime < 5000) {
      return;
    }
    this.lastActivityTime = now;

    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    if (this.currentUser) {
      this.inactivityTimer = setTimeout(() => {
        console.log("Inactivity timeout reached. Logging out...");
        this.handleLogout("Logged out automatically due to inactivity.");
      }, this.inactivityTimeout);
    }
  },

  stopInactivityTimer: function() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  },

  togglePasswordVisibility: function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    
    const btn = input.nextElementSibling;
    if (btn) {
      if (type === 'text') {
        btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg>`;
      } else {
        btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      }
    }
  },

  cleanseDOM: function() {
    // Reset all password input types back to password
    ['login-password', 'register-password', 'reset-old-password', 'reset-new-password', 'reset-confirm-password'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.setAttribute('type', 'password');
        const btn = input.nextElementSibling;
        if (btn) {
          btn.innerHTML = `<svg class="lucide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        }
      }
    });

    // Reset all forms in modal/app
    document.querySelectorAll('form').forEach(form => form.reset());

    // Comprehensive modal & overlay dismissal: hide every modal overlay on screen
    document.querySelectorAll('.modal-overlay').forEach(function(modalEl) {
      modalEl.style.display = 'none';
    });
    this._modalStack = [];

    // Reset dynamic view container content to default placeholder
    const container = document.getElementById('view-container');
    if (container) {
      container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 40px;">Session inactive. Please sign in.</p>';
    }

    // Reset state caches to prevent data leakage between technician shifts
    this.currentClient = null;
    this.currentOrder = null;
  },

  renderUserNav: function() {
    const nav = document.getElementById('user-nav');
    if (!this.currentUser) return;

    const isPrivileged = this.currentUser.role === 'admin' || this.currentUser.role === 'superadmin';
    const isSuper = this.currentUser.role === 'superadmin';
    
    const adminTabs = document.querySelectorAll('.admin-only');
    adminTabs.forEach(tab => {
      tab.style.display = isPrivileged ? 'inline-block' : 'none';
    });
    
    const superAdminTabs = document.querySelectorAll('.superadmin-only');
    superAdminTabs.forEach(tab => {
      tab.style.display = isSuper ? 'inline-block' : 'none';
    });

    const roleLabel = this.currentUser.role === 'superadmin' ? 'Super Admin'
      : (this.currentUser.role === 'admin' ? 'Admin' : 'Staff');

    nav.innerHTML = `
      <div class="user-badge">
        ${this.icon('user')} <strong>${this.escape(this.currentUser.full_name)}</strong> (${this.escape(roleLabel)}${this.currentUser.cadre ? ' - ' + this.escape(this.currentUser.cadre) : ''})
      </div>
      <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="app.openShortcutsModal()" title="Keyboard Shortcuts (Alt+H or ?)">${this.icon('keyboard')} Shortcuts</button>
      <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 0.8rem;" onclick="app.handleLogout()">${this.icon('log-out')} Logout</button>
    `;
  },

  openShortcutsModal: function() {
    this.openModal('shortcuts-modal');
  },

  navigate: function(viewName) {
    if (this.currentUser && this.currentUser.password_reset_required) {
      this.showResetPasswordModal();
      return;
    }
    this.currentView = viewName;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });

    const activeBtn = Array.from(document.querySelectorAll('.nav-tab')).find(b => {
      const onclickAttr = b.getAttribute('onclick');
      return onclickAttr && onclickAttr.indexOf(viewName) !== -1;
    });
    if (activeBtn) activeBtn.classList.add('active');

    const container = document.getElementById('view-container');
    if (viewName === 'daily-log') this.renderDailyLog(container);
    else if (viewName === 'backlog') this.renderBacklog(container);
    else if (viewName === 'inventory') this.renderInventory(container);
    else if (viewName === 'reports') this.renderReports(container);
    else if (viewName === 'clients') this.renderClients(container);
    else if (viewName === 'config') this.renderConfig(container);
    else if (viewName === 'audit') this.renderAuditLog(container);
  },

  _modalStack: [],
  _previouslyFocusedElement: null,

  openModal: function(modalIdOrElem) {
    const el = typeof modalIdOrElem === 'string' ? document.getElementById(modalIdOrElem) : modalIdOrElem;
    if (!el) return;
    
    if (this._modalStack.length === 0) {
      this._previouslyFocusedElement = document.activeElement;
    }

    this._modalStack = this._modalStack.filter(function(m) { return m !== el; });
    this._modalStack.push(el);
    
    const isHighPriority = el.id === 'notification-modal' || el.id === 'confirm-modal' || el.id === 'prompt-modal';
    const baseOffset = isHighPriority ? 10000 : 2000;
    el.style.zIndex = (baseOffset + (this._modalStack.length * 50)).toString();
    el.style.display = 'flex';

    setTimeout(function() {
      const focusTarget = el.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.btn-primary:not([disabled]), button:not([disabled])');
      if (focusTarget) {
        focusTarget.focus();
        if (typeof focusTarget.select === 'function') {
          focusTarget.select();
        }
      }
    }, 50);
  },

  closeModal: function(modalIdOrElem) {
    const el = typeof modalIdOrElem === 'string' ? document.getElementById(modalIdOrElem) : modalIdOrElem;
    if (!el) return;
    
    el.style.display = 'none';
    this._modalStack = this._modalStack.filter(function(m) { return m !== el; });

    if (this._modalStack.length === 0 && this._previouslyFocusedElement && typeof this._previouslyFocusedElement.focus === 'function') {
      try {
        this._previouslyFocusedElement.focus();
      } catch(e) {}
      this._previouslyFocusedElement = null;
    }
  },

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

        // Daily Log date shifting
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
          <div style="margin-bottom: 24px;">
            <h3 style="color: var(--primary-color); margin-bottom: 8px; font-size: 1rem; border-bottom: 2px solid var(--border-color); padding-bottom: 4px;">
              Section: ${this.escape(sec.section_name)}
            </h3>
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
        `;
      });
    } catch (e) {
      console.error('Error loading daily log:', e);
    }
  }),

  // Backlog View
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
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(-1)">Yesterday</button>
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(-1)">${this.icon('chevron-left')} Prev</button>
                <button class="btn btn-secondary btn-sm" onclick="app.shiftBacklogDate(1)">Next ${this.icon('chevron-right')}</button>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="app.openBacklogCoverageModal()" title="View Coverage Calendar">
                ${this.icon('calendar')} Coverage Status
              </button>
            </div>
          </div>
        </div>

        <!-- Filters Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <label for="backlog-section-filter" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Section:</label>
            <select id="backlog-section-filter" onchange="app.filterBacklogTable()" style="padding: 4px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px;">
              <option value="all">All Sections</option>
            </select>
          </div>
          <input type="text" id="backlog-search" placeholder="Search tests..." onkeyup="app.filterBacklogTable()" style="padding: 4px 8px; font-size: 0.85rem; width: 180px; border: 1px solid var(--border-color); border-radius: 4px;">
        </div>

        <!-- Summary KPI Banner -->
        <div id="backlog-summary-container" style="background: var(--bg-color); padding: 12px 16px; margin-bottom: 20px; border-radius: 6px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; border: 1px solid var(--border-color);">
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Total Tests Done</span><strong style="font-size: 1.2rem; color: var(--primary-color);" id="backlog-summary-done">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Tracked Findings</span><strong style="font-size: 1.2rem; color: #DC2626;" id="backlog-summary-pos">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">In-House</span><strong style="font-size: 1.2rem; color: #2563EB;" id="backlog-summary-inhouse">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Referrals</span><strong style="font-size: 1.2rem; color: #D97706;" id="backlog-summary-ref">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Outreach</span><strong style="font-size: 1.2rem; color: #059669;" id="backlog-summary-outreach">0</strong></div>
          <div><span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Self-Request</span><strong style="font-size: 1.2rem; color: #7C3AED;" id="backlog-summary-self">0</strong></div>
        </div>

        <div id="backlog-sections-container">
          <p style="color: var(--text-muted);">Loading backlog register...</p>
        </div>

        <!-- Sticky Bottom Action Bar -->
        <div style="position: sticky; bottom: 12px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-top: 20px; z-index: 100;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Keyboard: Use <kbd>&larr;</kbd> <kbd>&uarr;</kbd> <kbd>&rarr;</kbd> <kbd>&darr;</kbd> to navigate cells, <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-secondary" onclick="app.loadBacklogData(document.getElementById('backlog-date').value)">Reset Changes</button>
            <button type="button" id="btn-save-backlog" class="btn btn-primary" onclick="app.saveBacklogData()" style="padding: 8px 24px; font-weight: 600;">
              ${this.icon('save')} Save Backlog Entries
            </button>
          </div>
        </div>
      </div>
    `;

    yield this.loadBacklogData(curDate);
  }),

  onBacklogDateChange: function(dateVal) {
    this._backlogDate = dateVal;
    this.loadBacklogData(dateVal);
  },

  setBacklogDate: function(dateVal) {
    this._backlogDate = dateVal;
    const inp = document.getElementById('backlog-date');
    if (inp) inp.value = dateVal;
    this.loadBacklogData(dateVal);
  },

  shiftBacklogDate: function(offset) {
    const inp = document.getElementById('backlog-date');
    let target = new Date();
    if (offset !== 0 && inp && inp.value) {
      target = new Date(inp.value);
      target.setDate(target.getDate() + offset);
    } else if (offset === -1 && inp && !inp.value) {
      target.setDate(target.getDate() - 1);
    }
    const dStr = target.toISOString().split('T')[0];
    if (inp) inp.value = dStr;
    this.setBacklogDate(dStr);
  },

  loadBacklogData: __async(function*(dateStr) {
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
                ${t.is_tracked ? '<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(Tracked)</span>' : ''}
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
          <div class="backlog-section-block" data-section-id="${sec.section_id}" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 6px; margin-bottom: 8px;">
              <h3 style="color: var(--primary-color); margin: 0; font-size: 1rem;">
                ${this.escape(sec.section_name)}
              </h3>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                Section Total: <strong id="sec-done-total-${sec.section_id}">0</strong> tests | 
                <strong id="sec-pos-total-${sec.section_id}" style="color: #DC2626;">0</strong> findings
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Test Name</th>
                  <th style="width: 85px; text-align: center;">In-House</th>
                  <th style="width: 85px; text-align: center;">Referral</th>
                  <th style="width: 85px; text-align: center;">Outreach</th>
                  <th style="width: 85px; text-align: center;">Self-Req</th>
                  <th style="width: 90px; text-align: center;">Total Done</th>
                  <th style="width: 90px; text-align: center;">Pos / Finding</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
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
      if (key === 'Enter') event.preventDefault();
      const allInputs = Array.from(document.querySelectorAll(`.backlog-input-${fieldName}`)).filter(el => el.offsetParent !== null);
      const curIdx = allInputs.indexOf(currentInput);
      if (curIdx >= 0 && curIdx < allInputs.length - 1) {
        allInputs[curIdx + 1].focus();
        allInputs[curIdx + 1].select();
      }
    } else if (key === 'ArrowUp') {
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
  },

  // Reports View
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
  },

  // Test Reports View
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
               style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s; display: flex; align-items: center; background: ${isSelected ? '#DBEAFE' : 'transparent'};" 
               onclick="app.selectClient(${p.id}, '${this.escape(p.client_number)}', '${this.escape(p.full_name)}', '${p.sex}')"
               onkeydown="app.handleClientItemKeyNav(event, ${p.id}, '${this.escape(p.client_number)}', '${this.escape(p.full_name)}', '${p.sex}')"
               onmouseover="if(!this.classList.contains('selected')) this.style.background='#F1F5F9'" onmouseout="if(!this.classList.contains('selected')) this.style.background='transparent'">
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

    yield this.loadWards();
    yield this.loadClinicians();
    yield this.loadSpecimens();
    yield this.loadTestOptionsMulti();
    this.restoreClientVisitPrefs(pid);
    yield this.loadPendingTests(pid);
    yield this.loadHistoricalVisits(pid);
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
        html += `
          <tr>
            <td style="text-align:center; padding:8px; border-bottom:1px solid #ddd;">
              <input type="checkbox" class="pending-order-checkbox" value="${o.order_id}" onchange="app.onPendingOrderSelectionChange()">
            </td>
            <td style="padding:8px; border-bottom:1px solid #ddd;"><strong>${this.escape(o.test_name)}</strong><br><small style="color:var(--text-muted);">Order ID: ${o.order_id}</small></td>
            <td style="padding:8px; border-bottom:1px solid #ddd;">${o.ordered_at}</td>
            <td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">
              <button class="btn btn-primary btn-sm" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', ${o.results && o.results.length > 0 ? `'${this.escape(o.results[0].result_value || '')}'` : 'null'}, ${o.results && o.results.length > 0 && o.results[0].result_unit ? `'${this.escape(o.results[0].result_unit)}'` : 'null'}, ${o.visit_id || 'null'})">
                ${o.results && o.results.length > 0 ? 'Edit Result' : 'Enter Result'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="app.removeOrder(${o.order_id})">Remove</button>
            </td>
          </tr>
        `;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
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

        let dispatchText = '';
        if (isDispatched) {
          const dTime = v.dispatched_at.substring(0, 16);
          const dTo = v.dispatched_to ? ` to ${this.escape(v.dispatched_to)}` : '';
          dispatchText = ` [Dispatched ${dTime}${dTo}]`;
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
                      <span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchText}</span>
                      ${statusBadge}
                    </button>
                    ${verifyBtn}
                    ${dispatchActionBtn ? dispatchActionBtn : '<div></div>'}
                    <button class="btn btn-primary btn-sm" onclick="app.showAddTestModal(${v.visit_id})">Add Tests</button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteVisit(${v.visit_id})">Delete</button>
                   </div>`;
        } else {
          const reportBtn = hasSavedResults && !hasUnverified
            ? `<button class="btn btn-secondary btn-sm" style="text-align: left; display: flex; align-items: center; justify-content: space-between;" onclick="app.viewReport(${v.visit_id})"><span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchText}</span> ${statusBadge}</button>`
            : `<button class="btn btn-secondary btn-sm" style="text-align: left; color: #b45309; font-weight: 500; display: flex; align-items: center; justify-content: space-between;" onclick="app.openEditVisitModal(${v.visit_id})" title="Click to view and inspect results"><span>Visit ${v.visit_id} ${labNumStr} - ${v.created_at.split(' ')[0]}${dispatchText}</span> ${statusBadge}</button>`;
          
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
            if (isAdmin) {
              if (o.status === 'entered') {
                actionBtns = `
                  <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button type="button" class="btn btn-success btn-sm" style="padding:4px 8px; font-weight:600; font-size:0.78rem;" onclick="app.verifySingleOrder(${o.order_id}, ${visitId})">Verify</button>
                    <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.78rem;" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', '${hasResult ? this.escape(o.results[0].result_value || '') : ''}', '${hasResult && o.results[0].result_unit ? this.escape(o.results[0].result_unit) : ''}', ${visitId})">Edit</button>
                  </div>
                `;
              } else if (o.status === 'completed') {
                actionBtns = `<button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.78rem;" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', '${hasResult ? this.escape(o.results[0].result_value || '') : ''}', '${hasResult && o.results[0].result_unit ? this.escape(o.results[0].result_unit) : ''}', ${visitId})">Edit</button>`;
              } else {
                actionBtns = `<button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:0.78rem;" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', '', '', ${visitId})">Enter</button>`;
              }
            } else {
              if (o.status === 'pending') {
                actionBtns = `<button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:0.78rem;" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', '', '', ${visitId})">Enter</button>`;
              } else {
                actionBtns = `<button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.78rem;" onclick="app.showEnterResultModal(${o.order_id}, ${o.test_id}, '${this.escape(o.test_name)}', '${hasResult ? this.escape(o.results[0].result_value || '') : ''}', '${hasResult && o.results[0].result_unit ? this.escape(o.results[0].result_unit) : ''}', ${visitId})">Edit</button>`;
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

  showEnterResultModal: __async(function*(orderId, testId, testName, existingVal, existingUnit, visitId) {
    if (typeof existingVal === 'undefined') existingVal = null;
    if (typeof existingUnit === 'undefined') existingUnit = null;
    if (typeof visitId === 'undefined') visitId = null;
    document.getElementById('result-entry-order-id').value = orderId;
    document.getElementById('result-entry-test-id').value = testId;
    document.getElementById('result-entry-visit-id').value = visitId || '';
    document.getElementById('result-entry-test-name').textContent = testName;

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
                unitDisplay = `<select class="modal-param-unit" style="padding: 6px 8px; font-size: 0.85rem; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; font-weight: 500;">
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
              if (pOpts && pOpts.length > 0) {
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
        } else if (e.key === 'ArrowDown' && input.tagName !== 'SELECT') {
          const nextInput = inputs[index + 1];
          if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            if (typeof nextInput.select === 'function') nextInput.select();
          }
        } else if (e.key === 'ArrowUp' && input.tagName !== 'SELECT') {
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
            const pval = r.querySelector('.modal-param-val').value.trim();
            const uElem = r.querySelector('.modal-param-unit');
            let punit = null;
            if (uElem) {
              punit = uElem.tagName === 'SELECT' ? uElem.value : (uElem.getAttribute('data-unit') || uElem.textContent.trim());
            }
            if (pval && pval !== 'Not Done') {
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

  findMatchingRefRangeRule: function(paramName) {
    if (!paramName || !this.referenceRangesList) return null;
    const nameLower = paramName.trim().toLowerCase();
    const rules = this.referenceRangesList.filter(function(r) {
      return (r.parameter_name || '').trim().toLowerCase() === nameLower;
    });
    if (rules.length === 0) return null;

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

  checkPlausibilityLimits: function(paramName, rawVal) {
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
      return null;
    }
    const valNum = parseFloat(String(rawVal).trim().split(' ')[0]);
    if (isNaN(valNum)) return null;

    const rule = this.findMatchingRefRangeRule(paramName);
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
    const check = this.checkPlausibilityLimits(paramName, val);

    // Locate feedback container (single modal container or modal-param-row container)
    let msgEl = null;
    const parentRow = inputEl.closest('.modal-param-row');
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
        const defaultVal = unitArray[0] || (test?.default_unit || '');
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

    const currentUnit = document.getElementById('ref-range-modal-unit')?.value || unitArray[0] || null;
    this.populateRefRangeBoundsForUnit(paramName, currentUnit);
  },

  handleRefRangeUnitChange: function(newUnit, paramName) {
    if (!paramName) {
      paramName = document.getElementById('ref-range-modal-param')?.value || '';
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
    const q = (document.getElementById('ref-range-search')?.value || '').toLowerCase().trim();
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
                <td>${parent.is_tracked ? 'Tracked (Positives / Findings)' : 'Standard (Done Only)'}</td>
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
                  <td style="font-size: 0.85rem;">${child.is_tracked ? 'Tracked (Positives / Findings)' : 'Standard (Done Only)'}</td>
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
                <td>${t.is_tracked ? 'Tracked (Positives / Findings)' : 'Standard (Done Only)'}</td>
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
    const isMulti = document.getElementById('test-config-multi-units')?.checked;
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
    const isMultiUnit = document.getElementById('test-config-multi-units')?.checked;
    const secUnitVal = document.getElementById('test-config-secondary-unit')?.value.trim();
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
};



if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    app.init();
  });
} else {
  app.init();
}

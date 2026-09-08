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

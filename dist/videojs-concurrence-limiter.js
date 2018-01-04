/**
 * videojs-concurrence-limiter
 * @version 0.6.0
 * @copyright 2018 ToolBox-tve
 * @license Apache-2.0
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.videojsConcurrenceLimiter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';
/**
 * ConcurrentView class
 *
 * @file index.js
 * @module ConcurrentView
 */
Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

var _deepmerge = require('deepmerge');

var _deepmerge2 = _interopRequireDefault(_deepmerge);

var _utils = require('../utils');

/**
* main plugin component class
*/

var ConcurrentViewPlugin = (function () {
  function ConcurrentViewPlugin(options, player) {
    _classCallCheck(this, ConcurrentViewPlugin);

    this.options = options;
    this.player = player;
    this.eventsFlags = {};
    this.updateFailsCount = 1;

    this.playerToken = null;
    this.startDate = null;
  }

  /**
   * hook into player events right after player is ready to set flags for later checks
   */

  _createClass(ConcurrentViewPlugin, [{
    key: 'hookPlayerEvents',
    value: function hookPlayerEvents() {
      var _this = this;

      this.player.on('loadedmetadata', function () {
        return _this.eventsFlags.loadedmetadata = true;
      });
    }

    /**
     * xhr alias
     *
     * @param url
     * @param data
     * @param cb
     */
  }, {
    key: 'makeRequest',
    value: function makeRequest(url, data, cb) {
      var requestConfig = {
        body: data ? JSON.stringify(data) : '{}',
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      requestConfig = (0, _deepmerge2['default'])(requestConfig, this.options.request);

      _videoJs2['default'].xhr(requestConfig, function (err, resp, body) {

        var bodyJson = undefined;

        try {
          bodyJson = body ? JSON.parse(body) : { error: 'invalid body', body: body };
        } catch (e) {
          bodyJson = null;
        }

        cb(err ? err.message || err : null, bodyJson);
      });
    }

    /**
     * validates player access
     * @param cb
     */
  }, {
    key: 'validatePlay',
    value: function validatePlay(cb) {
      var _this2 = this;

      this.makeRequest(this.options.accessurl, {
        player: this.options.playerID || ''
      }, function (error, ok) {
        if (error) {
          (0, _utils.log)('accessurl api error', error);

          if (_this2.updateFailsCount >= _this2.options.maxUpdateFails) {
            cb(new Error(error), null);
          } else {

            (0, _utils.log)('accessurl retry', _this2.updateFailsCount, _this2.options.maxUpdateFails);

            _this2.updateFailsCount++;
            // try again
            _this2.player.setTimeout(function () {
              return _this2.validatePlay(cb);
            }, 200);
          }

          return;
        }

        _this2.updateFailsCount = 1;

        if (ok && ok.success) {
          cb(null, ok);

          _this2.player.trigger({
            type: 'tbxplayercanplay',
            code: 1
          });

          // Save the starting date if null
          if (!_this2.startDate) {
            _this2.startDate = Date.now();
          }
        } else {
          cb(new Error('Player Auth error'), null);
        }
      });
    }

    /**
     * disposes current player instance
     *
     * @param code
     * @param error
     * @param reason
     */
  }, {
    key: 'blockPlayer',
    value: function blockPlayer(code, error, reason) {
      var _this3 = this;

      code = code || 'error';
      reason = reason || 'Has alcanzado la cantidad maxima de players activos.';

      (0, _utils.log)('stop player - ', reason);

      this.player.trigger({
        type: 'tbxplayerblocked',
        code: code,
        reason: reason,
        error: error
      });

      this.player.pause();
      this.player.dispose();

      if (this.options.showAlert) {
        setTimeout(function () {
          alert(_this3.options.errorMsg);
        }, 0);
      }
    }

    /**
     * get last position
     *
     * @param info
     */
  }, {
    key: 'recoverStatus',
    value: function recoverStatus(info) {
      var _this4 = this;

      if (!info.position) {
        return;
      }

      this.player.currentTime = info.position;

      this.player.on('loadedmetadata', function () {
        return _this4.currentTime = info.position;
      });
    }

    /* ************** */

    /**
     * creates a monitor interval
     *
     * @param ok
     */
  }, {
    key: 'makeWatchdog',
    value: function makeWatchdog(ok) {
      var _this5 = this;

      var watchdog = null;
      var options = this.options;
      var player = this.player;

      var lasTime = options.startPosition || 0;
      var playerToken = null;
      var playerID = options.playerID;

      player.on('timeupdate', function (e) {

        // waits until 'loadedmetadata' event is raised
        if (!_this5.eventsFlags.loadedmetadata || !_this5.firstSent) {
          _this5.firstSent = true;
          return;
        }

        lasTime = Math.round(player.currentTime() || 0);
      });

      // clear after dispose
      var cleanUp = function cleanUp() {

        if (watchdog) {
          player.clearInterval(watchdog);
          watchdog = false;

          _this5.makeRequest(options.disposeurl, {
            player: playerID,
            position: lasTime,
            token: playerToken,
            status: 'paused',
            timeSpent: getTimeSpent(_this5.startDate)
          }, function () {});
        }
      };

      // add hooks
      player.on('dispose', cleanUp);
      window.addEventListener('beforeunload', cleanUp);

      if (!watchdog) {
        (function () {

          var pendingRequest = false;
          // real watchdog
          var wdf = function wdf() {

            player.trigger({
              type: 'tbxplayerupdate',
              playerID: playerID
            });

            // avoid conflicts
            if (pendingRequest) {
              return;
            }
            pendingRequest = true;

            _this5.makeRequest(options.updateurl, {
              player: playerID,
              token: playerToken,
              position: lasTime,
              status: player.paused() ? 'paused' : 'playing',
              event: 'Progress',
              timeSpent: getTimeSpent(_this5.startDate)
            }, function (error, response) {

              pendingRequest = false;

              if (error) {
                (0, _utils.log)('updateurl api error', error);

                // allow some error level
                if (_this5.updateFailsCount >= options.maxUpdateFails) {
                  _this5.blockPlayer(player, 'authapifail', { msg: error });
                }

                (0, _utils.log)('updateurl retry later', _this5.updateFailsCount, options.maxUpdateFails);

                _this5.updateFailsCount++;

                return;
              }

              _this5.updateFailsCount = 1;

              if (response && response.success) {
                playerID = response.player || playerID;
                playerToken = response.token || playerToken;
                _this5.playerToken = playerToken;
              } else {
                (0, _utils.log)(new Error('Player Auth error'), response);
                _this5.blockPlayer(player, 'noauth', response);
              }
            });
          };

          watchdog = player.setInterval(wdf, options.interval * 1000);

          // call & block
          wdf();
        })();
      }
    }
  }]);

  return ConcurrentViewPlugin;
})();

exports['default'] = ConcurrentViewPlugin;

////////////////////////////////////

/**
 *
 * @param {*} start
 */
function getTimeSpent(start) {

  if (!start) {

    return null;
  }

  return Math.round((Date.now() - start) / 1000);
}
module.exports = exports['default'];
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../utils":2,"deepmerge":3}],2:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.log = log;
exports.validateRequiredOpts = validateRequiredOpts;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

/**
 * videojs.log customization
 */

function log() {
    var logCmd = _videoJs2['default'].log;
    var args = [].slice.call(arguments);

    var type = args.find(function (arg) {

        return arg === 'error' || arg === 'warn';
    });

    if (type) {
        logCmd = _videoJs2['default'].log[type];
    }

    args[0] = '[videojs/plugins/concurrence-limiter]: ' + args[0];

    logCmd.apply(_videoJs2['default'], args);
}

;

/**
 * Validate required options
 *
 * @param {*} options plugin options
 */

function validateRequiredOpts(options) {
    var URI_PATTERN = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i;
    var schema = {
        playerID: function playerID(value) {
            return value !== null || typeof value !== 'undefined';
        },
        accessurl: function accessurl(value) {
            return URI_PATTERN.test(value);
        },
        updateurl: function updateurl(value) {
            return URI_PATTERN.test(value);
        },
        disposeurl: function disposeurl(value) {
            return URI_PATTERN.test(value);
        },
        interval: function interval(value) {
            return value && !isNaN(value) && parseInt(value) <= 10;
        }
    };

    var errors = Object.keys(schema).map(function (prop) {
        var validator = schema[prop],
            current = options[prop];

        return [prop, validator(current)];
    }).reduce(function (errors, pair) {

        if (pair[1] === false) {
            errors.push(pair[0] + ' is invalid. option required.');
        }

        return errors;
    }, []);

    if (errors.length > 0) {
        errors.forEach(function (error) {
            log(error, 'error');
        });

        log('CURRENT OPTIONS: ', options);
        return false;
    }

    return true;
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.deepmerge = factory();
    }
}(this, function () {

return function deepmerge(target, src) {
    var array = Array.isArray(src);
    var dst = array && [] || {};

    if (array) {
        target = target || [];
        dst = dst.concat(target);
        src.forEach(function(e, i) {
            if (typeof dst[i] === 'undefined') {
                dst[i] = e;
            } else if (typeof e === 'object') {
                dst[i] = deepmerge(target[i], e);
            } else {
                if (target.indexOf(e) === -1) {
                    dst.push(e);
                }
            }
        });
    } else {
        if (target && typeof target === 'object') {
            Object.keys(target).forEach(function (key) {
                dst[key] = target[key];
            })
        }
        Object.keys(src).forEach(function (key) {
            if (typeof src[key] !== 'object' || !src[key]) {
                dst[key] = src[key];
            }
            else {
                if (!target[key]) {
                    dst[key] = src[key];
                } else {
                    dst[key] = deepmerge(target[key], src[key]);
                }
            }
        });
    }

    return dst;
}

}));

},{}],4:[function(require,module,exports){
(function (global){
'use strict';
/**
 * videojs-concurrence-limiter
 * Plugin loader
 *
 * @file plugin.js
 * @module concurrenceLimiterPlugin
 **/
Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

var _ConcurrentView = require('./ConcurrentView');

var _ConcurrentView2 = _interopRequireDefault(_ConcurrentView);

var _utils = require('./utils');

// Default options for the plugin.
var defaults = {
  interval: 10,
  accessurl: null,
  updateurl: null,
  disposeurl: null,
  playerID: null,
  startPosition: 0,
  maxUpdateFails: 3,
  request: {
    timeout: 15 * 1000,
    headers: {}
  },
  showAlert: true,
  errorMsg: 'Bloqueado por límite de concurrencia.'
};

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 * @param    {Object} [options={}]
 */
var onPlayerReady = function onPlayerReady(player, options) {

  player.addClass('vjs-concurrence-limiter');

  player._cvPlugin = new _ConcurrentView2['default'](options, player);
  var cvPlugin = player._cvPlugin;

  // Hook into player events after player is ready to avoid missing first triggered events
  cvPlugin.hookPlayerEvents();

  cvPlugin.validatePlay(function (error, ok) {

    if (error) {
      (0, _utils.log)(' error', error);
      cvPlugin.blockPlayer('cantplay', error);
    } else {

      cvPlugin.recoverStatus(ok);
      // monitor
      cvPlugin.makeWatchdog(ok);
    }
  });
};

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function concurrenceLimiter
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
var concurrenceLimiter = function concurrenceLimiter(useroptions) {
  var _this = this;

  var options = _videoJs2['default'].mergeOptions(defaults, useroptions);

  if (!(0, _utils.validateRequiredOpts)(options)) {
    return;
  }

  this.ready(function () {

    onPlayerReady(_this, options);
  });
};

// Register the plugin with video.js.
var registerPlugin = _videoJs2['default'].registerPlugin || _videoJs2['default'].plugin;
registerPlugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '0.6.0';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ConcurrentView":1,"./utils":2}]},{},[4])(4)
});
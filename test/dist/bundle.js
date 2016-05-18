(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":1}],3:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

// Default options for the plugin.
var defaults = {
  interval: 10,
  accessurl: null,
  updateurl: null,
  disposeurl: null,
  playerID: null,
  startPosition: 0
};

/**
 * creates player ids
 */

var ConcurrentViewIdMaker = (function () {
  function ConcurrentViewIdMaker() {
    _classCallCheck(this, ConcurrentViewIdMaker);

    this.sessionStorageKey = 'vcl-player-id';
  }

  /**
   * main plugin component class
   */

  _createClass(ConcurrentViewIdMaker, [{
    key: 'generate',
    value: function generate(options) {

      //user-made id
      if (options.playerID) {
        return options.playerID;
      }

      return this.generateBySessionStorage() || 'rdm-' + this.generateRandom();
    }
  }, {
    key: 'generateRandom',
    value: function generateRandom(len) {
      return Math.random().toString((len || 30) + 2).substr(2);
    }
  }, {
    key: 'generateBySessionStorage',
    value: function generateBySessionStorage() {

      if (!window.sessionStorage) {
        return null;
      }

      var id = window.sessionStorage.getItem(this.sessionStorageKey);

      if (!id) {
        id = 'ssi-' + this.generateRandom();
        window.sessionStorage.setItem(this.sessionStorageKey, id);
      }

      return id;
    }
  }]);

  return ConcurrentViewIdMaker;
})();

var ConcurrentViewPlugin = (function () {
  function ConcurrentViewPlugin(options, player) {
    _classCallCheck(this, ConcurrentViewPlugin);

    this.options = options;
    this.player = player;

    this.options.playerID = new ConcurrentViewIdMaker().generate(options);
  }

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

  /**
   * xhr alias
   *
   * @param url
   * @param data
   * @param cb
     */

  _createClass(ConcurrentViewPlugin, [{
    key: 'makeRequest',
    value: function makeRequest(url, data, cb) {
      _videoJs2['default'].xhr({
        body: data ? JSON.stringify(data) : '{}',
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, function (err, resp, body) {

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
      var _this = this;

      this.makeRequest(this.options.accessurl, {
        player: this.options.playerID
      }, function (error, ok) {
        if (error) {
          _videoJs2['default'].log('concurrenceview: canplay api error', error);
          cb(new Error(error), null);
          return;
        }

        if (ok && ok.success) {
          cb(null, ok);

          _this.player.trigger({
            type: 'avplayercanplay',
            code: 1
          });
        } else {
          cb(new Error('Player Auth error'), null);
        }
      });
    }
  }, {
    key: 'blockPlayer',
    value: function blockPlayer(code, error, reason) {
      code = code || 'error';
      reason = reason || 'Has alcanzado la cantidad maxima de players activos.';

      _videoJs2['default'].log('concurrenceview: stop player - ', reason);

      this.player.trigger({
        type: 'avplayerbloked',
        code: code,
        reason: reason,
        error: error
      });

      this.player.pause();
      this.player.dispose();
    }
  }, {
    key: 'recoverStatus',
    value: function recoverStatus(info) {
      var _this2 = this;

      if (!info.position) {
        return;
      }

      this.player.currentTime = info.position;

      this.player.on('loadedmetadata', function () {
        return _this2.currentTime = info.position;
      });
    }

    /* ************** */

  }, {
    key: 'makeWatchdog',
    value: function makeWatchdog(ok) {
      var _this3 = this;

      var watchdog = null;
      var options = this.options;
      var player = this.player;

      var lasTime = options.startPosition || 0;
      var playerToken = null;
      var playerID = options.playerID;
      var loadedmetadata = false;

      player.on('loadedmetadata', function () {
        return loadedmetadata = true;
      });

      player.on('timeupdate', function (e) {

        if (!loadedmetadata || !_this3.fistSent) {
          _this3.fistSent = true;
          return;
        }

        lasTime = Math.round(player.currentTime() || 0);
      });

      _videoJs2['default'].log('concurrence plugin: ok', ok);

      var cleanUp = function cleanUp() {
        _videoJs2['default'].log('concurrenceview: DISPOSE', options);

        if (watchdog) {
          player.clearInterval(watchdog);
          watchdog = false;

          _this3.makeRequest(options.disposeurl, {
            player: playerID,
            position: lasTime,
            token: playerToken,
            status: 'paused'
          }, function () {});
        }
      };

      player.on('dispose', cleanUp);

      window.addEventListener('beforeunload', cleanUp);

      if (!watchdog) {

        var wdf = function wdf() {

          player.trigger({
            type: 'avplayerupdate',
            playerID: playerID
          });

          _this3.makeRequest(options.updateurl, {
            player: playerID,
            token: playerToken,
            position: lasTime,
            status: player.paused() ? 'paused' : 'playing'
          }, function (error, response) {

            if (error) {
              _videoJs2['default'].log('concurrenceview: update api error', error);
              _this3.blockPlayer(player, 'authapifail', { msg: error });
              return;
            }

            if (response && response.success) {
              playerID = response.player || playerID;
              playerToken = response.token || playerToken;
            } else {
              _videoJs2['default'].log(new Error('Player Auth error'), response);
              _this3.blockPlayer(player, 'noauth', response);
            }
          });
        };

        watchdog = player.setInterval(wdf, options.interval * 1000);
        wdf();
      }
    }
  }]);

  return ConcurrentViewPlugin;
})();

var onPlayerReady = function onPlayerReady(player, options) {
  player.addClass('vjs-concurrence-limiter');

  player._cvPlugin = new ConcurrentViewPlugin(options, player);
  var cvPlugin = player._cvPlugin;

  cvPlugin.validatePlay(function (error, ok) {

    if (error) {
      _videoJs2['default'].log('concurrenceview: error', error);
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
  var _this4 = this;

  this.ready(function () {

    var options = _videoJs2['default'].mergeOptions(defaults, useroptions);

    _videoJs2['default'].log('concurrenceview plugin', options);

    if (!options.accessurl || !options.updateurl || !options.disposeurl) {
      _videoJs2['default'].log('concurrenceview: invalid urls', options);
      return;
    }

    if (!options.interval || options.interval < 5) {
      _videoJs2['default'].log('concurrenceview: invalid options', options);
      return;
    }

    onPlayerReady(_this4, options);
  });
};

// Register the plugin with video.js.
_videoJs2['default'].plugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '0.2.0';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],4:[function(require,module,exports){
(function (global){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _globalDocument = require('global/document');

var _globalDocument2 = _interopRequireDefault(_globalDocument);

var _qunit = (typeof window !== "undefined" ? window['QUnit'] : typeof global !== "undefined" ? global['QUnit'] : null);

var _qunit2 = _interopRequireDefault(_qunit);

var _sinon = (typeof window !== "undefined" ? window['sinon'] : typeof global !== "undefined" ? global['sinon'] : null);

var _sinon2 = _interopRequireDefault(_sinon);

var _videoJs = (typeof window !== "undefined" ? window['videojs'] : typeof global !== "undefined" ? global['videojs'] : null);

var _videoJs2 = _interopRequireDefault(_videoJs);

var _srcPlugin = require('../src/plugin');

var _srcPlugin2 = _interopRequireDefault(_srcPlugin);

var Player = _videoJs2['default'].getComponent('Player');

_qunit2['default'].test('the environment is sane', function (assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof _sinon2['default'], 'object', 'sinon exists');
  assert.strictEqual(typeof _videoJs2['default'], 'function', 'videojs exists');
  assert.strictEqual(typeof _srcPlugin2['default'], 'function', 'plugin is a function');
});

_qunit2['default'].module('videojs-concurrence-limiter', {

  beforeEach: function beforeEach() {

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = _sinon2['default'].useFakeTimers();

    this.fixture = _globalDocument2['default'].getElementById('qunit-fixture');
    this.video = _globalDocument2['default'].createElement('video');
    this.fixture.appendChild(this.video);
    this.player = (0, _videoJs2['default'])(this.video);
  },

  afterEach: function afterEach() {
    this.player.dispose();
    this.clock.restore();
  }
});

_qunit2['default'].test('registers itself with video.js', function (assert) {
  assert.expect(2);

  assert.strictEqual(Player.prototype.concurrenceLimiter, _srcPlugin2['default'], 'videojs-concurrence-limiter plugin was registered');

  this.player.concurrenceLimiter({
    accessurl: '/limiter/canplay',
    updateurl: '/limiter/playing',
    disposeurl: '/limiter/stop',
    startPosition: 123
  });

  // Tick the clock forward enough to trigger the player to be "ready".
  this.clock.tick(1);

  assert.ok(this.player.hasClass('vjs-concurrence-limiter'), 'the plugin adds a class to the player');
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../src/plugin":3,"global/document":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIi9ob21lL2ZyYW4vd29ya3NwYWNlL3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlci9zcmMvcGx1Z2luLmpzIiwiL2hvbWUvZnJhbi93b3Jrc3BhY2UvdmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyL3Rlc3QvcGx1Z2luLnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7O3VCQ2ZvQixVQUFVOzs7OztBQUc5QixJQUFNLFFBQVEsR0FBRztBQUNmLFVBQVEsRUFBRSxFQUFFO0FBQ1osV0FBUyxFQUFFLElBQUk7QUFDZixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLFVBQVEsRUFBRSxJQUFJO0FBQ2QsZUFBYSxFQUFFLENBQUM7Q0FDakIsQ0FBQzs7Ozs7O0lBS0kscUJBQXFCO0FBRWQsV0FGUCxxQkFBcUIsR0FFWDswQkFGVixxQkFBcUI7O0FBR3ZCLFFBQUksQ0FBQyxpQkFBaUIsR0FBRyxlQUFlLENBQUM7R0FDMUM7Ozs7OztlQUpHLHFCQUFxQjs7V0FNakIsa0JBQUMsT0FBTyxFQUFFOzs7QUFHaEIsVUFBRyxPQUFPLENBQUMsUUFBUSxFQUFFO0FBQ25CLGVBQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxJQUFLLE1BQU0sR0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLEFB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LCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIiwidmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxuaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY3VtZW50O1xufSBlbHNlIHtcbiAgICB2YXIgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddO1xuXG4gICAgaWYgKCFkb2NjeSkge1xuICAgICAgICBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J10gPSBtaW5Eb2M7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcbn1cbiIsImltcG9ydCB2aWRlb2pzIGZyb20gJ3ZpZGVvLmpzJztcblxuLy8gRGVmYXVsdCBvcHRpb25zIGZvciB0aGUgcGx1Z2luLlxuY29uc3QgZGVmYXVsdHMgPSB7XG4gIGludGVydmFsOiAxMCxcbiAgYWNjZXNzdXJsOiBudWxsLFxuICB1cGRhdGV1cmw6IG51bGwsXG4gIGRpc3Bvc2V1cmw6IG51bGwsXG4gIHBsYXllcklEOiBudWxsLFxuICBzdGFydFBvc2l0aW9uOiAwXG59O1xuXG4vKipcbiAqIGNyZWF0ZXMgcGxheWVyIGlkc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld0lkTWFrZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXkgPSAndmNsLXBsYXllci1pZCc7XG4gIH1cblxuICBnZW5lcmF0ZShvcHRpb25zKSB7XG5cbiAgICAvL3VzZXItbWFkZSBpZFxuICAgIGlmKG9wdGlvbnMucGxheWVySUQpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLnBsYXllcklEO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmdlbmVyYXRlQnlTZXNzaW9uU3RvcmFnZSgpIHx8ICgncmRtLScrdGhpcy5nZW5lcmF0ZVJhbmRvbSgpKTtcbiAgfVxuXG4gIGdlbmVyYXRlUmFuZG9tKGxlbikge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKCAobGVuIHx8IDMwKSArIDIgKS5zdWJzdHIoMik7XG4gIH1cblxuXG4gIGdlbmVyYXRlQnlTZXNzaW9uU3RvcmFnZSgpIHtcblxuICAgIGlmICghd2luZG93LnNlc3Npb25TdG9yYWdlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgaWQgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSh0aGlzLnNlc3Npb25TdG9yYWdlS2V5KTtcblxuICAgIGlmICghaWQpIHtcbiAgICAgIGlkID0gJ3NzaS0nK3RoaXMuZ2VuZXJhdGVSYW5kb20oKTtcbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXksIGlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxufVxuXG4vKipcbiAqIG1haW4gcGx1Z2luIGNvbXBvbmVudCBjbGFzc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld1BsdWdpbiB7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucywgcGxheWVyKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgIHRoaXMub3B0aW9ucy5wbGF5ZXJJRCA9IG5ldyBDb25jdXJyZW50Vmlld0lkTWFrZXIoKS5nZW5lcmF0ZShvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiB4aHIgYWxpYXNcbiAgICpcbiAgICogQHBhcmFtIHVybFxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcGFyYW0gY2JcbiAgICAgKi9cbiAgbWFrZVJlcXVlc3QodXJsLCBkYXRhLCBjYikge1xuICAgIHZpZGVvanMueGhyKFxuICAgICAge1xuICAgICAgICBib2R5OiBkYXRhID8gSlNPTi5zdHJpbmdpZnkoZGF0YSkgOiAne30nLFxuICAgICAgICB1cmwsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgKGVyciwgcmVzcCwgYm9keSkgPT4ge1xuXG4gICAgICAgIGxldCBib2R5SnNvbjtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGJvZHlKc29uID0gYm9keSA/IEpTT04ucGFyc2UoYm9keSkgOiB7ZXJyb3I6ICdpbnZhbGlkIGJvZHknLCBib2R5fTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGJvZHlKc29uID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNiKGVyciA/IGVyci5tZXNzYWdlIHx8IGVyciA6IG51bGwsIGJvZHlKc29uKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIHZhbGlkYXRlcyBwbGF5ZXIgYWNjZXNzXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICB2YWxpZGF0ZVBsYXkoY2IpIHtcblxuICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICB0aGlzLm9wdGlvbnMuYWNjZXNzdXJsLFxuICAgICAge1xuICAgICAgICBwbGF5ZXI6IHRoaXMub3B0aW9ucy5wbGF5ZXJJRFxuICAgICAgfSxcbiAgICAgIChlcnJvciwgb2spID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogY2FucGxheSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgY2IobmV3IEVycm9yKGVycm9yKSwgbnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9rICYmIG9rLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBjYihudWxsLCBvayk7XG5cbiAgICAgICAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgICAgICAgIHR5cGU6ICdhdnBsYXllcmNhbnBsYXknLFxuICAgICAgICAgICAgY29kZTogMVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKG5ldyBFcnJvcignUGxheWVyIEF1dGggZXJyb3InKSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gIH1cblxuICBibG9ja1BsYXllcihjb2RlLCBlcnJvciwgcmVhc29uKSB7XG4gICAgY29kZSA9IGNvZGUgfHwgJ2Vycm9yJztcbiAgICByZWFzb24gPSByZWFzb24gfHwgJ0hhcyBhbGNhbnphZG8gbGEgY2FudGlkYWQgbWF4aW1hIGRlIHBsYXllcnMgYWN0aXZvcy4nO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogc3RvcCBwbGF5ZXIgLSAnLCByZWFzb24pO1xuXG4gICAgdGhpcy5wbGF5ZXIudHJpZ2dlcih7XG4gICAgICB0eXBlOiAnYXZwbGF5ZXJibG9rZWQnLFxuICAgICAgY29kZSxcbiAgICAgIHJlYXNvbixcbiAgICAgIGVycm9yXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgfVxuXG4gIHJlY292ZXJTdGF0dXMoaW5mbykge1xuICAgIGlmICghaW5mby5wb3NpdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGxheWVyLmN1cnJlbnRUaW1lID0gaW5mby5wb3NpdGlvbjtcblxuICAgIHRoaXMucGxheWVyLm9uKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHRoaXMuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uKTtcblxuICB9XG5cbiAgLyogKioqKioqKioqKioqKiogKi9cblxuICBtYWtlV2F0Y2hkb2cob2spIHtcblxuICAgIGxldCB3YXRjaGRvZyA9IG51bGw7XG4gICAgbGV0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgbGV0IHBsYXllciA9IHRoaXMucGxheWVyO1xuXG4gICAgbGV0IGxhc1RpbWUgPSBvcHRpb25zLnN0YXJ0UG9zaXRpb24gfHwgMDtcbiAgICBsZXQgcGxheWVyVG9rZW4gPSBudWxsO1xuICAgIGxldCBwbGF5ZXJJRCA9IG9wdGlvbnMucGxheWVySUQ7XG4gICAgbGV0IGxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG5cbiAgICBwbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gbG9hZGVkbWV0YWRhdGEgPSB0cnVlKTtcblxuICAgIHBsYXllci5vbigndGltZXVwZGF0ZScsIChlKSA9PiB7XG5cbiAgICAgIGlmICghbG9hZGVkbWV0YWRhdGEgfHwgIXRoaXMuZmlzdFNlbnQpIHtcbiAgICAgICAgdGhpcy5maXN0U2VudCA9IHRydWU7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGFzVGltZSA9IE1hdGgucm91bmQocGxheWVyLmN1cnJlbnRUaW1lKCkgfHwgMCk7XG4gICAgfSk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2UgcGx1Z2luOiBvaycsIG9rKTtcblxuICAgIGxldCBjbGVhblVwID0gKCkgPT4ge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogRElTUE9TRScsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAod2F0Y2hkb2cpIHtcbiAgICAgICAgcGxheWVyLmNsZWFySW50ZXJ2YWwod2F0Y2hkb2cpO1xuICAgICAgICB3YXRjaGRvZyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy5kaXNwb3NldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHN0YXR1czogJ3BhdXNlZCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHt9XG4gICAgICAgICk7XG5cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcGxheWVyLm9uKCdkaXNwb3NlJywgY2xlYW5VcCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgY2xlYW5VcCk7XG5cbiAgICBpZiAoIXdhdGNoZG9nKSB7XG5cbiAgICAgIGxldCB3ZGYgPSAoKSA9PiB7XG5cbiAgICAgICAgcGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgIHR5cGU6ICdhdnBsYXllcnVwZGF0ZScsXG4gICAgICAgICAgcGxheWVySURcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLnVwZGF0ZXVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwbGF5ZXI6IHBsYXllcklELFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgcG9zaXRpb246IGxhc1RpbWUsXG4gICAgICAgICAgICBzdGF0dXM6IHBsYXllci5wYXVzZWQoKSA/ICdwYXVzZWQnIDogJ3BsYXlpbmcnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoZXJyb3IsIHJlc3BvbnNlKSA9PiB7XG5cbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiB1cGRhdGUgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICB0aGlzLmJsb2NrUGxheWVyKHBsYXllciwgJ2F1dGhhcGlmYWlsJywge21zZzogZXJyb3J9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICAgICAgICBwbGF5ZXJJRCA9IHJlc3BvbnNlLnBsYXllciB8fCBwbGF5ZXJJRDtcbiAgICAgICAgICAgICAgcGxheWVyVG9rZW4gPSByZXNwb25zZS50b2tlbiB8fCBwbGF5ZXJUb2tlbjtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmlkZW9qcy5sb2cobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnbm9hdXRoJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG5cbiAgICAgIHdhdGNoZG9nID0gcGxheWVyLnNldEludGVydmFsKHdkZiwgb3B0aW9ucy5pbnRlcnZhbCAqIDEwMDApO1xuICAgICAgd2RmKCk7XG4gICAgfVxuXG4gIH1cblxufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBwbGF5ZXIgaXMgcmVhZHkuXG4gKlxuICogVGhpcyBpcyBhIGdyZWF0IHBsYWNlIGZvciB5b3VyIHBsdWdpbiB0byBpbml0aWFsaXplIGl0c2VsZi4gV2hlbiB0aGlzXG4gKiBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSBwbGF5ZXIgd2lsbCBoYXZlIGl0cyBET00gYW5kIGNoaWxkIGNvbXBvbmVudHNcbiAqIGluIHBsYWNlLlxuICpcbiAqIEBmdW5jdGlvbiBvblBsYXllclJlYWR5XG4gKiBAcGFyYW0gICAge1BsYXllcn0gcGxheWVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKi9cbmNvbnN0IG9uUGxheWVyUmVhZHkgPSAocGxheWVyLCBvcHRpb25zKSA9PiB7XG4gIHBsYXllci5hZGRDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKTtcblxuICBwbGF5ZXIuX2N2UGx1Z2luID0gbmV3IENvbmN1cnJlbnRWaWV3UGx1Z2luKG9wdGlvbnMsIHBsYXllcik7XG4gIGxldCBjdlBsdWdpbiA9IHBsYXllci5fY3ZQbHVnaW47XG5cbiAgY3ZQbHVnaW4udmFsaWRhdGVQbGF5KChlcnJvciwgb2spID0+IHtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogZXJyb3InLCBlcnJvcik7XG4gICAgICBjdlBsdWdpbi5ibG9ja1BsYXllcignY2FudHBsYXknLCBlcnJvcik7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICBjdlBsdWdpbi5yZWNvdmVyU3RhdHVzKG9rKTtcbiAgICAgIC8vIG1vbml0b3JcbiAgICAgIGN2UGx1Z2luLm1ha2VXYXRjaGRvZyhvayk7XG4gICAgfVxuXG4gIH0pO1xuXG59O1xuXG4vKipcbiAqIEEgdmlkZW8uanMgcGx1Z2luLlxuICpcbiAqIEluIHRoZSBwbHVnaW4gZnVuY3Rpb24sIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaXMgYSB2aWRlby5qcyBgUGxheWVyYFxuICogaW5zdGFuY2UuIFlvdSBjYW5ub3QgcmVseSBvbiB0aGUgcGxheWVyIGJlaW5nIGluIGEgXCJyZWFkeVwiIHN0YXRlIGhlcmUsXG4gKiBkZXBlbmRpbmcgb24gaG93IHRoZSBwbHVnaW4gaXMgaW52b2tlZC4gVGhpcyBtYXkgb3IgbWF5IG5vdCBiZSBpbXBvcnRhbnRcbiAqIHRvIHlvdTsgaWYgbm90LCByZW1vdmUgdGhlIHdhaXQgZm9yIFwicmVhZHlcIiFcbiAqXG4gKiBAZnVuY3Rpb24gY29uY3VycmVuY2VMaW1pdGVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKiAgICAgICAgICAgQW4gb2JqZWN0IG9mIG9wdGlvbnMgbGVmdCB0byB0aGUgcGx1Z2luIGF1dGhvciB0byBkZWZpbmUuXG4gKi9cbmNvbnN0IGNvbmN1cnJlbmNlTGltaXRlciA9IGZ1bmN0aW9uKHVzZXJvcHRpb25zKSB7XG5cbiAgdGhpcy5yZWFkeSgoKSA9PiB7XG5cbiAgICBsZXQgb3B0aW9ucyA9IHZpZGVvanMubWVyZ2VPcHRpb25zKGRlZmF1bHRzLCB1c2Vyb3B0aW9ucyk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3IHBsdWdpbicsIG9wdGlvbnMpO1xuXG4gICAgaWYgKCFvcHRpb25zLmFjY2Vzc3VybCB8fCAhb3B0aW9ucy51cGRhdGV1cmwgfHwgIW9wdGlvbnMuZGlzcG9zZXVybCkge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogaW52YWxpZCB1cmxzJywgb3B0aW9ucyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLmludGVydmFsIHx8IG9wdGlvbnMuaW50ZXJ2YWwgPCA1KSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIG9wdGlvbnMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvblBsYXllclJlYWR5KHRoaXMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIFJlZ2lzdGVyIHRoZSBwbHVnaW4gd2l0aCB2aWRlby5qcy5cbnZpZGVvanMucGx1Z2luKCdjb25jdXJyZW5jZUxpbWl0ZXInLCBjb25jdXJyZW5jZUxpbWl0ZXIpO1xuXG4vLyBJbmNsdWRlIHRoZSB2ZXJzaW9uIG51bWJlci5cbmNvbmN1cnJlbmNlTGltaXRlci5WRVJTSU9OID0gJ19fVkVSU0lPTl9fJztcblxuZXhwb3J0IGRlZmF1bHQgY29uY3VycmVuY2VMaW1pdGVyO1xuIiwiaW1wb3J0IGRvY3VtZW50IGZyb20gJ2dsb2JhbC9kb2N1bWVudCc7XG5cbmltcG9ydCBRVW5pdCBmcm9tICdxdW5pdCc7XG5pbXBvcnQgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHZpZGVvanMgZnJvbSAndmlkZW8uanMnO1xuXG5pbXBvcnQgcGx1Z2luIGZyb20gJy4uL3NyYy9wbHVnaW4nO1xuXG5jb25zdCBQbGF5ZXIgPSB2aWRlb2pzLmdldENvbXBvbmVudCgnUGxheWVyJyk7XG5cblFVbml0LnRlc3QoJ3RoZSBlbnZpcm9ubWVudCBpcyBzYW5lJywgZnVuY3Rpb24oYXNzZXJ0KSB7XG4gIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgQXJyYXkuaXNBcnJheSwgJ2Z1bmN0aW9uJywgJ2VzNSBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBzaW5vbiwgJ29iamVjdCcsICdzaW5vbiBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiB2aWRlb2pzLCAnZnVuY3Rpb24nLCAndmlkZW9qcyBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBwbHVnaW4sICdmdW5jdGlvbicsICdwbHVnaW4gaXMgYSBmdW5jdGlvbicpO1xufSk7XG5cblFVbml0Lm1vZHVsZSgndmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyJywge1xuXG4gIGJlZm9yZUVhY2goKSB7XG5cbiAgICAvLyBNb2NrIHRoZSBlbnZpcm9ubWVudCdzIHRpbWVycyBiZWNhdXNlIGNlcnRhaW4gdGhpbmdzIC0gcGFydGljdWxhcmx5XG4gICAgLy8gcGxheWVyIHJlYWRpbmVzcyAtIGFyZSBhc3luY2hyb25vdXMgaW4gdmlkZW8uanMgNS4gVGhpcyBNVVNUIGNvbWVcbiAgICAvLyBiZWZvcmUgYW55IHBsYXllciBpcyBjcmVhdGVkOyBvdGhlcndpc2UsIHRpbWVycyBjb3VsZCBnZXQgY3JlYXRlZFxuICAgIC8vIHdpdGggdGhlIGFjdHVhbCB0aW1lciBtZXRob2RzIVxuICAgIHRoaXMuY2xvY2sgPSBzaW5vbi51c2VGYWtlVGltZXJzKCk7XG5cbiAgICB0aGlzLmZpeHR1cmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVuaXQtZml4dHVyZScpO1xuICAgIHRoaXMudmlkZW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuICAgIHRoaXMuZml4dHVyZS5hcHBlbmRDaGlsZCh0aGlzLnZpZGVvKTtcbiAgICB0aGlzLnBsYXllciA9IHZpZGVvanModGhpcy52aWRlbyk7XG4gIH0sXG5cbiAgYWZ0ZXJFYWNoKCkge1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgICB0aGlzLmNsb2NrLnJlc3RvcmUoKTtcbiAgfVxufSk7XG5cblFVbml0LnRlc3QoJ3JlZ2lzdGVycyBpdHNlbGYgd2l0aCB2aWRlby5qcycsIGZ1bmN0aW9uKGFzc2VydCkge1xuICBhc3NlcnQuZXhwZWN0KDIpO1xuXG4gIGFzc2VydC5zdHJpY3RFcXVhbChcbiAgICBQbGF5ZXIucHJvdG90eXBlLmNvbmN1cnJlbmNlTGltaXRlcixcbiAgICBwbHVnaW4sXG4gICAgJ3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlciBwbHVnaW4gd2FzIHJlZ2lzdGVyZWQnXG4gICk7XG5cbiAgdGhpcy5wbGF5ZXIuY29uY3VycmVuY2VMaW1pdGVyKHtcbiAgICBhY2Nlc3N1cmw6ICcvbGltaXRlci9jYW5wbGF5JyxcbiAgICB1cGRhdGV1cmw6ICcvbGltaXRlci9wbGF5aW5nJyxcbiAgICBkaXNwb3NldXJsOiAnL2xpbWl0ZXIvc3RvcCcsXG4gICAgc3RhcnRQb3NpdGlvbjogMTIzXG4gIH0pO1xuXG4gIC8vIFRpY2sgdGhlIGNsb2NrIGZvcndhcmQgZW5vdWdoIHRvIHRyaWdnZXIgdGhlIHBsYXllciB0byBiZSBcInJlYWR5XCIuXG4gIHRoaXMuY2xvY2sudGljaygxKTtcblxuICBhc3NlcnQub2soXG4gICAgdGhpcy5wbGF5ZXIuaGFzQ2xhc3MoJ3Zqcy1jb25jdXJyZW5jZS1saW1pdGVyJyksXG4gICAgJ3RoZSBwbHVnaW4gYWRkcyBhIGNsYXNzIHRvIHRoZSBwbGF5ZXInXG4gICk7XG59KTtcbiJdfQ==

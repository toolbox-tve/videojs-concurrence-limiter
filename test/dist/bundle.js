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

  /**
   * create id (if needed)
   * @param options
   * @returns {*}
     */

  _createClass(ConcurrentViewIdMaker, [{
    key: 'generate',
    value: function generate(options) {

      // user-made id
      if (options.playerID) {
        return options.playerID;
      }

      return this.generateBySessionStorage() || 'rdm-' + this.generateRandom();
    }

    /**
     * random words
     * @param len
     * @returns {string}
       */
  }, {
    key: 'generateRandom',
    value: function generateRandom(len) {
      return Math.random().toString((len || 30) + 2).substr(2);
    }

    /**
     * sessionStorage id
     * @returns {null}
       */
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

    /**
     * get last position
     *
     * @param info
       */
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

    /**
     * creates a monitor interval
     *
     * @param ok
       */
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

        // waits until 'loadedmetadata' event is raised
        if (!loadedmetadata || !_this3.fistSent) {
          _this3.fistSent = true;
          return;
        }

        lasTime = Math.round(player.currentTime() || 0);
      });

      _videoJs2['default'].log('concurrence plugin: ok', ok);

      // clear after dispose
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

      // add hooks
      player.on('dispose', cleanUp);
      window.addEventListener('beforeunload', cleanUp);

      if (!watchdog) {

        // real watchdog
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

        // call & block
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

  _sinon2['default'].stub(_videoJs2['default'], 'xhr').yields(null, null, JSON.stringify({ success: true }));

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIi9ob21lL2ZyYW4vd29ya3NwYWNlL3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlci9zcmMvcGx1Z2luLmpzIiwiL2hvbWUvZnJhbi93b3Jrc3BhY2UvdmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyL3Rlc3QvcGx1Z2luLnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7O3VCQ2ZvQixVQUFVOzs7OztBQUc5QixJQUFNLFFBQVEsR0FBRztBQUNmLFVBQVEsRUFBRSxFQUFFO0FBQ1osV0FBUyxFQUFFLElBQUk7QUFDZixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLFVBQVEsRUFBRSxJQUFJO0FBQ2QsZUFBYSxFQUFFLENBQUM7Q0FDakIsQ0FBQzs7Ozs7O0lBS0kscUJBQXFCO0FBRWQsV0FGUCxxQkFBcUIsR0FFWDswQkFGVixxQkFBcUI7O0FBR3ZCLFFBQUksQ0FBQyxpQkFBaUIsR0FBRyxlQUFlLENBQUM7R0FDMUM7Ozs7Ozs7Ozs7OztlQUpHLHFCQUFxQjs7V0FXakIsa0JBQUMsT0FBTyxFQUFFOzs7QUFHaEIsVUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO0FBQ3BCLGVBQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxJQUFLLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxF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LENBQUMsQ0FBQzs7O0FBR0gsTUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRW5CLFFBQU0sQ0FBQyxFQUFFLENBQ1AsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFDL0MsdUNBQXVDLENBQ3hDLENBQUM7Q0FDSCxDQUFDLENBQUMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiIiwidmFyIHRvcExldmVsID0gdHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcgPyBnbG9iYWwgOlxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDoge31cbnZhciBtaW5Eb2MgPSByZXF1aXJlKCdtaW4tZG9jdW1lbnQnKTtcblxuaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY3VtZW50O1xufSBlbHNlIHtcbiAgICB2YXIgZG9jY3kgPSB0b3BMZXZlbFsnX19HTE9CQUxfRE9DVU1FTlRfQ0FDSEVANCddO1xuXG4gICAgaWYgKCFkb2NjeSkge1xuICAgICAgICBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J10gPSBtaW5Eb2M7XG4gICAgfVxuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBkb2NjeTtcbn1cbiIsImltcG9ydCB2aWRlb2pzIGZyb20gJ3ZpZGVvLmpzJztcblxuLy8gRGVmYXVsdCBvcHRpb25zIGZvciB0aGUgcGx1Z2luLlxuY29uc3QgZGVmYXVsdHMgPSB7XG4gIGludGVydmFsOiAxMCxcbiAgYWNjZXNzdXJsOiBudWxsLFxuICB1cGRhdGV1cmw6IG51bGwsXG4gIGRpc3Bvc2V1cmw6IG51bGwsXG4gIHBsYXllcklEOiBudWxsLFxuICBzdGFydFBvc2l0aW9uOiAwXG59O1xuXG4vKipcbiAqIGNyZWF0ZXMgcGxheWVyIGlkc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld0lkTWFrZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXkgPSAndmNsLXBsYXllci1pZCc7XG4gIH1cblxuICAvKipcbiAgICogY3JlYXRlIGlkIChpZiBuZWVkZWQpXG4gICAqIEBwYXJhbSBvcHRpb25zXG4gICAqIEByZXR1cm5zIHsqfVxuICAgICAqL1xuICBnZW5lcmF0ZShvcHRpb25zKSB7XG5cbiAgICAvLyB1c2VyLW1hZGUgaWRcbiAgICBpZiAob3B0aW9ucy5wbGF5ZXJJRCkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMucGxheWVySUQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ2VuZXJhdGVCeVNlc3Npb25TdG9yYWdlKCkgfHwgKCdyZG0tJyArIHRoaXMuZ2VuZXJhdGVSYW5kb20oKSk7XG4gIH1cblxuICAvKipcbiAgICogcmFuZG9tIHdvcmRzXG4gICAqIEBwYXJhbSBsZW5cbiAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgZ2VuZXJhdGVSYW5kb20obGVuKSB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoKGxlbiB8fCAzMCkgKyAyKS5zdWJzdHIoMik7XG4gIH1cblxuICAvKipcbiAgICogc2Vzc2lvblN0b3JhZ2UgaWRcbiAgICogQHJldHVybnMge251bGx9XG4gICAgICovXG4gIGdlbmVyYXRlQnlTZXNzaW9uU3RvcmFnZSgpIHtcblxuICAgIGlmICghd2luZG93LnNlc3Npb25TdG9yYWdlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgaWQgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSh0aGlzLnNlc3Npb25TdG9yYWdlS2V5KTtcblxuICAgIGlmICghaWQpIHtcbiAgICAgIGlkID0gJ3NzaS0nICsgdGhpcy5nZW5lcmF0ZVJhbmRvbSgpO1xuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0odGhpcy5zZXNzaW9uU3RvcmFnZUtleSwgaWQpO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG59XG5cbi8qKlxuICogbWFpbiBwbHVnaW4gY29tcG9uZW50IGNsYXNzXG4gKi9cbmNsYXNzIENvbmN1cnJlbnRWaWV3UGx1Z2luIHtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zLCBwbGF5ZXIpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuXG4gICAgdGhpcy5vcHRpb25zLnBsYXllcklEID0gbmV3IENvbmN1cnJlbnRWaWV3SWRNYWtlcigpLmdlbmVyYXRlKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIHhociBhbGlhc1xuICAgKlxuICAgKiBAcGFyYW0gdXJsXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICBtYWtlUmVxdWVzdCh1cmwsIGRhdGEsIGNiKSB7XG4gICAgdmlkZW9qcy54aHIoXG4gICAgICB7XG4gICAgICAgIGJvZHk6IGRhdGEgPyBKU09OLnN0cmluZ2lmeShkYXRhKSA6ICd7fScsXG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAoZXJyLCByZXNwLCBib2R5KSA9PiB7XG5cbiAgICAgICAgbGV0IGJvZHlKc29uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYm9keUpzb24gPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHtlcnJvcjogJ2ludmFsaWQgYm9keScsIGJvZHl9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgYm9keUpzb24gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY2IoZXJyID8gZXJyLm1lc3NhZ2UgfHwgZXJyIDogbnVsbCwgYm9keUpzb24pO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogdmFsaWRhdGVzIHBsYXllciBhY2Nlc3NcbiAgICogQHBhcmFtIGNiXG4gICAgICovXG4gIHZhbGlkYXRlUGxheShjYikge1xuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgIHRoaXMub3B0aW9ucy5hY2Nlc3N1cmwsXG4gICAgICB7XG4gICAgICAgIHBsYXllcjogdGhpcy5vcHRpb25zLnBsYXllcklEXG4gICAgICB9LFxuICAgICAgKGVycm9yLCBvaykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBjYW5wbGF5IGFwaSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICBjYihuZXcgRXJyb3IoZXJyb3IpLCBudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2sgJiYgb2suc3VjY2Vzcykge1xuICAgICAgICAgIGNiKG51bGwsIG9rKTtcblxuICAgICAgICAgIHRoaXMucGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgICAgdHlwZTogJ2F2cGxheWVyY2FucGxheScsXG4gICAgICAgICAgICBjb2RlOiAxXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cbiAgfVxuXG4gIC8qKlxuICAgKiBkaXNwb3NlcyBjdXJyZW50IHBsYXllciBpbnN0YW5jZVxuICAgKlxuICAgKiBAcGFyYW0gY29kZVxuICAgKiBAcGFyYW0gZXJyb3JcbiAgICogQHBhcmFtIHJlYXNvblxuICAgICAqL1xuICBibG9ja1BsYXllcihjb2RlLCBlcnJvciwgcmVhc29uKSB7XG4gICAgY29kZSA9IGNvZGUgfHwgJ2Vycm9yJztcbiAgICByZWFzb24gPSByZWFzb24gfHwgJ0hhcyBhbGNhbnphZG8gbGEgY2FudGlkYWQgbWF4aW1hIGRlIHBsYXllcnMgYWN0aXZvcy4nO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogc3RvcCBwbGF5ZXIgLSAnLCByZWFzb24pO1xuXG4gICAgdGhpcy5wbGF5ZXIudHJpZ2dlcih7XG4gICAgICB0eXBlOiAnYXZwbGF5ZXJibG9rZWQnLFxuICAgICAgY29kZSxcbiAgICAgIHJlYXNvbixcbiAgICAgIGVycm9yXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBnZXQgbGFzdCBwb3NpdGlvblxuICAgKlxuICAgKiBAcGFyYW0gaW5mb1xuICAgICAqL1xuICByZWNvdmVyU3RhdHVzKGluZm8pIHtcbiAgICBpZiAoIWluZm8ucG9zaXRpb24pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0aGlzLnBsYXllci5jdXJyZW50VGltZSA9IGluZm8ucG9zaXRpb247XG5cbiAgICB0aGlzLnBsYXllci5vbignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiB0aGlzLmN1cnJlbnRUaW1lID0gaW5mby5wb3NpdGlvbik7XG5cbiAgfVxuXG4gIC8qICoqKioqKioqKioqKioqICovXG5cbiAgLyoqXG4gICAqIGNyZWF0ZXMgYSBtb25pdG9yIGludGVydmFsXG4gICAqXG4gICAqIEBwYXJhbSBva1xuICAgICAqL1xuICBtYWtlV2F0Y2hkb2cob2spIHtcblxuICAgIGxldCB3YXRjaGRvZyA9IG51bGw7XG4gICAgbGV0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgbGV0IHBsYXllciA9IHRoaXMucGxheWVyO1xuXG4gICAgbGV0IGxhc1RpbWUgPSBvcHRpb25zLnN0YXJ0UG9zaXRpb24gfHwgMDtcbiAgICBsZXQgcGxheWVyVG9rZW4gPSBudWxsO1xuICAgIGxldCBwbGF5ZXJJRCA9IG9wdGlvbnMucGxheWVySUQ7XG4gICAgbGV0IGxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG5cbiAgICBwbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gbG9hZGVkbWV0YWRhdGEgPSB0cnVlKTtcblxuICAgIHBsYXllci5vbigndGltZXVwZGF0ZScsIChlKSA9PiB7XG5cbiAgICAgIC8vIHdhaXRzIHVudGlsICdsb2FkZWRtZXRhZGF0YScgZXZlbnQgaXMgcmFpc2VkXG4gICAgICBpZiAoIWxvYWRlZG1ldGFkYXRhIHx8ICF0aGlzLmZpc3RTZW50KSB7XG4gICAgICAgIHRoaXMuZmlzdFNlbnQgPSB0cnVlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxhc1RpbWUgPSBNYXRoLnJvdW5kKHBsYXllci5jdXJyZW50VGltZSgpIHx8IDApO1xuICAgIH0pO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNlIHBsdWdpbjogb2snLCBvayk7XG5cbiAgICAvLyBjbGVhciBhZnRlciBkaXNwb3NlXG4gICAgbGV0IGNsZWFuVXAgPSAoKSA9PiB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBESVNQT1NFJywgb3B0aW9ucyk7XG5cbiAgICAgIGlmICh3YXRjaGRvZykge1xuICAgICAgICBwbGF5ZXIuY2xlYXJJbnRlcnZhbCh3YXRjaGRvZyk7XG4gICAgICAgIHdhdGNoZG9nID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLmRpc3Bvc2V1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgc3RhdHVzOiAncGF1c2VkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKCkgPT4ge31cbiAgICAgICAgKTtcblxuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBhZGQgaG9va3NcbiAgICBwbGF5ZXIub24oJ2Rpc3Bvc2UnLCBjbGVhblVwKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgY2xlYW5VcCk7XG5cbiAgICBpZiAoIXdhdGNoZG9nKSB7XG5cbiAgICAgIC8vIHJlYWwgd2F0Y2hkb2dcbiAgICAgIGxldCB3ZGYgPSAoKSA9PiB7XG5cbiAgICAgICAgcGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgIHR5cGU6ICdhdnBsYXllcnVwZGF0ZScsXG4gICAgICAgICAgcGxheWVySURcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLnVwZGF0ZXVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwbGF5ZXI6IHBsYXllcklELFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgcG9zaXRpb246IGxhc1RpbWUsXG4gICAgICAgICAgICBzdGF0dXM6IHBsYXllci5wYXVzZWQoKSA/ICdwYXVzZWQnIDogJ3BsYXlpbmcnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoZXJyb3IsIHJlc3BvbnNlKSA9PiB7XG5cbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiB1cGRhdGUgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICB0aGlzLmJsb2NrUGxheWVyKHBsYXllciwgJ2F1dGhhcGlmYWlsJywge21zZzogZXJyb3J9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICAgICAgICBwbGF5ZXJJRCA9IHJlc3BvbnNlLnBsYXllciB8fCBwbGF5ZXJJRDtcbiAgICAgICAgICAgICAgcGxheWVyVG9rZW4gPSByZXNwb25zZS50b2tlbiB8fCBwbGF5ZXJUb2tlbjtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmlkZW9qcy5sb2cobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnbm9hdXRoJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG5cbiAgICAgIHdhdGNoZG9nID0gcGxheWVyLnNldEludGVydmFsKHdkZiwgb3B0aW9ucy5pbnRlcnZhbCAqIDEwMDApO1xuXG4gICAgICAvLyBjYWxsICYgYmxvY2tcbiAgICAgIHdkZigpO1xuICAgIH1cblxuICB9XG5cbn1cblxuLyoqXG4gKiBGdW5jdGlvbiB0byBpbnZva2Ugd2hlbiB0aGUgcGxheWVyIGlzIHJlYWR5LlxuICpcbiAqIFRoaXMgaXMgYSBncmVhdCBwbGFjZSBmb3IgeW91ciBwbHVnaW4gdG8gaW5pdGlhbGl6ZSBpdHNlbGYuIFdoZW4gdGhpc1xuICogZnVuY3Rpb24gaXMgY2FsbGVkLCB0aGUgcGxheWVyIHdpbGwgaGF2ZSBpdHMgRE9NIGFuZCBjaGlsZCBjb21wb25lbnRzXG4gKiBpbiBwbGFjZS5cbiAqXG4gKiBAZnVuY3Rpb24gb25QbGF5ZXJSZWFkeVxuICogQHBhcmFtICAgIHtQbGF5ZXJ9IHBsYXllclxuICogQHBhcmFtICAgIHtPYmplY3R9IFtvcHRpb25zPXt9XVxuICovXG5jb25zdCBvblBsYXllclJlYWR5ID0gKHBsYXllciwgb3B0aW9ucykgPT4ge1xuICBwbGF5ZXIuYWRkQ2xhc3MoJ3Zqcy1jb25jdXJyZW5jZS1saW1pdGVyJyk7XG5cbiAgcGxheWVyLl9jdlBsdWdpbiA9IG5ldyBDb25jdXJyZW50Vmlld1BsdWdpbihvcHRpb25zLCBwbGF5ZXIpO1xuICBsZXQgY3ZQbHVnaW4gPSBwbGF5ZXIuX2N2UGx1Z2luO1xuXG4gIGN2UGx1Z2luLnZhbGlkYXRlUGxheSgoZXJyb3IsIG9rKSA9PiB7XG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGVycm9yJywgZXJyb3IpO1xuICAgICAgY3ZQbHVnaW4uYmxvY2tQbGF5ZXIoJ2NhbnRwbGF5JywgZXJyb3IpO1xuXG4gICAgfSBlbHNlIHtcblxuICAgICAgY3ZQbHVnaW4ucmVjb3ZlclN0YXR1cyhvayk7XG4gICAgICAvLyBtb25pdG9yXG4gICAgICBjdlBsdWdpbi5tYWtlV2F0Y2hkb2cob2spO1xuICAgIH1cblxuICB9KTtcblxufTtcblxuLyoqXG4gKiBBIHZpZGVvLmpzIHBsdWdpbi5cbiAqXG4gKiBJbiB0aGUgcGx1Z2luIGZ1bmN0aW9uLCB0aGUgdmFsdWUgb2YgYHRoaXNgIGlzIGEgdmlkZW8uanMgYFBsYXllcmBcbiAqIGluc3RhbmNlLiBZb3UgY2Fubm90IHJlbHkgb24gdGhlIHBsYXllciBiZWluZyBpbiBhIFwicmVhZHlcIiBzdGF0ZSBoZXJlLFxuICogZGVwZW5kaW5nIG9uIGhvdyB0aGUgcGx1Z2luIGlzIGludm9rZWQuIFRoaXMgbWF5IG9yIG1heSBub3QgYmUgaW1wb3J0YW50XG4gKiB0byB5b3U7IGlmIG5vdCwgcmVtb3ZlIHRoZSB3YWl0IGZvciBcInJlYWR5XCIhXG4gKlxuICogQGZ1bmN0aW9uIGNvbmN1cnJlbmNlTGltaXRlclxuICogQHBhcmFtICAgIHtPYmplY3R9IFtvcHRpb25zPXt9XVxuICogICAgICAgICAgIEFuIG9iamVjdCBvZiBvcHRpb25zIGxlZnQgdG8gdGhlIHBsdWdpbiBhdXRob3IgdG8gZGVmaW5lLlxuICovXG5jb25zdCBjb25jdXJyZW5jZUxpbWl0ZXIgPSBmdW5jdGlvbih1c2Vyb3B0aW9ucykge1xuXG4gIHRoaXMucmVhZHkoKCkgPT4ge1xuXG4gICAgbGV0IG9wdGlvbnMgPSB2aWRlb2pzLm1lcmdlT3B0aW9ucyhkZWZhdWx0cywgdXNlcm9wdGlvbnMpO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldyBwbHVnaW4nLCBvcHRpb25zKTtcblxuICAgIGlmICghb3B0aW9ucy5hY2Nlc3N1cmwgfHwgIW9wdGlvbnMudXBkYXRldXJsIHx8ICFvcHRpb25zLmRpc3Bvc2V1cmwpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGludmFsaWQgdXJscycsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucy5pbnRlcnZhbCB8fCBvcHRpb25zLmludGVydmFsIDwgNSkge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogaW52YWxpZCBvcHRpb25zJywgb3B0aW9ucyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgb25QbGF5ZXJSZWFkeSh0aGlzLCBvcHRpb25zKTtcbiAgfSk7XG59O1xuXG4vLyBSZWdpc3RlciB0aGUgcGx1Z2luIHdpdGggdmlkZW8uanMuXG52aWRlb2pzLnBsdWdpbignY29uY3VycmVuY2VMaW1pdGVyJywgY29uY3VycmVuY2VMaW1pdGVyKTtcblxuLy8gSW5jbHVkZSB0aGUgdmVyc2lvbiBudW1iZXIuXG5jb25jdXJyZW5jZUxpbWl0ZXIuVkVSU0lPTiA9ICdfX1ZFUlNJT05fXyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNvbmN1cnJlbmNlTGltaXRlcjtcbiIsImltcG9ydCBkb2N1bWVudCBmcm9tICdnbG9iYWwvZG9jdW1lbnQnO1xuXG5pbXBvcnQgUVVuaXQgZnJvbSAncXVuaXQnO1xuaW1wb3J0IHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB2aWRlb2pzIGZyb20gJ3ZpZGVvLmpzJztcblxuaW1wb3J0IHBsdWdpbiBmcm9tICcuLi9zcmMvcGx1Z2luJztcblxuY29uc3QgUGxheWVyID0gdmlkZW9qcy5nZXRDb21wb25lbnQoJ1BsYXllcicpO1xuXG5RVW5pdC50ZXN0KCd0aGUgZW52aXJvbm1lbnQgaXMgc2FuZScsIGZ1bmN0aW9uKGFzc2VydCkge1xuICBhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIEFycmF5LmlzQXJyYXksICdmdW5jdGlvbicsICdlczUgZXhpc3RzJyk7XG4gIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2Ygc2lub24sICdvYmplY3QnLCAnc2lub24gZXhpc3RzJyk7XG4gIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgdmlkZW9qcywgJ2Z1bmN0aW9uJywgJ3ZpZGVvanMgZXhpc3RzJyk7XG4gIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgcGx1Z2luLCAnZnVuY3Rpb24nLCAncGx1Z2luIGlzIGEgZnVuY3Rpb24nKTtcbn0pO1xuXG5RVW5pdC5tb2R1bGUoJ3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlcicsIHtcblxuICBiZWZvcmVFYWNoKCkge1xuXG4gICAgLy8gTW9jayB0aGUgZW52aXJvbm1lbnQncyB0aW1lcnMgYmVjYXVzZSBjZXJ0YWluIHRoaW5ncyAtIHBhcnRpY3VsYXJseVxuICAgIC8vIHBsYXllciByZWFkaW5lc3MgLSBhcmUgYXN5bmNocm9ub3VzIGluIHZpZGVvLmpzIDUuIFRoaXMgTVVTVCBjb21lXG4gICAgLy8gYmVmb3JlIGFueSBwbGF5ZXIgaXMgY3JlYXRlZDsgb3RoZXJ3aXNlLCB0aW1lcnMgY291bGQgZ2V0IGNyZWF0ZWRcbiAgICAvLyB3aXRoIHRoZSBhY3R1YWwgdGltZXIgbWV0aG9kcyFcbiAgICB0aGlzLmNsb2NrID0gc2lub24udXNlRmFrZVRpbWVycygpO1xuXG4gICAgdGhpcy5maXh0dXJlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3F1bml0LWZpeHR1cmUnKTtcbiAgICB0aGlzLnZpZGVvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTtcbiAgICB0aGlzLmZpeHR1cmUuYXBwZW5kQ2hpbGQodGhpcy52aWRlbyk7XG4gICAgdGhpcy5wbGF5ZXIgPSB2aWRlb2pzKHRoaXMudmlkZW8pO1xuICB9LFxuXG4gIGFmdGVyRWFjaCgpIHtcbiAgICB0aGlzLnBsYXllci5kaXNwb3NlKCk7XG4gICAgdGhpcy5jbG9jay5yZXN0b3JlKCk7XG4gIH1cbn0pO1xuXG5RVW5pdC50ZXN0KCdyZWdpc3RlcnMgaXRzZWxmIHdpdGggdmlkZW8uanMnLCBmdW5jdGlvbihhc3NlcnQpIHtcbiAgYXNzZXJ0LmV4cGVjdCgyKTtcblxuICBhc3NlcnQuc3RyaWN0RXF1YWwoXG4gICAgUGxheWVyLnByb3RvdHlwZS5jb25jdXJyZW5jZUxpbWl0ZXIsXG4gICAgcGx1Z2luLFxuICAgICd2aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIgcGx1Z2luIHdhcyByZWdpc3RlcmVkJ1xuICApO1xuXG4gIHNpbm9uXG4gICAgLnN0dWIodmlkZW9qcywgJ3hocicpXG4gICAgLnlpZWxkcyhudWxsLCBudWxsLCBKU09OLnN0cmluZ2lmeSh7c3VjY2VzczogdHJ1ZX0pKTtcblxuICB0aGlzLnBsYXllci5jb25jdXJyZW5jZUxpbWl0ZXIoe1xuICAgIGFjY2Vzc3VybDogJy9saW1pdGVyL2NhbnBsYXknLFxuICAgIHVwZGF0ZXVybDogJy9saW1pdGVyL3BsYXlpbmcnLFxuICAgIGRpc3Bvc2V1cmw6ICcvbGltaXRlci9zdG9wJyxcbiAgICBzdGFydFBvc2l0aW9uOiAxMjNcbiAgfSk7XG5cbiAgLy8gVGljayB0aGUgY2xvY2sgZm9yd2FyZCBlbm91Z2ggdG8gdHJpZ2dlciB0aGUgcGxheWVyIHRvIGJlIFwicmVhZHlcIi5cbiAgdGhpcy5jbG9jay50aWNrKDEpO1xuXG4gIGFzc2VydC5vayhcbiAgICB0aGlzLnBsYXllci5oYXNDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKSxcbiAgICAndGhlIHBsdWdpbiBhZGRzIGEgY2xhc3MgdG8gdGhlIHBsYXllcidcbiAgKTtcbn0pO1xuIl19

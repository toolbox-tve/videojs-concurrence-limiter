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
 * main plugin component class
 */

var ConcurrentViewPlugin = (function () {
  function ConcurrentViewPlugin(options, player) {
    _classCallCheck(this, ConcurrentViewPlugin);

    this.options = options;
    this.player = player;
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
    playerID: Math.random().toString(32),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIi9ob21lL2ZyYW4vd29ya3NwYWNlL3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlci9zcmMvcGx1Z2luLmpzIiwiL2hvbWUvZnJhbi93b3Jrc3BhY2UvdmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyL3Rlc3QvcGx1Z2luLnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7O3VCQ2ZvQixVQUFVOzs7OztBQUc5QixJQUFNLFFBQVEsR0FBRztBQUNmLFVBQVEsRUFBRSxFQUFFO0FBQ1osV0FBUyxFQUFFLElBQUk7QUFDZixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLFVBQVEsRUFBRSxJQUFJO0FBQ2QsZUFBYSxFQUFFLENBQUM7Q0FDakIsQ0FBQzs7Ozs7O0lBS0ksb0JBQW9CO0FBRWIsV0FGUCxvQkFBb0IsQ0FFWixPQUFPLEVBQUUsTUFBTSxFQUFFOzBCQUZ6QixvQkFBb0I7O0FBR3RCLFFBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0FBQ3ZCLFFBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0dBQ3RCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2VBTEcsb0JBQW9COztXQWNiLHFCQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO0FBQ3pCLDJCQUFRLEdBQUcsQ0FDVDtBQUNFLFlBQUksRUFBRSxJQUFJLEdBQUcsSUFB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QUUsQ0FDUCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUMvQyx1Q0FBdUMsQ0FDeEMsQ0FBQztDQUNILENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIiLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwiaW1wb3J0IHZpZGVvanMgZnJvbSAndmlkZW8uanMnO1xuXG4vLyBEZWZhdWx0IG9wdGlvbnMgZm9yIHRoZSBwbHVnaW4uXG5jb25zdCBkZWZhdWx0cyA9IHtcbiAgaW50ZXJ2YWw6IDEwLFxuICBhY2Nlc3N1cmw6IG51bGwsXG4gIHVwZGF0ZXVybDogbnVsbCxcbiAgZGlzcG9zZXVybDogbnVsbCxcbiAgcGxheWVySUQ6IG51bGwsXG4gIHN0YXJ0UG9zaXRpb246IDBcbn07XG5cbi8qKlxuICogbWFpbiBwbHVnaW4gY29tcG9uZW50IGNsYXNzXG4gKi9cbmNsYXNzIENvbmN1cnJlbnRWaWV3UGx1Z2luIHtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zLCBwbGF5ZXIpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICB9XG5cbiAgLyoqXG4gICAqIHhociBhbGlhc1xuICAgKlxuICAgKiBAcGFyYW0gdXJsXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICBtYWtlUmVxdWVzdCh1cmwsIGRhdGEsIGNiKSB7XG4gICAgdmlkZW9qcy54aHIoXG4gICAgICB7XG4gICAgICAgIGJvZHk6IGRhdGEgPyBKU09OLnN0cmluZ2lmeShkYXRhKSA6ICd7fScsXG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAoZXJyLCByZXNwLCBib2R5KSA9PiB7XG5cbiAgICAgICAgbGV0IGJvZHlKc29uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYm9keUpzb24gPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHtlcnJvcjogJ2ludmFsaWQgYm9keScsIGJvZHl9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgYm9keUpzb24gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY2IoZXJyID8gZXJyLm1lc3NhZ2UgfHwgZXJyIDogbnVsbCwgYm9keUpzb24pO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogdmFsaWRhdGVzIHBsYXllciBhY2Nlc3NcbiAgICogQHBhcmFtIGNiXG4gICAgICovXG4gIHZhbGlkYXRlUGxheShjYikge1xuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgIHRoaXMub3B0aW9ucy5hY2Nlc3N1cmwsXG4gICAgICB7XG4gICAgICAgIHBsYXllcjogdGhpcy5vcHRpb25zLnBsYXllcklEXG4gICAgICB9LFxuICAgICAgKGVycm9yLCBvaykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBjYW5wbGF5IGFwaSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICBjYihuZXcgRXJyb3IoZXJyb3IpLCBudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2sgJiYgb2suc3VjY2Vzcykge1xuICAgICAgICAgIGNiKG51bGwsIG9rKTtcblxuICAgICAgICAgIHRoaXMucGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgICAgdHlwZTogJ2F2cGxheWVyY2FucGxheScsXG4gICAgICAgICAgICBjb2RlOiAxXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cbiAgfVxuXG4gIGJsb2NrUGxheWVyKGNvZGUsIGVycm9yLCByZWFzb24pIHtcbiAgICBjb2RlID0gY29kZSB8fCAnZXJyb3InO1xuICAgIHJlYXNvbiA9IHJlYXNvbiB8fCAnSGFzIGFsY2FuemFkbyBsYSBjYW50aWRhZCBtYXhpbWEgZGUgcGxheWVycyBhY3Rpdm9zLic7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBzdG9wIHBsYXllciAtICcsIHJlYXNvbik7XG5cbiAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgIHR5cGU6ICdhdnBsYXllcmJsb2tlZCcsXG4gICAgICBjb2RlLFxuICAgICAgcmVhc29uLFxuICAgICAgZXJyb3JcbiAgICB9KTtcblxuICAgIHRoaXMucGxheWVyLnBhdXNlKCk7XG4gICAgdGhpcy5wbGF5ZXIuZGlzcG9zZSgpO1xuICB9XG5cbiAgcmVjb3ZlclN0YXR1cyhpbmZvKSB7XG4gICAgaWYgKCFpbmZvLnBvc2l0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wbGF5ZXIuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uO1xuXG4gICAgdGhpcy5wbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gdGhpcy5jdXJyZW50VGltZSA9IGluZm8ucG9zaXRpb24pO1xuXG4gIH1cblxuICAvKiAqKioqKioqKioqKioqKiAqL1xuXG4gIG1ha2VXYXRjaGRvZyhvaykge1xuXG4gICAgbGV0IHdhdGNoZG9nID0gbnVsbDtcbiAgICBsZXQgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBsZXQgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG5cbiAgICBsZXQgbGFzVGltZSA9IG9wdGlvbnMuc3RhcnRQb3NpdGlvbiB8fCAwO1xuICAgIGxldCBwbGF5ZXJUb2tlbiA9IG51bGw7XG4gICAgbGV0IHBsYXllcklEID0gb3B0aW9ucy5wbGF5ZXJJRDtcbiAgICBsZXQgbG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcblxuICAgIHBsYXllci5vbignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiBsb2FkZWRtZXRhZGF0YSA9IHRydWUpO1xuXG4gICAgcGxheWVyLm9uKCd0aW1ldXBkYXRlJywgKGUpID0+IHtcblxuICAgICAgaWYgKCFsb2FkZWRtZXRhZGF0YSB8fCAhdGhpcy5maXN0U2VudCkge1xuICAgICAgICB0aGlzLmZpc3RTZW50ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsYXNUaW1lID0gTWF0aC5yb3VuZChwbGF5ZXIuY3VycmVudFRpbWUoKSB8fCAwKTtcbiAgICB9KTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZSBwbHVnaW46IG9rJywgb2spO1xuXG4gICAgbGV0IGNsZWFuVXAgPSAoKSA9PiB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBESVNQT1NFJywgb3B0aW9ucyk7XG5cbiAgICAgIGlmICh3YXRjaGRvZykge1xuICAgICAgICBwbGF5ZXIuY2xlYXJJbnRlcnZhbCh3YXRjaGRvZyk7XG4gICAgICAgIHdhdGNoZG9nID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLmRpc3Bvc2V1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgc3RhdHVzOiAncGF1c2VkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKCkgPT4ge31cbiAgICAgICAgKTtcblxuICAgICAgfVxuICAgIH07XG5cbiAgICBwbGF5ZXIub24oJ2Rpc3Bvc2UnLCBjbGVhblVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBjbGVhblVwKTtcblxuICAgIGlmICghd2F0Y2hkb2cpIHtcblxuICAgICAgbGV0IHdkZiA9ICgpID0+IHtcblxuICAgICAgICBwbGF5ZXIudHJpZ2dlcih7XG4gICAgICAgICAgdHlwZTogJ2F2cGxheWVydXBkYXRlJyxcbiAgICAgICAgICBwbGF5ZXJJRFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KFxuICAgICAgICAgIG9wdGlvbnMudXBkYXRldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICB0b2tlbjogcGxheWVyVG9rZW4sXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHN0YXR1czogcGxheWVyLnBhdXNlZCgpID8gJ3BhdXNlZCcgOiAncGxheWluZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIChlcnJvciwgcmVzcG9uc2UpID0+IHtcblxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IHVwZGF0ZSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnYXV0aGFwaWZhaWwnLCB7bXNnOiBlcnJvcn0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHBsYXllcklEID0gcmVzcG9uc2UucGxheWVyIHx8IHBsYXllcklEO1xuICAgICAgICAgICAgICBwbGF5ZXJUb2tlbiA9IHJlc3BvbnNlLnRva2VuIHx8IHBsYXllclRva2VuO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZyhuZXcgRXJyb3IoJ1BsYXllciBBdXRoIGVycm9yJyksIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgdGhpcy5ibG9ja1BsYXllcihwbGF5ZXIsICdub2F1dGgnLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcblxuICAgICAgd2F0Y2hkb2cgPSBwbGF5ZXIuc2V0SW50ZXJ2YWwod2RmLCBvcHRpb25zLmludGVydmFsICogMTAwMCk7XG4gICAgICB3ZGYoKTtcbiAgICB9XG5cbiAgfVxuXG59XG5cbi8qKlxuICogRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHBsYXllciBpcyByZWFkeS5cbiAqXG4gKiBUaGlzIGlzIGEgZ3JlYXQgcGxhY2UgZm9yIHlvdXIgcGx1Z2luIHRvIGluaXRpYWxpemUgaXRzZWxmLiBXaGVuIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHBsYXllciB3aWxsIGhhdmUgaXRzIERPTSBhbmQgY2hpbGQgY29tcG9uZW50c1xuICogaW4gcGxhY2UuXG4gKlxuICogQGZ1bmN0aW9uIG9uUGxheWVyUmVhZHlcbiAqIEBwYXJhbSAgICB7UGxheWVyfSBwbGF5ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqL1xuY29uc3Qgb25QbGF5ZXJSZWFkeSA9IChwbGF5ZXIsIG9wdGlvbnMpID0+IHtcbiAgcGxheWVyLmFkZENsYXNzKCd2anMtY29uY3VycmVuY2UtbGltaXRlcicpO1xuXG4gIHBsYXllci5fY3ZQbHVnaW4gPSBuZXcgQ29uY3VycmVudFZpZXdQbHVnaW4ob3B0aW9ucywgcGxheWVyKTtcbiAgbGV0IGN2UGx1Z2luID0gcGxheWVyLl9jdlBsdWdpbjtcblxuICBjdlBsdWdpbi52YWxpZGF0ZVBsYXkoKGVycm9yLCBvaykgPT4ge1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBlcnJvcicsIGVycm9yKTtcbiAgICAgIGN2UGx1Z2luLmJsb2NrUGxheWVyKCdjYW50cGxheScsIGVycm9yKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGN2UGx1Z2luLnJlY292ZXJTdGF0dXMob2spO1xuICAgICAgLy8gbW9uaXRvclxuICAgICAgY3ZQbHVnaW4ubWFrZVdhdGNoZG9nKG9rKTtcbiAgICB9XG5cbiAgfSk7XG5cbn07XG5cbi8qKlxuICogQSB2aWRlby5qcyBwbHVnaW4uXG4gKlxuICogSW4gdGhlIHBsdWdpbiBmdW5jdGlvbiwgdGhlIHZhbHVlIG9mIGB0aGlzYCBpcyBhIHZpZGVvLmpzIGBQbGF5ZXJgXG4gKiBpbnN0YW5jZS4gWW91IGNhbm5vdCByZWx5IG9uIHRoZSBwbGF5ZXIgYmVpbmcgaW4gYSBcInJlYWR5XCIgc3RhdGUgaGVyZSxcbiAqIGRlcGVuZGluZyBvbiBob3cgdGhlIHBsdWdpbiBpcyBpbnZva2VkLiBUaGlzIG1heSBvciBtYXkgbm90IGJlIGltcG9ydGFudFxuICogdG8geW91OyBpZiBub3QsIHJlbW92ZSB0aGUgd2FpdCBmb3IgXCJyZWFkeVwiIVxuICpcbiAqIEBmdW5jdGlvbiBjb25jdXJyZW5jZUxpbWl0ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqICAgICAgICAgICBBbiBvYmplY3Qgb2Ygb3B0aW9ucyBsZWZ0IHRvIHRoZSBwbHVnaW4gYXV0aG9yIHRvIGRlZmluZS5cbiAqL1xuY29uc3QgY29uY3VycmVuY2VMaW1pdGVyID0gZnVuY3Rpb24odXNlcm9wdGlvbnMpIHtcblxuICB0aGlzLnJlYWR5KCgpID0+IHtcblxuICAgIGxldCBvcHRpb25zID0gdmlkZW9qcy5tZXJnZU9wdGlvbnMoZGVmYXVsdHMsIHVzZXJvcHRpb25zKTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXcgcGx1Z2luJywgb3B0aW9ucyk7XG5cbiAgICBpZiAoIW9wdGlvbnMuYWNjZXNzdXJsIHx8ICFvcHRpb25zLnVwZGF0ZXVybCB8fCAhb3B0aW9ucy5kaXNwb3NldXJsKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIHVybHMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuaW50ZXJ2YWwgfHwgb3B0aW9ucy5pbnRlcnZhbCA8IDUpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGludmFsaWQgb3B0aW9ucycsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9uUGxheWVyUmVhZHkodGhpcywgb3B0aW9ucyk7XG4gIH0pO1xufTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBsdWdpbiB3aXRoIHZpZGVvLmpzLlxudmlkZW9qcy5wbHVnaW4oJ2NvbmN1cnJlbmNlTGltaXRlcicsIGNvbmN1cnJlbmNlTGltaXRlcik7XG5cbi8vIEluY2x1ZGUgdGhlIHZlcnNpb24gbnVtYmVyLlxuY29uY3VycmVuY2VMaW1pdGVyLlZFUlNJT04gPSAnX19WRVJTSU9OX18nO1xuXG5leHBvcnQgZGVmYXVsdCBjb25jdXJyZW5jZUxpbWl0ZXI7XG4iLCJpbXBvcnQgZG9jdW1lbnQgZnJvbSAnZ2xvYmFsL2RvY3VtZW50JztcblxuaW1wb3J0IFFVbml0IGZyb20gJ3F1bml0JztcbmltcG9ydCBzaW5vbiBmcm9tICdzaW5vbic7XG5pbXBvcnQgdmlkZW9qcyBmcm9tICd2aWRlby5qcyc7XG5cbmltcG9ydCBwbHVnaW4gZnJvbSAnLi4vc3JjL3BsdWdpbic7XG5cbmNvbnN0IFBsYXllciA9IHZpZGVvanMuZ2V0Q29tcG9uZW50KCdQbGF5ZXInKTtcblxuUVVuaXQudGVzdCgndGhlIGVudmlyb25tZW50IGlzIHNhbmUnLCBmdW5jdGlvbihhc3NlcnQpIHtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBBcnJheS5pc0FycmF5LCAnZnVuY3Rpb24nLCAnZXM1IGV4aXN0cycpO1xuICBhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIHNpbm9uLCAnb2JqZWN0JywgJ3Npbm9uIGV4aXN0cycpO1xuICBhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIHZpZGVvanMsICdmdW5jdGlvbicsICd2aWRlb2pzIGV4aXN0cycpO1xuICBhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIHBsdWdpbiwgJ2Z1bmN0aW9uJywgJ3BsdWdpbiBpcyBhIGZ1bmN0aW9uJyk7XG59KTtcblxuUVVuaXQubW9kdWxlKCd2aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXInLCB7XG5cbiAgYmVmb3JlRWFjaCgpIHtcblxuICAgIC8vIE1vY2sgdGhlIGVudmlyb25tZW50J3MgdGltZXJzIGJlY2F1c2UgY2VydGFpbiB0aGluZ3MgLSBwYXJ0aWN1bGFybHlcbiAgICAvLyBwbGF5ZXIgcmVhZGluZXNzIC0gYXJlIGFzeW5jaHJvbm91cyBpbiB2aWRlby5qcyA1LiBUaGlzIE1VU1QgY29tZVxuICAgIC8vIGJlZm9yZSBhbnkgcGxheWVyIGlzIGNyZWF0ZWQ7IG90aGVyd2lzZSwgdGltZXJzIGNvdWxkIGdldCBjcmVhdGVkXG4gICAgLy8gd2l0aCB0aGUgYWN0dWFsIHRpbWVyIG1ldGhvZHMhXG4gICAgdGhpcy5jbG9jayA9IHNpbm9uLnVzZUZha2VUaW1lcnMoKTtcblxuICAgIHRoaXMuZml4dHVyZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdxdW5pdC1maXh0dXJlJyk7XG4gICAgdGhpcy52aWRlbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3ZpZGVvJyk7XG4gICAgdGhpcy5maXh0dXJlLmFwcGVuZENoaWxkKHRoaXMudmlkZW8pO1xuICAgIHRoaXMucGxheWVyID0gdmlkZW9qcyh0aGlzLnZpZGVvKTtcbiAgfSxcblxuICBhZnRlckVhY2goKSB7XG4gICAgdGhpcy5wbGF5ZXIuZGlzcG9zZSgpO1xuICAgIHRoaXMuY2xvY2sucmVzdG9yZSgpO1xuICB9XG59KTtcblxuUVVuaXQudGVzdCgncmVnaXN0ZXJzIGl0c2VsZiB3aXRoIHZpZGVvLmpzJywgZnVuY3Rpb24oYXNzZXJ0KSB7XG4gIGFzc2VydC5leHBlY3QoMik7XG5cbiAgYXNzZXJ0LnN0cmljdEVxdWFsKFxuICAgIFBsYXllci5wcm90b3R5cGUuY29uY3VycmVuY2VMaW1pdGVyLFxuICAgIHBsdWdpbixcbiAgICAndmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyIHBsdWdpbiB3YXMgcmVnaXN0ZXJlZCdcbiAgKTtcblxuICB0aGlzLnBsYXllci5jb25jdXJyZW5jZUxpbWl0ZXIoe1xuICAgIHBsYXllcklEOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDMyKSxcbiAgICBhY2Nlc3N1cmw6ICcvbGltaXRlci9jYW5wbGF5JyxcbiAgICB1cGRhdGV1cmw6ICcvbGltaXRlci9wbGF5aW5nJyxcbiAgICBkaXNwb3NldXJsOiAnL2xpbWl0ZXIvc3RvcCcsXG4gICAgc3RhcnRQb3NpdGlvbjogMTIzXG4gIH0pO1xuXG4gIC8vIFRpY2sgdGhlIGNsb2NrIGZvcndhcmQgZW5vdWdoIHRvIHRyaWdnZXIgdGhlIHBsYXllciB0byBiZSBcInJlYWR5XCIuXG4gIHRoaXMuY2xvY2sudGljaygxKTtcblxuICBhc3NlcnQub2soXG4gICAgdGhpcy5wbGF5ZXIuaGFzQ2xhc3MoJ3Zqcy1jb25jdXJyZW5jZS1saW1pdGVyJyksXG4gICAgJ3RoZSBwbHVnaW4gYWRkcyBhIGNsYXNzIHRvIHRoZSBwbGF5ZXInXG4gICk7XG59KTtcbiJdfQ==

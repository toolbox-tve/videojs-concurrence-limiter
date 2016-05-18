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

  this.player.concurrenceLimiter();

  // Tick the clock forward enough to trigger the player to be "ready".
  this.clock.tick(1);

  assert.ok(this.player.hasClass('vjs-concurrence-limiter'), 'the plugin adds a class to the player');
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../src/plugin":3,"global/document":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1yZXNvbHZlL2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL2dsb2JhbC9kb2N1bWVudC5qcyIsIi9ob21lL2ZyYW4vd29ya3NwYWNlL3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlci9zcmMvcGx1Z2luLmpzIiwiL2hvbWUvZnJhbi93b3Jrc3BhY2UvdmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyL3Rlc3QvcGx1Z2luLnRlc3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7O3VCQ2ZvQixVQUFVOzs7OztBQUc5QixJQUFNLFFBQVEsR0FBRztBQUNmLFVBQVEsRUFBRSxFQUFFO0FBQ1osV0FBUyxFQUFFLElBQUk7QUFDZixXQUFTLEVBQUUsSUFBSTtBQUNmLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLFVBQVEsRUFBRSxJQUFJO0FBQ2QsZUFBYSxFQUFFLENBQUM7Q0FDakIsQ0FBQzs7Ozs7O0lBS0ksb0JBQW9CO0FBRWIsV0FGUCxvQkFBb0IsQ0FFWixPQUFPLEVBQUUsTUFBTSxFQUFFOzBCQUZ6QixvQkFBb0I7O0FBR3RCLFFBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0FBQ3ZCLFFBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0dBQ3RCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O2VBTEcsb0JBQW9COztXQWNiLHFCQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO0FBQ3pCLDJCQUFRLEdBQUcsQ0FDVDtBQUNFLFlBQUksRUFBRSxJQUFJLEdBQUcsSUFB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LDZCQUE2QixFQUFFOztBQUUxQyxZQUFVLEVBQUEsc0JBQUc7Ozs7OztBQU1YLFFBQUksQ0FBQyxLQUFLLEdBQUcsbUJBQU0sYUFBYSxFQUFFLENBQUM7O0FBRW5DLFFBQUksQ0FBQyxPQUFPLEdBQUcsNEJBQVMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQ3hELFFBQUksQ0FBQyxLQUFLLEdBQUcsNEJBQVMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQzdDLFFBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyQyxRQUFJLENBQUMsTUFBTSxHQUFHLDBCQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztHQUNuQzs7QUFFRCxXQUFTLEVBQUEscUJBQUc7QUFDVixRQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3RCLFFBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7R0FDdEI7Q0FDRixDQUFDLENBQUM7O0FBRUgsbUJBQU0sSUFBSSxDQUFDLGdDQUFnQyxFQUFFLFVBQVMsTUFBTSxFQUFFO0FBQzVELFFBQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRWpCLFFBQU0sQ0FBQyxXQUFXLENBQ2hCLE1BQU0sQ0FBQyxTQUFTLENBQUMsa0JBQWtCLDBCQUVuQyxtREFBbUQsQ0FDcEQsQ0FBQzs7QUFFRixNQUFJLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFFLENBQUM7OztBQUdqQyxNQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFFbkIsUUFBTSxDQUFDLEVBQUUsQ0FDUCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUMvQyx1Q0FBdUMsQ0FDeEMsQ0FBQztDQUNILENBQUMsQ0FBQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIiLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwiaW1wb3J0IHZpZGVvanMgZnJvbSAndmlkZW8uanMnO1xuXG4vLyBEZWZhdWx0IG9wdGlvbnMgZm9yIHRoZSBwbHVnaW4uXG5jb25zdCBkZWZhdWx0cyA9IHtcbiAgaW50ZXJ2YWw6IDEwLFxuICBhY2Nlc3N1cmw6IG51bGwsXG4gIHVwZGF0ZXVybDogbnVsbCxcbiAgZGlzcG9zZXVybDogbnVsbCxcbiAgcGxheWVySUQ6IG51bGwsXG4gIHN0YXJ0UG9zaXRpb246IDBcbn07XG5cbi8qKlxuICogbWFpbiBwbHVnaW4gY29tcG9uZW50IGNsYXNzXG4gKi9cbmNsYXNzIENvbmN1cnJlbnRWaWV3UGx1Z2luIHtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zLCBwbGF5ZXIpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuICB9XG5cbiAgLyoqXG4gICAqIHhociBhbGlhc1xuICAgKlxuICAgKiBAcGFyYW0gdXJsXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICBtYWtlUmVxdWVzdCh1cmwsIGRhdGEsIGNiKSB7XG4gICAgdmlkZW9qcy54aHIoXG4gICAgICB7XG4gICAgICAgIGJvZHk6IGRhdGEgPyBKU09OLnN0cmluZ2lmeShkYXRhKSA6ICd7fScsXG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAoZXJyLCByZXNwLCBib2R5KSA9PiB7XG5cbiAgICAgICAgbGV0IGJvZHlKc29uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYm9keUpzb24gPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHtlcnJvcjogJ2ludmFsaWQgYm9keScsIGJvZHl9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgYm9keUpzb24gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY2IoZXJyID8gZXJyLm1lc3NhZ2UgfHwgZXJyIDogbnVsbCwgYm9keUpzb24pO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICB2YWxpZGF0ZVBsYXkoY2IpIHtcblxuICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICB0aGlzLm9wdGlvbnMuYWNjZXNzdXJsLFxuICAgICAge1xuICAgICAgICBwbGF5ZXI6IHRoaXMub3B0aW9ucy5wbGF5ZXJJRFxuICAgICAgfSxcbiAgICAgIChlcnJvciwgb2spID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogY2FucGxheSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgY2IobmV3IEVycm9yKGVycm9yKSwgbnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9rICYmIG9rLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBjYihudWxsLCBvayk7XG5cbiAgICAgICAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgICAgICAgIHR5cGU6ICdhdnBsYXllcmNhbnBsYXknLFxuICAgICAgICAgICAgY29kZTogMVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKG5ldyBFcnJvcignUGxheWVyIEF1dGggZXJyb3InKSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gIH1cblxuICBibG9ja1BsYXllcihjb2RlLCBlcnJvciwgcmVhc29uKSB7XG4gICAgY29kZSA9IGNvZGUgfHwgJ2Vycm9yJztcbiAgICByZWFzb24gPSByZWFzb24gfHwgJ0hhcyBhbGNhbnphZG8gbGEgY2FudGlkYWQgbWF4aW1hIGRlIHBsYXllcnMgYWN0aXZvcy4nO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogc3RvcCBwbGF5ZXIgLSAnLCByZWFzb24pO1xuXG4gICAgdGhpcy5wbGF5ZXIudHJpZ2dlcih7XG4gICAgICB0eXBlOiAnYXZwbGF5ZXJibG9rZWQnLFxuICAgICAgY29kZSxcbiAgICAgIHJlYXNvbixcbiAgICAgIGVycm9yXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgfVxuXG4gIHJlY292ZXJTdGF0dXMoaW5mbykge1xuICAgIGlmICghaW5mby5wb3NpdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGxheWVyLmN1cnJlbnRUaW1lID0gaW5mby5wb3NpdGlvbjtcblxuICAgIHRoaXMucGxheWVyLm9uKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHRoaXMuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uKTtcblxuICB9XG5cbiAgLyogKioqKioqKioqKioqKiogKi9cblxuICBtYWtlV2F0Y2hkb2cob2spIHtcblxuICAgIGxldCB3YXRjaGRvZyA9IG51bGw7XG4gICAgbGV0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgbGV0IHBsYXllciA9IHRoaXMucGxheWVyO1xuXG4gICAgbGV0IGxhc1RpbWUgPSBvcHRpb25zLnN0YXJ0UG9zaXRpb24gfHwgMDtcbiAgICBsZXQgcGxheWVyVG9rZW4gPSBudWxsO1xuICAgIGxldCBwbGF5ZXJJRCA9IG9wdGlvbnMucGxheWVySUQ7XG4gICAgbGV0IGxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG5cbiAgICBwbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gbG9hZGVkbWV0YWRhdGEgPSB0cnVlKTtcblxuICAgIHBsYXllci5vbigndGltZXVwZGF0ZScsIChlKSA9PiB7XG5cbiAgICAgIGlmICghbG9hZGVkbWV0YWRhdGEgfHwgIXRoaXMuZmlzdFNlbnQpIHtcbiAgICAgICAgdGhpcy5maXN0U2VudCA9IHRydWU7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGFzVGltZSA9IE1hdGgucm91bmQocGxheWVyLmN1cnJlbnRUaW1lKCkgfHwgMCk7XG4gICAgfSk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2UgcGx1Z2luOiBvaycsIG9rKTtcblxuICAgIGxldCBjbGVhblVwID0gKCkgPT4ge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogRElTUE9TRScsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAod2F0Y2hkb2cpIHtcbiAgICAgICAgcGxheWVyLmNsZWFySW50ZXJ2YWwod2F0Y2hkb2cpO1xuICAgICAgICB3YXRjaGRvZyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy5kaXNwb3NldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHN0YXR1czogJ3BhdXNlZCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHt9XG4gICAgICAgICk7XG5cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcGxheWVyLm9uKCdkaXNwb3NlJywgY2xlYW5VcCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgY2xlYW5VcCk7XG5cbiAgICBpZiAoIXdhdGNoZG9nKSB7XG5cbiAgICAgIGxldCB3ZGYgPSAoKSA9PiB7XG5cbiAgICAgICAgcGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgIHR5cGU6ICdhdnBsYXllcnVwZGF0ZScsXG4gICAgICAgICAgcGxheWVySURcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLnVwZGF0ZXVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwbGF5ZXI6IHBsYXllcklELFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgcG9zaXRpb246IGxhc1RpbWUsXG4gICAgICAgICAgICBzdGF0dXM6IHBsYXllci5wYXVzZWQoKSA/ICdwYXVzZWQnIDogJ3BsYXlpbmcnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoZXJyb3IsIHJlc3BvbnNlKSA9PiB7XG5cbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiB1cGRhdGUgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICB0aGlzLmJsb2NrUGxheWVyKHBsYXllciwgJ2F1dGhhcGlmYWlsJywge21zZzogZXJyb3J9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICAgICAgICBwbGF5ZXJJRCA9IHJlc3BvbnNlLnBsYXllciB8fCBwbGF5ZXJJRDtcbiAgICAgICAgICAgICAgcGxheWVyVG9rZW4gPSByZXNwb25zZS50b2tlbiB8fCBwbGF5ZXJUb2tlbjtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmlkZW9qcy5sb2cobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnbm9hdXRoJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG5cbiAgICAgIHdhdGNoZG9nID0gcGxheWVyLnNldEludGVydmFsKHdkZiwgb3B0aW9ucy5pbnRlcnZhbCAqIDEwMDApO1xuICAgICAgd2RmKCk7XG4gICAgfVxuXG4gIH1cblxufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBwbGF5ZXIgaXMgcmVhZHkuXG4gKlxuICogVGhpcyBpcyBhIGdyZWF0IHBsYWNlIGZvciB5b3VyIHBsdWdpbiB0byBpbml0aWFsaXplIGl0c2VsZi4gV2hlbiB0aGlzXG4gKiBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSBwbGF5ZXIgd2lsbCBoYXZlIGl0cyBET00gYW5kIGNoaWxkIGNvbXBvbmVudHNcbiAqIGluIHBsYWNlLlxuICpcbiAqIEBmdW5jdGlvbiBvblBsYXllclJlYWR5XG4gKiBAcGFyYW0gICAge1BsYXllcn0gcGxheWVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKi9cbmNvbnN0IG9uUGxheWVyUmVhZHkgPSAocGxheWVyLCBvcHRpb25zKSA9PiB7XG4gIHBsYXllci5hZGRDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKTtcblxuICBwbGF5ZXIuX2N2UGx1Z2luID0gbmV3IENvbmN1cnJlbnRWaWV3UGx1Z2luKG9wdGlvbnMsIHBsYXllcik7XG4gIGxldCBjdlBsdWdpbiA9IHBsYXllci5fY3ZQbHVnaW47XG5cbiAgY3ZQbHVnaW4udmFsaWRhdGVQbGF5KChlcnJvciwgb2spID0+IHtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogZXJyb3InLCBlcnJvcik7XG4gICAgICBjdlBsdWdpbi5ibG9ja1BsYXllcignY2FudHBsYXknLCBlcnJvcik7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICBjdlBsdWdpbi5yZWNvdmVyU3RhdHVzKG9rKTtcbiAgICAgIC8vIG1vbml0b3JcbiAgICAgIGN2UGx1Z2luLm1ha2VXYXRjaGRvZyhvayk7XG4gICAgfVxuXG4gIH0pO1xuXG59O1xuXG4vKipcbiAqIEEgdmlkZW8uanMgcGx1Z2luLlxuICpcbiAqIEluIHRoZSBwbHVnaW4gZnVuY3Rpb24sIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaXMgYSB2aWRlby5qcyBgUGxheWVyYFxuICogaW5zdGFuY2UuIFlvdSBjYW5ub3QgcmVseSBvbiB0aGUgcGxheWVyIGJlaW5nIGluIGEgXCJyZWFkeVwiIHN0YXRlIGhlcmUsXG4gKiBkZXBlbmRpbmcgb24gaG93IHRoZSBwbHVnaW4gaXMgaW52b2tlZC4gVGhpcyBtYXkgb3IgbWF5IG5vdCBiZSBpbXBvcnRhbnRcbiAqIHRvIHlvdTsgaWYgbm90LCByZW1vdmUgdGhlIHdhaXQgZm9yIFwicmVhZHlcIiFcbiAqXG4gKiBAZnVuY3Rpb24gY29uY3VycmVuY2VMaW1pdGVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKiAgICAgICAgICAgQW4gb2JqZWN0IG9mIG9wdGlvbnMgbGVmdCB0byB0aGUgcGx1Z2luIGF1dGhvciB0byBkZWZpbmUuXG4gKi9cbmNvbnN0IGNvbmN1cnJlbmNlTGltaXRlciA9IGZ1bmN0aW9uKHVzZXJvcHRpb25zKSB7XG5cbiAgdGhpcy5yZWFkeSgoKSA9PiB7XG5cbiAgICBsZXQgb3B0aW9ucyA9IHZpZGVvanMubWVyZ2VPcHRpb25zKGRlZmF1bHRzLCB1c2Vyb3B0aW9ucyk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3IHBsdWdpbicsIG9wdGlvbnMpO1xuXG4gICAgaWYgKCFvcHRpb25zLmFjY2Vzc3VybCB8fCAhb3B0aW9ucy51cGRhdGV1cmwgfHwgIW9wdGlvbnMuZGlzcG9zZXVybCkge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogaW52YWxpZCB1cmxzJywgb3B0aW9ucyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLmludGVydmFsIHx8IG9wdGlvbnMuaW50ZXJ2YWwgPCA1KSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIG9wdGlvbnMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvblBsYXllclJlYWR5KHRoaXMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIFJlZ2lzdGVyIHRoZSBwbHVnaW4gd2l0aCB2aWRlby5qcy5cbnZpZGVvanMucGx1Z2luKCdjb25jdXJyZW5jZUxpbWl0ZXInLCBjb25jdXJyZW5jZUxpbWl0ZXIpO1xuXG4vLyBJbmNsdWRlIHRoZSB2ZXJzaW9uIG51bWJlci5cbmNvbmN1cnJlbmNlTGltaXRlci5WRVJTSU9OID0gJ19fVkVSU0lPTl9fJztcblxuZXhwb3J0IGRlZmF1bHQgY29uY3VycmVuY2VMaW1pdGVyO1xuIiwiaW1wb3J0IGRvY3VtZW50IGZyb20gJ2dsb2JhbC9kb2N1bWVudCc7XG5cbmltcG9ydCBRVW5pdCBmcm9tICdxdW5pdCc7XG5pbXBvcnQgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHZpZGVvanMgZnJvbSAndmlkZW8uanMnO1xuXG5pbXBvcnQgcGx1Z2luIGZyb20gJy4uL3NyYy9wbHVnaW4nO1xuXG5jb25zdCBQbGF5ZXIgPSB2aWRlb2pzLmdldENvbXBvbmVudCgnUGxheWVyJyk7XG5cblFVbml0LnRlc3QoJ3RoZSBlbnZpcm9ubWVudCBpcyBzYW5lJywgZnVuY3Rpb24oYXNzZXJ0KSB7XG4gIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgQXJyYXkuaXNBcnJheSwgJ2Z1bmN0aW9uJywgJ2VzNSBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBzaW5vbiwgJ29iamVjdCcsICdzaW5vbiBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiB2aWRlb2pzLCAnZnVuY3Rpb24nLCAndmlkZW9qcyBleGlzdHMnKTtcbiAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBwbHVnaW4sICdmdW5jdGlvbicsICdwbHVnaW4gaXMgYSBmdW5jdGlvbicpO1xufSk7XG5cblFVbml0Lm1vZHVsZSgndmlkZW9qcy1jb25jdXJyZW5jZS1saW1pdGVyJywge1xuXG4gIGJlZm9yZUVhY2goKSB7XG5cbiAgICAvLyBNb2NrIHRoZSBlbnZpcm9ubWVudCdzIHRpbWVycyBiZWNhdXNlIGNlcnRhaW4gdGhpbmdzIC0gcGFydGljdWxhcmx5XG4gICAgLy8gcGxheWVyIHJlYWRpbmVzcyAtIGFyZSBhc3luY2hyb25vdXMgaW4gdmlkZW8uanMgNS4gVGhpcyBNVVNUIGNvbWVcbiAgICAvLyBiZWZvcmUgYW55IHBsYXllciBpcyBjcmVhdGVkOyBvdGhlcndpc2UsIHRpbWVycyBjb3VsZCBnZXQgY3JlYXRlZFxuICAgIC8vIHdpdGggdGhlIGFjdHVhbCB0aW1lciBtZXRob2RzIVxuICAgIHRoaXMuY2xvY2sgPSBzaW5vbi51c2VGYWtlVGltZXJzKCk7XG5cbiAgICB0aGlzLmZpeHR1cmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncXVuaXQtZml4dHVyZScpO1xuICAgIHRoaXMudmlkZW8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd2aWRlbycpO1xuICAgIHRoaXMuZml4dHVyZS5hcHBlbmRDaGlsZCh0aGlzLnZpZGVvKTtcbiAgICB0aGlzLnBsYXllciA9IHZpZGVvanModGhpcy52aWRlbyk7XG4gIH0sXG5cbiAgYWZ0ZXJFYWNoKCkge1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgICB0aGlzLmNsb2NrLnJlc3RvcmUoKTtcbiAgfVxufSk7XG5cblFVbml0LnRlc3QoJ3JlZ2lzdGVycyBpdHNlbGYgd2l0aCB2aWRlby5qcycsIGZ1bmN0aW9uKGFzc2VydCkge1xuICBhc3NlcnQuZXhwZWN0KDIpO1xuXG4gIGFzc2VydC5zdHJpY3RFcXVhbChcbiAgICBQbGF5ZXIucHJvdG90eXBlLmNvbmN1cnJlbmNlTGltaXRlcixcbiAgICBwbHVnaW4sXG4gICAgJ3ZpZGVvanMtY29uY3VycmVuY2UtbGltaXRlciBwbHVnaW4gd2FzIHJlZ2lzdGVyZWQnXG4gICk7XG5cbiAgdGhpcy5wbGF5ZXIuY29uY3VycmVuY2VMaW1pdGVyKCk7XG5cbiAgLy8gVGljayB0aGUgY2xvY2sgZm9yd2FyZCBlbm91Z2ggdG8gdHJpZ2dlciB0aGUgcGxheWVyIHRvIGJlIFwicmVhZHlcIi5cbiAgdGhpcy5jbG9jay50aWNrKDEpO1xuXG4gIGFzc2VydC5vayhcbiAgICB0aGlzLnBsYXllci5oYXNDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKSxcbiAgICAndGhlIHBsdWdpbiBhZGRzIGEgY2xhc3MgdG8gdGhlIHBsYXllcidcbiAgKTtcbn0pO1xuIl19

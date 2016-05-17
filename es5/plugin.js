'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _videoJs = require('video.js');

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
    this.watchdog = null;
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
        cb(err ? err.message || err : null, body ? JSON.parse(body) : null);
      });
    }
  }, {
    key: 'validatePlay',
    value: function validatePlay(cb) {

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

          this.player.trigger({
            type: 'avplayercanplay',
            code: 1
          });
        } else {
          cb(new Error('Player Auth error'), null);
        }
      });
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
      cvPlugin.blockPlayer(player, 'cantplay', error);
    } else {

      cvPlugin.recoverStatus(ok, player);
      //monitor
      cvPlugin.makeWatchdog(options, player, ok);
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

  _videoJs2['default'].log('concurrenceview plugin', options);

  if (!options.accessurl || !options.updateurl || !options.disposeurl) {
    _videoJs2['default'].log('concurrenceview: invalid urls', options);
    return;
  }

  if (!options.interval || options.interval < 5) {
    _videoJs2['default'].log('concurrenceview: invalid options', options);
    return;
  }

  if (!$) {
    _videoJs2['default'].log('concurrenceview: invalid jquery', options);
    return;
  }

  this.ready(function () {
    onPlayerReady(_this, options);
  });
};

// Register the plugin with video.js.
_videoJs2['default'].plugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '0.1.3';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];
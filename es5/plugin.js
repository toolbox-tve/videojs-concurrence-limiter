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

var _videoJs = require('video.js');

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
concurrenceLimiter.VERSION = '__VERSION__';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];
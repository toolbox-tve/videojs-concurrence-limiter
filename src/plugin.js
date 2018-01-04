'use strict';
/**
 * videojs-concurrence-limiter
 * Plugin loader
 *
 * @file plugin.js
 * @module concurrenceLimiterPlugin
 **/
import videojs from 'video.js';
import ConcurrentViewPlugin from './ConcurrentView';
import { log, validateRequiredOpts } from './utils';

// Default options for the plugin.
const defaults = {
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
const onPlayerReady = (player, options) => {

  player.addClass('vjs-concurrence-limiter');

  player._cvPlugin = new ConcurrentViewPlugin(options, player);
  let cvPlugin = player._cvPlugin;

  // Hook into player events after player is ready to avoid missing first triggered events
  cvPlugin.hookPlayerEvents();

  cvPlugin.validatePlay((error, ok) => {

    if (error) {
      log(' error', error);
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
const concurrenceLimiter = function(useroptions) {
  let options = videojs.mergeOptions(defaults, useroptions);

  if (!validateRequiredOpts(options)) {
    return;
  }

  this.ready(() => {

    if (!options.playerID) {
      // If playerID option isn't provided try to get it from player instance:
      options.playerID = this.playerID || this.id_;
    }

    onPlayerReady(this, options);
  });
};

// Register the plugin with video.js.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
registerPlugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '__VERSION__';

export default concurrenceLimiter;

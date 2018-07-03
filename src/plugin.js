import videojs from 'video.js';
import {version as VERSION} from '../package.json';

const Plugin = videojs.getPlugin('plugin');

// Default options for the plugin.
const defaults = {
  interval: 10,
  access: {
    url: null,
    retry: 0
  },
  update: {
    url: null,
    retry: 3
  },
  dispose: {
    url: null,
    retry: 0
  },
  playerId: null,
  requestOptions: {
    timeout: 15,
    headers: {}
  }
};

/**
 * An advanced Video.js plugin. For more information on the API
 *
 * See: https://blog.videojs.com/feature-spotlight-advanced-plugins/
 */
class ConcurrenceLimiter extends Plugin {

  /**
   * Create a ConcurrenceLimiter plugin instance.
   *
   * @param  {Player} player
   *         A Video.js Player instance.
   *
   * @param  {Object} [options]
   *         An optional options object.
   *
   *         While not a core part of the Video.js plugin architecture, a
   *         second argument of options is a convenient way to accept inputs
   *         from your plugin's caller.
   */
  constructor(player, options) {
    // the parent class will add player under this.player
    super(player);
    this.options = videojs.mergeOptions(defaults, options);

    this.player.ready(() => {
      this.player.addClass('vjs-concurrence-limiter');
    });
  }

  makeRequest(url, options, retry) {
    const controller = new AbortController();
    let timeoutId = null;

    // Avoid conflicts
    if (this.pendingRequest) {
      return;
    }

    options.signal = controller.signal;
    this.pendingRequest = true;
    timeoutId = setTimeout(() => controller.abort(), options.timeout * 1000);

    fetch(url, options)
      .then(res => {
        clearTimeout(timeoutId);
        if (res.ok) {
          this.pendingRequest = false;
          return res.json();
        }
        throw new Error('Response error');
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (retry > 0) {
          this.pendingRequest = false;
          this.makeRequest(url, options, retry - 1);
        } else {
          // TODO: erase player
        }
      });
  }

  validatePlay() {
    const access = this.options.access;

    this.makeRequest(access.url, this.options.requestOptions, access.retry)
      .then(res => {
        // TODO: call
        this.intervalId = setInterval(this.update, this.options.interval * 1000);
      });
  }

  update() {
    const update = this.options.update;

    this.makeRequest(update.url, this.options.requestOptions, update.retry);
  }
}

// Define default values for the plugin's `state` object here.
ConcurrenceLimiter.defaultState = {};

// Include the version number.
ConcurrenceLimiter.VERSION = VERSION;

// Register the plugin with video.js.
videojs.registerPlugin('concurrenceLimiter', ConcurrenceLimiter);

export default ConcurrenceLimiter;

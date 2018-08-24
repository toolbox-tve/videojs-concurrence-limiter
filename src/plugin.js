import videojs from 'video.js';
import {version as VERSION} from '../package.json';
import CustomError, {ErrorCodes} from './ErrorHandler/CustomError';

const Plugin = videojs.getPlugin('plugin');

// Default options for the plugin.
const defaults = {
  interval: 10,
  access: {
    url: 'http://localhost:55555/canplay',
    retry: 0
  },
  update: {
    url: 'http://localhost:55555/nowplaying',
    retry: 1
  },
  stop: {
    url: 'http://localhost:55555/stop',
    retry: 0
  },
  playerId: 'ssi-b7ture9aj',
  request: {
    method: 'POST',
    timeout: 15,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJUb29sYm94IERpZ2l0YWwgU0EiLCJhdWQiOiJ1bml0eS1kZXYudGJ4YXBpcy5jb20iLCJpYXQiOjE1MzA3MzA4MzksImV4cCI6MTUzMDkwMzYzOSwiY291bnRyeSI6IkFSIiwibGFuZ3VhZ2UiOiJlbiIsImNsaWVudCI6IjE4MGRmZjBhZDBlZjRlMTJkZDJjZGIyOWU0NzM2MDY4IiwiZGV2aWNlIjoiOGU5MGJmNDAwNTA2MDBlNDczYmQ2OTY2ZGIxMzIwMDNmZTMwZDdlMCIsImluZGV4IjoiNTc1MTllNDJiY2FlYWVjMTJkNjI0NTUxIiwiY3VzdG9tZXIiOiI1N2YyYTVhZjBmODcyOTg1N2VlMDUxZjgiLCJtYXhSYXRpbmciOjQsInByb2ZpbGUiOiI1OGMwNjlkMmM3NmJjNDIwMDBiMTQ4YjIifQ.zpUyR41iLKsWzvO_cF_LZGmhWVkomNoxoNouKLoxrm8'
    }
  },
  showAlert: true,
  errorMsg: null
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
    this.setState({
      currentTime: 0,
      token: '',
      intervalId: 0
    });

    this.player.ready(() => {
      this.player.addClass('vjs-concurrence-limiter');
      this.validatePlay();
    });

    // Event hooks
    this.player.on('timeupdate', this.onTimeUpdate.bind(this));
    // window.addEventListener('beforeunload', this.dispose.bind(this));
  }

  makeRequest(url, options, retry) {
    const controller = new AbortController();
    let timeoutId = null;

    // Avoid conflicts
    if (this.pendingRequest) {
      return Promise.reject('...Pending Request...');
    }

    options.signal = controller.signal;
    this.pendingRequest = true;
    timeoutId = setTimeout(() => controller.abort(), options.timeout * 1000);

    return fetch(url, options)
      .then(res => {
        clearTimeout(timeoutId);
        if (res.ok) {
          this.pendingRequest = false;
          return res.json();
        }
        throw new Error('Response error');
      })
      .then(res => {
        if (!res.success || res.player !== this.options.playerId) {
          // Don't retry if server response denies concurrence
          retry = 0;
          throw new CustomError(ErrorCodes.deniedConcurrence);
        }
        return res;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (retry > 0) {
          this.pendingRequest = false;
          this.makeRequest(url, options, retry - 1);
        } else {
          this.blockPlayer(error);
        }
      });
  }

  validatePlay() {
    const access = this.options.access;
    const request = Object.assign({}, this.options.request);

    request.body = JSON.stringify({
      player: this.options.playerId
    });

    this.makeRequest(access.url, request, access.retry)
      .then(res => {
        this.player.trigger('tbxplayeraccess');
        // Start update interval binding this (ConcurrenceLimiter)
        this.intervalId = setInterval(this.update.bind(this), this.options.interval * 1000);
      })
  }

  update() {
    const update = this.options.update;
    const request = Object.assign({}, this.options.request);

    request.body = JSON.stringify({
      player: this.options.playerId,
      position: this.currentTime,
      token: this.token
    });

    this.makeRequest(update.url, request, update.retry)
      .then(res => {
        this.player.trigger('tbxplayerupdate');
        this.token = res.token;
      });
  }

  onTimeUpdate() {
    const currentTime = this.player && this.player.currentTime();

    this.currentTime = Math.round(currentTime);
  }

  dispose() {
    clearInterval(this.intervalId);

    this.player.off('timeupdate', this.onTimeUpdate.bind(this));

    const stop = this.options.stop;
    const request = Object.assign({}, this.options.request);

    request.body = JSON.stringify({
      player: this.options.playerId,
      position: this.currentTime,
      token: this.token
    });

    this.makeRequest(stop.url, request, stop.retry);

    super.dispose();
  }

  blockPlayer(rawError) {
    let error = rawError;
    if (error.name !== 'CustomError') {
      error = CustomError.parseError(rawError);
    }

    videojs.log.error(error);
    this.player.trigger('tbxplayerblocked', error);

    if (this.options.showAlert) {
      const msg = this.options.errorMsg || this.player.localize(error.code);
      setTimeout(() => alert(msg), 0);
    }

    this.player.dispose();
  }
}

// Define default values for the plugin's `state` object here.
ConcurrenceLimiter.defaultState = {};

// Include the version number.
ConcurrenceLimiter.VERSION = VERSION;

// Register the plugin with video.js.
videojs.registerPlugin('concurrenceLimiter', ConcurrenceLimiter);

export default ConcurrenceLimiter;

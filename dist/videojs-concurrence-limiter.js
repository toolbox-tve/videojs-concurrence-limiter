/*! @name videojs-concurrence-limiter @version 1.0.0 @license Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('video.js')) :
  typeof define === 'function' && define.amd ? define(['video.js'], factory) :
  (global.videojsConcurrenceLimiter = factory(global.videojs));
}(this, (function (videojs) { 'use strict';

  videojs = videojs && videojs.hasOwnProperty('default') ? videojs['default'] : videojs;

  var version = "1.0.0";

  var errorMessages = {
  	"CL-001": "Concurrence denied by server.",
  	"CL-002": "No connection to the network."
  };

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  var inherits = function (subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };

  var possibleConstructorReturn = function (self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

  var CustomError = function (_Error) {
    inherits(CustomError, _Error);

    function CustomError(code, message) {
      classCallCheck(this, CustomError);

      for (var _len = arguments.length, params = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        params[_key - 2] = arguments[_key];
      }

      var _this = possibleConstructorReturn(this, _Error.call.apply(_Error, [this].concat(params)));

      if (Error.captureStackTrace) {
        Error.captureStackTrace(_this, CustomError);
      }

      _this.code = code;
      _this.message = errorMessages[code];
      _this.name = 'CustomError';
      return _this;
    }

    CustomError.parseError = function parseError(error) {
      if (!error.code) {
        return new CustomError(ErrorCodes.noConnection);
      }

      switch (error.code) {
        case 20:
          return new CustomError(ErrorCodes.noConnection);
      }
    };

    return CustomError;
  }(Error);


  var ErrorCodes = {
    deniedConcurrence: 'CL-001',
    noConnection: 'CL-002'
  };

  var Plugin = videojs.getPlugin('plugin');

  // Default options for the plugin.
  var defaults$1 = {
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

  var ConcurrenceLimiter = function (_Plugin) {
    inherits(ConcurrenceLimiter, _Plugin);

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
    function ConcurrenceLimiter(player, options) {
      classCallCheck(this, ConcurrenceLimiter);

      var _this = possibleConstructorReturn(this, _Plugin.call(this, player));
      // the parent class will add player under this.player


      _this.options = videojs.mergeOptions(defaults$1, options);
      _this.setState({
        currentTime: 0,
        token: '',
        intervalId: 0
      });

      _this.player.ready(function () {
        _this.player.addClass('vjs-concurrence-limiter');
        _this.validatePlay();
      });

      // Event hooks
      _this.player.on('timeupdate', _this.onTimeUpdate.bind(_this));
      // window.addEventListener('beforeunload', this.dispose.bind(this));
      return _this;
    }

    ConcurrenceLimiter.prototype.makeRequest = function makeRequest(url, options, retry) {
      var _this2 = this;

      var controller = new AbortController();
      var timeoutId = null;

      // Avoid conflicts
      if (this.pendingRequest) {
        return Promise.reject('...Pending Request...');
      }

      options.signal = controller.signal;
      this.pendingRequest = true;
      timeoutId = setTimeout(function () {
        return controller.abort();
      }, options.timeout * 1000);

      return fetch(url, options).then(function (res) {
        clearTimeout(timeoutId);
        if (res.ok) {
          _this2.pendingRequest = false;
          return res.json();
        }
        throw new Error('Response error');
      }).then(function (res) {
        if (!res.success || res.player !== _this2.options.playerId) {
          // Don't retry if server response denies concurrence
          retry = 0;
          throw new CustomError(ErrorCodes.deniedConcurrence);
        }
        return res;
      }).catch(function (error) {
        clearTimeout(timeoutId);
        if (retry > 0) {
          _this2.pendingRequest = false;
          _this2.makeRequest(url, options, retry - 1);
        } else {
          _this2.blockPlayer(error);
        }
      });
    };

    ConcurrenceLimiter.prototype.validatePlay = function validatePlay() {
      var _this3 = this;

      var access = this.options.access;
      var request = _extends({}, this.options.request);

      request.body = JSON.stringify({
        player: this.options.playerId
      });

      this.makeRequest(access.url, request, access.retry).then(function (res) {
        _this3.player.trigger('tbxplayeraccess');
        // Start update interval binding this (ConcurrenceLimiter)
        _this3.intervalId = setInterval(_this3.update.bind(_this3), _this3.options.interval * 1000);
      });
    };

    ConcurrenceLimiter.prototype.update = function update() {
      var _this4 = this;

      var update = this.options.update;
      var request = _extends({}, this.options.request);

      request.body = JSON.stringify({
        player: this.options.playerId,
        position: this.currentTime,
        token: this.token
      });

      this.makeRequest(update.url, request, update.retry).then(function (res) {
        _this4.player.trigger('tbxplayerupdate');
        _this4.token = res.token;
      });
    };

    ConcurrenceLimiter.prototype.onTimeUpdate = function onTimeUpdate() {
      var currentTime = this.player && this.player.currentTime();

      this.currentTime = Math.round(currentTime);
    };

    ConcurrenceLimiter.prototype.dispose = function dispose() {
      clearInterval(this.intervalId);

      this.player.off('timeupdate', this.onTimeUpdate.bind(this));

      var stop = this.options.stop;
      var request = _extends({}, this.options.request);

      request.body = JSON.stringify({
        player: this.options.playerId,
        position: this.currentTime,
        token: this.token
      });

      this.makeRequest(stop.url, request, stop.retry);

      _Plugin.prototype.dispose.call(this);
    };

    ConcurrenceLimiter.prototype.blockPlayer = function blockPlayer(rawError) {
      var error = rawError;
      if (error.name !== 'CustomError') {
        error = CustomError.parseError(rawError);
      }

      videojs.log.error(error);
      this.player.trigger('tbxplayerblocked', error);

      if (this.options.showAlert) {
        var msg = this.options.errorMsg || this.player.localize(error.code);
        setTimeout(function () {
          return alert(msg);
        }, 0);
      }

      this.player.dispose();
    };

    return ConcurrenceLimiter;
  }(Plugin);

  // Define default values for the plugin's `state` object here.


  ConcurrenceLimiter.defaultState = {};

  // Include the version number.
  ConcurrenceLimiter.VERSION = version;

  // Register the plugin with video.js.
  videojs.registerPlugin('concurrenceLimiter', ConcurrenceLimiter);

  return ConcurrenceLimiter;

})));

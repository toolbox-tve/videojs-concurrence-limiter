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
  startPosition: 0,
  maxUpdateFails: 1
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
        (function () {

          var pendingRequest = false;
          var failedRequest = 0;

          // real watchdog
          var wdf = function wdf() {

            player.trigger({
              type: 'avplayerupdate',
              playerID: playerID
            });

            //avoid conflicts
            if (pendingRequest) {
              return;
            }
            pendingRequest = true;

            _this3.makeRequest(options.updateurl, {
              player: playerID,
              token: playerToken,
              position: lasTime,
              status: player.paused() ? 'paused' : 'playing'
            }, function (error, response) {

              pendingRequest = false;

              if (error) {

                //alow some error level
                if (failedRequest >= options.maxUpdateFails) {
                  _videoJs2['default'].log('concurrenceview: update api error', error);
                  _this3.blockPlayer(player, 'authapifail', { msg: error });
                }

                failedRequest++;

                return;
              }

              failedRequest = 0;

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
        })();
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
concurrenceLimiter.VERSION = '__VERSION__';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];
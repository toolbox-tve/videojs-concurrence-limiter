'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _videoJs = require('video.js');

var _videoJs2 = _interopRequireDefault(_videoJs);

var _deepmerge = require('deepmerge');

var _deepmerge2 = _interopRequireDefault(_deepmerge);

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
  }
};

/**
 * Events
 *
 */
var EVENTS = {
  LOAD: 'Load',
  START: 'Start',
  PROGRESS: 'Progress',
  FIRSTQUARTILE: 'FirstQuartile',
  MIDPOINT: 'Midpoint',
  THIRDQUARTILE: 'ThirdQuartile',
  COMPLETE: 'Complete',
  PAUSE: 'Pause',
  RESUME: 'Resume',
  CLOSE: 'Close'
};
var PERCENTAGE = {
  FIRSTQUARTILE: 25,
  MIDPOINT: 50,
  THIRDQUARTILE: 75,
  COMPLETE: 95
};
var eventsSent = [];

function getEvent(player, position) {
  var duration = player.duration();

  if ((duration === 0 || parseInt(position, 0) === 0) && !eventsSent.includes(EVENTS.START)) {
    eventsSent.push(EVENTS.START);
    return EVENTS.START;
  }
  var percentage = position / duration * 100;
  var rtnEvent = EVENTS.PROGRESS;

  if (percentage >= PERCENTAGE.FIRSTQUARTILE && !eventsSent.includes(EVENTS.FIRSTQUARTILE)) {
    rtnEvent = EVENTS.FIRSTQUARTILE;
  } else if (percentage >= PERCENTAGE.MIDPOINT && !eventsSent.includes(EVENTS.MIDPOINT)) {
    rtnEvent = EVENTS.MIDPOINT;
  } else if (percentage >= PERCENTAGE.THIRDQUARTILE && !eventsSent.includes(EVENTS.THIRDQUARTILE)) {
    rtnEvent = EVENTS.THIRDQUARTILE;
  } else if (percentage >= PERCENTAGE.COMPLETE && !eventsSent.includes(EVENTS.COMPLETE)) {
    rtnEvent = EVENTS.COMPLETE;
  }

  if (eventsSent.includes(rtnEvent)) {
    rtnEvent = EVENTS.PROGRESS;
  }

  eventsSent.push(rtnEvent);
  return rtnEvent;
}

function getTimeSpent(start) {
  if (!start) {
    return null;
  }
  return Math.round((Date.now() - start) / 1000);
}

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
    this.eventsFlags = {};
    this.updateFailsCount = 1;

    this.options.playerID = new ConcurrentViewIdMaker().generate(options);

    this.playerToken = null;
    this.startDate = null;
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
   * hook into player events right after player is ready to set flags for later checks
   */

  _createClass(ConcurrentViewPlugin, [{
    key: 'hookPlayerEvents',
    value: function hookPlayerEvents() {
      var _this = this;

      this.player.on('loadedmetadata', function () {
        return _this.eventsFlags.loadedmetadata = true;
      });

      this.player.on('pause', this.reportEvent.bind(this, this.player, EVENTS.PAUSE));
      this.player.on('play', this.reportEvent.bind(this, this.player, EVENTS.RESUME));
      window.addEventListener('beforeunload', this.reportEvent.bind(this, this.player, EVENTS.CLOSE));
    }

    /**
     * xhr alias
     *
     * @param url
     * @param data
     * @param cb
     */
  }, {
    key: 'makeRequest',
    value: function makeRequest(url, data, cb) {
      var requestConfig = {
        body: data ? JSON.stringify(data) : '{}',
        url: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      requestConfig = (0, _deepmerge2['default'])(requestConfig, this.options.request);

      _videoJs2['default'].xhr(requestConfig, function (err, resp, body) {

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
      var _this2 = this;

      this.makeRequest(this.options.accessurl, {
        player: this.options.playerID
      }, function (error, ok) {
        if (error) {
          _videoJs2['default'].log('concurrenceview: accessurl api error', error);

          if (_this2.updateFailsCount >= _this2.options.maxUpdateFails) {
            cb(new Error(error), null);
          } else {

            _videoJs2['default'].log('concurrenceview: accessurl retry', _this2.updateFailsCount, _this2.options.maxUpdateFails);

            _this2.updateFailsCount++;
            // try again
            _this2.player.setTimeout(function () {
              return _this2.validatePlay(cb);
            }, 200);
          }

          return;
        }

        _this2.updateFailsCount = 1;

        if (ok && ok.success) {
          cb(null, ok);

          _this2.player.trigger({
            type: 'avplayercanplay',
            code: 1
          });

          // Save the starting date if null
          if (!_this2.startDate) {
            _this2.startDate = Date.now();
          }
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
      var _this3 = this;

      if (!info.position) {
        return;
      }

      this.player.currentTime = info.position;

      this.player.on('loadedmetadata', function () {
        return _this3.currentTime = info.position;
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
      var _this4 = this;

      var watchdog = null;
      var options = this.options;
      var player = this.player;

      var lasTime = options.startPosition || 0;
      var playerToken = null;
      var playerID = options.playerID;

      player.on('timeupdate', function (e) {

        // waits until 'loadedmetadata' event is raised
        if (!_this4.eventsFlags.loadedmetadata || !_this4.firstSent) {
          _this4.firstSent = true;
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

          _this4.makeRequest(options.disposeurl, {
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
          // real watchdog
          var wdf = function wdf() {

            player.trigger({
              type: 'avplayerupdate',
              playerID: playerID
            });

            // avoid conflicts
            if (pendingRequest) {
              return;
            }
            pendingRequest = true;

            _this4.makeRequest(options.updateurl, {
              player: playerID,
              token: playerToken,
              position: lasTime,
              status: player.paused() ? 'paused' : 'playing',
              event: getEvent(player, lasTime),
              timeSpent: getTimeSpent(_this4.startDate)
            }, function (error, response) {

              pendingRequest = false;

              if (error) {
                _videoJs2['default'].log('concurrenceview: updateurl api error', error);

                // allow some error level
                if (_this4.updateFailsCount >= options.maxUpdateFails) {
                  _this4.blockPlayer(player, 'authapifail', { msg: error });
                }

                _videoJs2['default'].log('concurrenceview: updateurl retry later', _this4.updateFailsCount, options.maxUpdateFails);

                _this4.updateFailsCount++;

                return;
              }

              _this4.updateFailsCount = 1;

              if (response && response.success) {
                playerID = response.player || playerID;
                playerToken = response.token || playerToken;
                _this4.playerToken = playerToken;
              } else {
                _videoJs2['default'].log(new Error('Player Auth error'), response);
                _this4.blockPlayer(player, 'noauth', response);
              }
            });
          };

          watchdog = player.setInterval(wdf, options.interval * 1000);

          // call & block
          wdf();
        })();
      }
    }
  }, {
    key: 'reportEvent',
    value: function reportEvent(player, event) {
      this.makeRequest(this.options.updateurl, {
        player: this.options.playerID,
        token: this.playerToken,
        position: Math.round(player.currentTime() || 0),
        status: player.paused() ? 'paused' : 'playing',
        event: event,
        timeSpent: getTimeSpent(this.startDate)
      }, function () {});
    }
  }]);

  return ConcurrentViewPlugin;
})();

var onPlayerReady = function onPlayerReady(player, options) {
  player.addClass('vjs-concurrence-limiter');

  player._cvPlugin = new ConcurrentViewPlugin(options, player);
  var cvPlugin = player._cvPlugin;

  // Hook into player events after player is ready to avoid missing first triggered events
  cvPlugin.hookPlayerEvents();

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
  var _this5 = this;

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

    onPlayerReady(_this5, options);
  });
};

// Register the plugin with video.js.
_videoJs2['default'].plugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '__VERSION__';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];
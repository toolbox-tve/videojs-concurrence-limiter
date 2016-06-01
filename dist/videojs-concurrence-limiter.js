(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.videojsConcurrenceLimiter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
  startPosition: 0,
  maxUpdateFails: 1,
  requestTimeoutInMillis: 15 * 1000
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
        },
        timeout: this.options.requestTimeoutInMillis
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
concurrenceLimiter.VERSION = '0.2.0';

exports['default'] = concurrenceLimiter;
module.exports = exports['default'];

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9mcmFuL3dvcmtzcGFjZS92aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIvc3JjL3BsdWdpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7dUJDQW9CLFVBQVU7Ozs7O0FBRzlCLElBQU0sUUFBUSxHQUFHO0FBQ2YsVUFBUSxFQUFFLEVBQUU7QUFDWixXQUFTLEVBQUUsSUFBSTtBQUNmLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsVUFBUSxFQUFFLElBQUk7QUFDZCxlQUFhLEVBQUUsQ0FBQztBQUNoQixnQkFBYyxFQUFFLENBQUM7QUFDakIsd0JBQXNCLEVBQUUsRUFBRSxHQUFHLElBQUk7Q0FDbEMsQ0FBQzs7Ozs7O0lBS0kscUJBQXFCO0FBRWQsV0FGUCxxQkFBcUIsR0FFWDswQkFGVixxQkFBcUI7O0FBR3ZCLFFBQUksQ0FBQyxpQkFBaUIsR0FBRyxlQUFlLENBQUM7R0FDMUM7Ozs7Ozs7Ozs7OztlQUpHLHFCQUFxQjs7V0FXakIsa0JBQUMsT0FBTyxFQUFFOzs7QUFHaEIsVUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO0FBQ3BCLGVBQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQztPQUN6Qjs7QUFFRCxhQUFPLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxJQUFLLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLEFBQUMsQ0FBQztLQUM1RTs7Ozs7Ozs7O1dBT2Esd0JBQUMsR0FBRyxFQUFFO0FBQ2xCLGFBQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUEsR0FBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDMUQ7Ozs7Ozs7O1dBTXVCLG9DQUFHOztBQUV6QixVQUFJLENB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WSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQzs7QUFFMUQseUJBQVEsR0FBRyxDQUFDLHdCQUF3QixFQUFFLE9BQU8sQ0FBQyxDQUFDOztBQUUvQyxRQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFO0FBQ25FLDJCQUFRLEdBQUcsQ0FBQywrQkFBK0IsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN0RCxhQUFPO0tBQ1I7O0FBRUQsUUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksT0FBTyxDQUFDLFFBQVEsR0FBRyxDQUFDLEVBQUU7QUFDN0MsMkJBQVEsR0FBRyxDQUFDLGtDQUFrQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3pELGFBQU87S0FDUjs7QUFFRCxpQkFBYSxTQUFPLE9BQU8sQ0FBQyxDQUFDO0dBQzlCLENBQUMsQ0FBQztDQUNKLENBQUM7OztBQUdGLHFCQUFRLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDOzs7QUFHekQsa0JBQWtCLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQzs7cUJBRTVCLGtCQUFrQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQgdmlkZW9qcyBmcm9tICd2aWRlby5qcyc7XG5cbi8vIERlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIHBsdWdpbi5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICBpbnRlcnZhbDogMTAsXG4gIGFjY2Vzc3VybDogbnVsbCxcbiAgdXBkYXRldXJsOiBudWxsLFxuICBkaXNwb3NldXJsOiBudWxsLFxuICBwbGF5ZXJJRDogbnVsbCxcbiAgc3RhcnRQb3NpdGlvbjogMCxcbiAgbWF4VXBkYXRlRmFpbHM6IDEsXG4gIHJlcXVlc3RUaW1lb3V0SW5NaWxsaXM6IDE1ICogMTAwMFxufTtcblxuLyoqXG4gKiBjcmVhdGVzIHBsYXllciBpZHNcbiAqL1xuY2xhc3MgQ29uY3VycmVudFZpZXdJZE1ha2VyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnNlc3Npb25TdG9yYWdlS2V5ID0gJ3ZjbC1wbGF5ZXItaWQnO1xuICB9XG5cbiAgLyoqXG4gICAqIGNyZWF0ZSBpZCAoaWYgbmVlZGVkKVxuICAgKiBAcGFyYW0gb3B0aW9uc1xuICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgZ2VuZXJhdGUob3B0aW9ucykge1xuXG4gICAgLy8gdXNlci1tYWRlIGlkXG4gICAgaWYgKG9wdGlvbnMucGxheWVySUQpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLnBsYXllcklEO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmdlbmVyYXRlQnlTZXNzaW9uU3RvcmFnZSgpIHx8ICgncmRtLScgKyB0aGlzLmdlbmVyYXRlUmFuZG9tKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIHJhbmRvbSB3b3Jkc1xuICAgKiBAcGFyYW0gbGVuXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gIGdlbmVyYXRlUmFuZG9tKGxlbikge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKChsZW4gfHwgMzApICsgMikuc3Vic3RyKDIpO1xuICB9XG5cbiAgLyoqXG4gICAqIHNlc3Npb25TdG9yYWdlIGlkXG4gICAqIEByZXR1cm5zIHtudWxsfVxuICAgICAqL1xuICBnZW5lcmF0ZUJ5U2Vzc2lvblN0b3JhZ2UoKSB7XG5cbiAgICBpZiAoIXdpbmRvdy5zZXNzaW9uU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGlkID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmdldEl0ZW0odGhpcy5zZXNzaW9uU3RvcmFnZUtleSk7XG5cbiAgICBpZiAoIWlkKSB7XG4gICAgICBpZCA9ICdzc2ktJyArIHRoaXMuZ2VuZXJhdGVSYW5kb20oKTtcbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXksIGlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxufVxuXG4vKipcbiAqIG1haW4gcGx1Z2luIGNvbXBvbmVudCBjbGFzc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld1BsdWdpbiB7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucywgcGxheWVyKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgIHRoaXMub3B0aW9ucy5wbGF5ZXJJRCA9IG5ldyBDb25jdXJyZW50Vmlld0lkTWFrZXIoKS5nZW5lcmF0ZShvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiB4aHIgYWxpYXNcbiAgICpcbiAgICogQHBhcmFtIHVybFxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcGFyYW0gY2JcbiAgICAgKi9cbiAgbWFrZVJlcXVlc3QodXJsLCBkYXRhLCBjYikge1xuICAgIHZpZGVvanMueGhyKFxuICAgICAge1xuICAgICAgICBib2R5OiBkYXRhID8gSlNPTi5zdHJpbmdpZnkoZGF0YSkgOiAne30nLFxuICAgICAgICB1cmwsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9LFxuICAgICAgICB0aW1lb3V0OiB0aGlzLm9wdGlvbnMucmVxdWVzdFRpbWVvdXRJbk1pbGxpc1xuICAgICAgfSxcbiAgICAgIChlcnIsIHJlc3AsIGJvZHkpID0+IHtcblxuICAgICAgICBsZXQgYm9keUpzb247XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBib2R5SnNvbiA9IGJvZHkgPyBKU09OLnBhcnNlKGJvZHkpIDoge2Vycm9yOiAnaW52YWxpZCBib2R5JywgYm9keX07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBib2R5SnNvbiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjYihlcnIgPyBlcnIubWVzc2FnZSB8fCBlcnIgOiBudWxsLCBib2R5SnNvbik7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiB2YWxpZGF0ZXMgcGxheWVyIGFjY2Vzc1xuICAgKiBAcGFyYW0gY2JcbiAgICAgKi9cbiAgdmFsaWRhdGVQbGF5KGNiKSB7XG5cbiAgICB0aGlzLm1ha2VSZXF1ZXN0KFxuICAgICAgdGhpcy5vcHRpb25zLmFjY2Vzc3VybCxcbiAgICAgIHtcbiAgICAgICAgcGxheWVyOiB0aGlzLm9wdGlvbnMucGxheWVySURcbiAgICAgIH0sXG4gICAgICAoZXJyb3IsIG9rKSA9PiB7XG4gICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGNhbnBsYXkgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgIGNiKG5ldyBFcnJvcihlcnJvciksIG51bGwpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvayAmJiBvay5zdWNjZXNzKSB7XG4gICAgICAgICAgY2IobnVsbCwgb2spO1xuXG4gICAgICAgICAgdGhpcy5wbGF5ZXIudHJpZ2dlcih7XG4gICAgICAgICAgICB0eXBlOiAnYXZwbGF5ZXJjYW5wbGF5JyxcbiAgICAgICAgICAgIGNvZGU6IDFcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYihuZXcgRXJyb3IoJ1BsYXllciBBdXRoIGVycm9yJyksIG51bGwpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuICB9XG5cbiAgLyoqXG4gICAqIGRpc3Bvc2VzIGN1cnJlbnQgcGxheWVyIGluc3RhbmNlXG4gICAqXG4gICAqIEBwYXJhbSBjb2RlXG4gICAqIEBwYXJhbSBlcnJvclxuICAgKiBAcGFyYW0gcmVhc29uXG4gICAgICovXG4gIGJsb2NrUGxheWVyKGNvZGUsIGVycm9yLCByZWFzb24pIHtcbiAgICBjb2RlID0gY29kZSB8fCAnZXJyb3InO1xuICAgIHJlYXNvbiA9IHJlYXNvbiB8fCAnSGFzIGFsY2FuemFkbyBsYSBjYW50aWRhZCBtYXhpbWEgZGUgcGxheWVycyBhY3Rpdm9zLic7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBzdG9wIHBsYXllciAtICcsIHJlYXNvbik7XG5cbiAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgIHR5cGU6ICdhdnBsYXllcmJsb2tlZCcsXG4gICAgICBjb2RlLFxuICAgICAgcmVhc29uLFxuICAgICAgZXJyb3JcbiAgICB9KTtcblxuICAgIHRoaXMucGxheWVyLnBhdXNlKCk7XG4gICAgdGhpcy5wbGF5ZXIuZGlzcG9zZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIGdldCBsYXN0IHBvc2l0aW9uXG4gICAqXG4gICAqIEBwYXJhbSBpbmZvXG4gICAgICovXG4gIHJlY292ZXJTdGF0dXMoaW5mbykge1xuICAgIGlmICghaW5mby5wb3NpdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGxheWVyLmN1cnJlbnRUaW1lID0gaW5mby5wb3NpdGlvbjtcblxuICAgIHRoaXMucGxheWVyLm9uKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHRoaXMuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uKTtcblxuICB9XG5cbiAgLyogKioqKioqKioqKioqKiogKi9cblxuICAvKipcbiAgICogY3JlYXRlcyBhIG1vbml0b3IgaW50ZXJ2YWxcbiAgICpcbiAgICogQHBhcmFtIG9rXG4gICAgICovXG4gIG1ha2VXYXRjaGRvZyhvaykge1xuXG4gICAgbGV0IHdhdGNoZG9nID0gbnVsbDtcbiAgICBsZXQgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBsZXQgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG5cbiAgICBsZXQgbGFzVGltZSA9IG9wdGlvbnMuc3RhcnRQb3NpdGlvbiB8fCAwO1xuICAgIGxldCBwbGF5ZXJUb2tlbiA9IG51bGw7XG4gICAgbGV0IHBsYXllcklEID0gb3B0aW9ucy5wbGF5ZXJJRDtcbiAgICBsZXQgbG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcblxuICAgIHBsYXllci5vbignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiBsb2FkZWRtZXRhZGF0YSA9IHRydWUpO1xuXG4gICAgcGxheWVyLm9uKCd0aW1ldXBkYXRlJywgKGUpID0+IHtcblxuICAgICAgLy8gd2FpdHMgdW50aWwgJ2xvYWRlZG1ldGFkYXRhJyBldmVudCBpcyByYWlzZWRcbiAgICAgIGlmICghbG9hZGVkbWV0YWRhdGEgfHwgIXRoaXMuZmlzdFNlbnQpIHtcbiAgICAgICAgdGhpcy5maXN0U2VudCA9IHRydWU7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGFzVGltZSA9IE1hdGgucm91bmQocGxheWVyLmN1cnJlbnRUaW1lKCkgfHwgMCk7XG4gICAgfSk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2UgcGx1Z2luOiBvaycsIG9rKTtcblxuICAgIC8vIGNsZWFyIGFmdGVyIGRpc3Bvc2VcbiAgICBsZXQgY2xlYW5VcCA9ICgpID0+IHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IERJU1BPU0UnLCBvcHRpb25zKTtcblxuICAgICAgaWYgKHdhdGNoZG9nKSB7XG4gICAgICAgIHBsYXllci5jbGVhckludGVydmFsKHdhdGNoZG9nKTtcbiAgICAgICAgd2F0Y2hkb2cgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KFxuICAgICAgICAgIG9wdGlvbnMuZGlzcG9zZXVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwbGF5ZXI6IHBsYXllcklELFxuICAgICAgICAgICAgcG9zaXRpb246IGxhc1RpbWUsXG4gICAgICAgICAgICB0b2tlbjogcGxheWVyVG9rZW4sXG4gICAgICAgICAgICBzdGF0dXM6ICdwYXVzZWQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoKSA9PiB7fVxuICAgICAgICApO1xuXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIGFkZCBob29rc1xuICAgIHBsYXllci5vbignZGlzcG9zZScsIGNsZWFuVXApO1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBjbGVhblVwKTtcblxuICAgIGlmICghd2F0Y2hkb2cpIHtcblxuICAgICAgbGV0IHBlbmRpbmdSZXF1ZXN0ID0gZmFsc2U7XG4gICAgICBsZXQgZmFpbGVkUmVxdWVzdCA9IDA7XG5cbiAgICAgIC8vIHJlYWwgd2F0Y2hkb2dcbiAgICAgIGxldCB3ZGYgPSAoKSA9PiB7XG5cbiAgICAgICAgcGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgIHR5cGU6ICdhdnBsYXllcnVwZGF0ZScsXG4gICAgICAgICAgcGxheWVySURcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9hdm9pZCBjb25mbGljdHNcbiAgICAgICAgaWYocGVuZGluZ1JlcXVlc3QpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcGVuZGluZ1JlcXVlc3QgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy51cGRhdGV1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgc3RhdHVzOiBwbGF5ZXIucGF1c2VkKCkgPyAncGF1c2VkJyA6ICdwbGF5aW5nJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKGVycm9yLCByZXNwb25zZSkgPT4ge1xuXG4gICAgICAgICAgICBwZW5kaW5nUmVxdWVzdCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcblxuICAgICAgICAgICAgICAvL2Fsb3cgc29tZSBlcnJvciBsZXZlbFxuICAgICAgICAgICAgICBpZihmYWlsZWRSZXF1ZXN0ID49IG9wdGlvbnMubWF4VXBkYXRlRmFpbHMpIHtcbiAgICAgICAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiB1cGRhdGUgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnYXV0aGFwaWZhaWwnLCB7bXNnOiBlcnJvcn0pO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgZmFpbGVkUmVxdWVzdCsrO1xuXG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmFpbGVkUmVxdWVzdCA9IDA7XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHBsYXllcklEID0gcmVzcG9uc2UucGxheWVyIHx8IHBsYXllcklEO1xuICAgICAgICAgICAgICBwbGF5ZXJUb2tlbiA9IHJlc3BvbnNlLnRva2VuIHx8IHBsYXllclRva2VuO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZyhuZXcgRXJyb3IoJ1BsYXllciBBdXRoIGVycm9yJyksIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgdGhpcy5ibG9ja1BsYXllcihwbGF5ZXIsICdub2F1dGgnLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcblxuICAgICAgd2F0Y2hkb2cgPSBwbGF5ZXIuc2V0SW50ZXJ2YWwod2RmLCBvcHRpb25zLmludGVydmFsICogMTAwMCk7XG5cbiAgICAgIC8vIGNhbGwgJiBibG9ja1xuICAgICAgd2RmKCk7XG4gICAgfVxuXG4gIH1cblxufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBwbGF5ZXIgaXMgcmVhZHkuXG4gKlxuICogVGhpcyBpcyBhIGdyZWF0IHBsYWNlIGZvciB5b3VyIHBsdWdpbiB0byBpbml0aWFsaXplIGl0c2VsZi4gV2hlbiB0aGlzXG4gKiBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSBwbGF5ZXIgd2lsbCBoYXZlIGl0cyBET00gYW5kIGNoaWxkIGNvbXBvbmVudHNcbiAqIGluIHBsYWNlLlxuICpcbiAqIEBmdW5jdGlvbiBvblBsYXllclJlYWR5XG4gKiBAcGFyYW0gICAge1BsYXllcn0gcGxheWVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKi9cbmNvbnN0IG9uUGxheWVyUmVhZHkgPSAocGxheWVyLCBvcHRpb25zKSA9PiB7XG4gIHBsYXllci5hZGRDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKTtcblxuICBwbGF5ZXIuX2N2UGx1Z2luID0gbmV3IENvbmN1cnJlbnRWaWV3UGx1Z2luKG9wdGlvbnMsIHBsYXllcik7XG4gIGxldCBjdlBsdWdpbiA9IHBsYXllci5fY3ZQbHVnaW47XG5cbiAgY3ZQbHVnaW4udmFsaWRhdGVQbGF5KChlcnJvciwgb2spID0+IHtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogZXJyb3InLCBlcnJvcik7XG4gICAgICBjdlBsdWdpbi5ibG9ja1BsYXllcignY2FudHBsYXknLCBlcnJvcik7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICBjdlBsdWdpbi5yZWNvdmVyU3RhdHVzKG9rKTtcbiAgICAgIC8vIG1vbml0b3JcbiAgICAgIGN2UGx1Z2luLm1ha2VXYXRjaGRvZyhvayk7XG4gICAgfVxuXG4gIH0pO1xuXG59O1xuXG4vKipcbiAqIEEgdmlkZW8uanMgcGx1Z2luLlxuICpcbiAqIEluIHRoZSBwbHVnaW4gZnVuY3Rpb24sIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaXMgYSB2aWRlby5qcyBgUGxheWVyYFxuICogaW5zdGFuY2UuIFlvdSBjYW5ub3QgcmVseSBvbiB0aGUgcGxheWVyIGJlaW5nIGluIGEgXCJyZWFkeVwiIHN0YXRlIGhlcmUsXG4gKiBkZXBlbmRpbmcgb24gaG93IHRoZSBwbHVnaW4gaXMgaW52b2tlZC4gVGhpcyBtYXkgb3IgbWF5IG5vdCBiZSBpbXBvcnRhbnRcbiAqIHRvIHlvdTsgaWYgbm90LCByZW1vdmUgdGhlIHdhaXQgZm9yIFwicmVhZHlcIiFcbiAqXG4gKiBAZnVuY3Rpb24gY29uY3VycmVuY2VMaW1pdGVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKiAgICAgICAgICAgQW4gb2JqZWN0IG9mIG9wdGlvbnMgbGVmdCB0byB0aGUgcGx1Z2luIGF1dGhvciB0byBkZWZpbmUuXG4gKi9cbmNvbnN0IGNvbmN1cnJlbmNlTGltaXRlciA9IGZ1bmN0aW9uKHVzZXJvcHRpb25zKSB7XG5cbiAgdGhpcy5yZWFkeSgoKSA9PiB7XG5cbiAgICBsZXQgb3B0aW9ucyA9IHZpZGVvanMubWVyZ2VPcHRpb25zKGRlZmF1bHRzLCB1c2Vyb3B0aW9ucyk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3IHBsdWdpbicsIG9wdGlvbnMpO1xuXG4gICAgaWYgKCFvcHRpb25zLmFjY2Vzc3VybCB8fCAhb3B0aW9ucy51cGRhdGV1cmwgfHwgIW9wdGlvbnMuZGlzcG9zZXVybCkge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogaW52YWxpZCB1cmxzJywgb3B0aW9ucyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLmludGVydmFsIHx8IG9wdGlvbnMuaW50ZXJ2YWwgPCA1KSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIG9wdGlvbnMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvblBsYXllclJlYWR5KHRoaXMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIFJlZ2lzdGVyIHRoZSBwbHVnaW4gd2l0aCB2aWRlby5qcy5cbnZpZGVvanMucGx1Z2luKCdjb25jdXJyZW5jZUxpbWl0ZXInLCBjb25jdXJyZW5jZUxpbWl0ZXIpO1xuXG4vLyBJbmNsdWRlIHRoZSB2ZXJzaW9uIG51bWJlci5cbmNvbmN1cnJlbmNlTGltaXRlci5WRVJTSU9OID0gJ19fVkVSU0lPTl9fJztcblxuZXhwb3J0IGRlZmF1bHQgY29uY3VycmVuY2VMaW1pdGVyO1xuIl19

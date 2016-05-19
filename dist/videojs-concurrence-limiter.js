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
  startPosition: 0
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

        // real watchdog
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

        // call & block
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

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9mcmFuL3dvcmtzcGFjZS92aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIvc3JjL3BsdWdpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7dUJDQW9CLFVBQVU7Ozs7O0FBRzlCLElBQU0sUUFBUSxHQUFHO0FBQ2YsVUFBUSxFQUFFLEVBQUU7QUFDWixXQUFTLEVBQUUsSUFBSTtBQUNmLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsVUFBUSxFQUFFLElBQUk7QUFDZCxlQUFhLEVBQUUsQ0FBQztDQUNqQixDQUFDOzs7Ozs7SUFLSSxxQkFBcUI7QUFFZCxXQUZQLHFCQUFxQixHQUVYOzBCQUZWLHFCQUFxQjs7QUFHdkIsUUFBSSxDQUFDLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztHQUMxQzs7Ozs7Ozs7Ozs7O2VBSkcscUJBQXFCOztXQVdqQixrQkFBQyxPQUFPLEVBQUU7OztBQUdoQixVQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUU7QUFDcEIsZUFBTyxPQUFPLENBQUMsUUFBUSxDQUFDO09BQ3pCOztBQUVELGFBQU8sSUFBSSxDQUFDLHdCQUF3QixFQUFFLElBQUssTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQUFBQyxDQUFDO0tBQzVFOzs7Ozs7Ozs7V0FPYSx3QkFBQyxHQUFHLEVBQUU7QUFDbEIsYUFBTyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQSxHQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMxRDs7Ozs7Ozs7V0FNdUIsb0NBQUc7O0FBRXpCLFVBQUksQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO0FBQzFCLGVBQU8sSUFBSSxDQUFDO09BQ2I7O0FBRUQs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S0FDUjs7QUFFRCxpQkFBYSxTQUFPLE9BQU8sQ0FBQyxDQUFDO0dBQzlCLENBQUMsQ0FBQztDQUNKLENBQUM7OztBQUdGLHFCQUFRLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDOzs7QUFHekQsa0JBQWtCLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQzs7cUJBRTVCLGtCQUFrQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQgdmlkZW9qcyBmcm9tICd2aWRlby5qcyc7XG5cbi8vIERlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIHBsdWdpbi5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICBpbnRlcnZhbDogMTAsXG4gIGFjY2Vzc3VybDogbnVsbCxcbiAgdXBkYXRldXJsOiBudWxsLFxuICBkaXNwb3NldXJsOiBudWxsLFxuICBwbGF5ZXJJRDogbnVsbCxcbiAgc3RhcnRQb3NpdGlvbjogMFxufTtcblxuLyoqXG4gKiBjcmVhdGVzIHBsYXllciBpZHNcbiAqL1xuY2xhc3MgQ29uY3VycmVudFZpZXdJZE1ha2VyIHtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLnNlc3Npb25TdG9yYWdlS2V5ID0gJ3ZjbC1wbGF5ZXItaWQnO1xuICB9XG5cbiAgLyoqXG4gICAqIGNyZWF0ZSBpZCAoaWYgbmVlZGVkKVxuICAgKiBAcGFyYW0gb3B0aW9uc1xuICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgKi9cbiAgZ2VuZXJhdGUob3B0aW9ucykge1xuXG4gICAgLy8gdXNlci1tYWRlIGlkXG4gICAgaWYgKG9wdGlvbnMucGxheWVySUQpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLnBsYXllcklEO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmdlbmVyYXRlQnlTZXNzaW9uU3RvcmFnZSgpIHx8ICgncmRtLScgKyB0aGlzLmdlbmVyYXRlUmFuZG9tKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIHJhbmRvbSB3b3Jkc1xuICAgKiBAcGFyYW0gbGVuXG4gICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gIGdlbmVyYXRlUmFuZG9tKGxlbikge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKChsZW4gfHwgMzApICsgMikuc3Vic3RyKDIpO1xuICB9XG5cbiAgLyoqXG4gICAqIHNlc3Npb25TdG9yYWdlIGlkXG4gICAqIEByZXR1cm5zIHtudWxsfVxuICAgICAqL1xuICBnZW5lcmF0ZUJ5U2Vzc2lvblN0b3JhZ2UoKSB7XG5cbiAgICBpZiAoIXdpbmRvdy5zZXNzaW9uU3RvcmFnZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IGlkID0gd2luZG93LnNlc3Npb25TdG9yYWdlLmdldEl0ZW0odGhpcy5zZXNzaW9uU3RvcmFnZUtleSk7XG5cbiAgICBpZiAoIWlkKSB7XG4gICAgICBpZCA9ICdzc2ktJyArIHRoaXMuZ2VuZXJhdGVSYW5kb20oKTtcbiAgICAgIHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5zZXRJdGVtKHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXksIGlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxufVxuXG4vKipcbiAqIG1haW4gcGx1Z2luIGNvbXBvbmVudCBjbGFzc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld1BsdWdpbiB7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucywgcGxheWVyKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcblxuICAgIHRoaXMub3B0aW9ucy5wbGF5ZXJJRCA9IG5ldyBDb25jdXJyZW50Vmlld0lkTWFrZXIoKS5nZW5lcmF0ZShvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiB4aHIgYWxpYXNcbiAgICpcbiAgICogQHBhcmFtIHVybFxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcGFyYW0gY2JcbiAgICAgKi9cbiAgbWFrZVJlcXVlc3QodXJsLCBkYXRhLCBjYikge1xuICAgIHZpZGVvanMueGhyKFxuICAgICAge1xuICAgICAgICBib2R5OiBkYXRhID8gSlNPTi5zdHJpbmdpZnkoZGF0YSkgOiAne30nLFxuICAgICAgICB1cmwsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgKGVyciwgcmVzcCwgYm9keSkgPT4ge1xuXG4gICAgICAgIGxldCBib2R5SnNvbjtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGJvZHlKc29uID0gYm9keSA/IEpTT04ucGFyc2UoYm9keSkgOiB7ZXJyb3I6ICdpbnZhbGlkIGJvZHknLCBib2R5fTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGJvZHlKc29uID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNiKGVyciA/IGVyci5tZXNzYWdlIHx8IGVyciA6IG51bGwsIGJvZHlKc29uKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIHZhbGlkYXRlcyBwbGF5ZXIgYWNjZXNzXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICB2YWxpZGF0ZVBsYXkoY2IpIHtcblxuICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICB0aGlzLm9wdGlvbnMuYWNjZXNzdXJsLFxuICAgICAge1xuICAgICAgICBwbGF5ZXI6IHRoaXMub3B0aW9ucy5wbGF5ZXJJRFxuICAgICAgfSxcbiAgICAgIChlcnJvciwgb2spID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogY2FucGxheSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgY2IobmV3IEVycm9yKGVycm9yKSwgbnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9rICYmIG9rLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBjYihudWxsLCBvayk7XG5cbiAgICAgICAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgICAgICAgIHR5cGU6ICdhdnBsYXllcmNhbnBsYXknLFxuICAgICAgICAgICAgY29kZTogMVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKG5ldyBFcnJvcignUGxheWVyIEF1dGggZXJyb3InKSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gIH1cblxuICAvKipcbiAgICogZGlzcG9zZXMgY3VycmVudCBwbGF5ZXIgaW5zdGFuY2VcbiAgICpcbiAgICogQHBhcmFtIGNvZGVcbiAgICogQHBhcmFtIGVycm9yXG4gICAqIEBwYXJhbSByZWFzb25cbiAgICAgKi9cbiAgYmxvY2tQbGF5ZXIoY29kZSwgZXJyb3IsIHJlYXNvbikge1xuICAgIGNvZGUgPSBjb2RlIHx8ICdlcnJvcic7XG4gICAgcmVhc29uID0gcmVhc29uIHx8ICdIYXMgYWxjYW56YWRvIGxhIGNhbnRpZGFkIG1heGltYSBkZSBwbGF5ZXJzIGFjdGl2b3MuJztcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IHN0b3AgcGxheWVyIC0gJywgcmVhc29uKTtcblxuICAgIHRoaXMucGxheWVyLnRyaWdnZXIoe1xuICAgICAgdHlwZTogJ2F2cGxheWVyYmxva2VkJyxcbiAgICAgIGNvZGUsXG4gICAgICByZWFzb24sXG4gICAgICBlcnJvclxuICAgIH0pO1xuXG4gICAgdGhpcy5wbGF5ZXIucGF1c2UoKTtcbiAgICB0aGlzLnBsYXllci5kaXNwb3NlKCk7XG4gIH1cblxuICAvKipcbiAgICogZ2V0IGxhc3QgcG9zaXRpb25cbiAgICpcbiAgICogQHBhcmFtIGluZm9cbiAgICAgKi9cbiAgcmVjb3ZlclN0YXR1cyhpbmZvKSB7XG4gICAgaWYgKCFpbmZvLnBvc2l0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wbGF5ZXIuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uO1xuXG4gICAgdGhpcy5wbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gdGhpcy5jdXJyZW50VGltZSA9IGluZm8ucG9zaXRpb24pO1xuXG4gIH1cblxuICAvKiAqKioqKioqKioqKioqKiAqL1xuXG4gIC8qKlxuICAgKiBjcmVhdGVzIGEgbW9uaXRvciBpbnRlcnZhbFxuICAgKlxuICAgKiBAcGFyYW0gb2tcbiAgICAgKi9cbiAgbWFrZVdhdGNoZG9nKG9rKSB7XG5cbiAgICBsZXQgd2F0Y2hkb2cgPSBudWxsO1xuICAgIGxldCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgIGxldCBwbGF5ZXIgPSB0aGlzLnBsYXllcjtcblxuICAgIGxldCBsYXNUaW1lID0gb3B0aW9ucy5zdGFydFBvc2l0aW9uIHx8IDA7XG4gICAgbGV0IHBsYXllclRva2VuID0gbnVsbDtcbiAgICBsZXQgcGxheWVySUQgPSBvcHRpb25zLnBsYXllcklEO1xuICAgIGxldCBsb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuXG4gICAgcGxheWVyLm9uKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IGxvYWRlZG1ldGFkYXRhID0gdHJ1ZSk7XG5cbiAgICBwbGF5ZXIub24oJ3RpbWV1cGRhdGUnLCAoZSkgPT4ge1xuXG4gICAgICAvLyB3YWl0cyB1bnRpbCAnbG9hZGVkbWV0YWRhdGEnIGV2ZW50IGlzIHJhaXNlZFxuICAgICAgaWYgKCFsb2FkZWRtZXRhZGF0YSB8fCAhdGhpcy5maXN0U2VudCkge1xuICAgICAgICB0aGlzLmZpc3RTZW50ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsYXNUaW1lID0gTWF0aC5yb3VuZChwbGF5ZXIuY3VycmVudFRpbWUoKSB8fCAwKTtcbiAgICB9KTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZSBwbHVnaW46IG9rJywgb2spO1xuXG4gICAgLy8gY2xlYXIgYWZ0ZXIgZGlzcG9zZVxuICAgIGxldCBjbGVhblVwID0gKCkgPT4ge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogRElTUE9TRScsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAod2F0Y2hkb2cpIHtcbiAgICAgICAgcGxheWVyLmNsZWFySW50ZXJ2YWwod2F0Y2hkb2cpO1xuICAgICAgICB3YXRjaGRvZyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy5kaXNwb3NldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHN0YXR1czogJ3BhdXNlZCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHt9XG4gICAgICAgICk7XG5cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gYWRkIGhvb2tzXG4gICAgcGxheWVyLm9uKCdkaXNwb3NlJywgY2xlYW5VcCk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2JlZm9yZXVubG9hZCcsIGNsZWFuVXApO1xuXG4gICAgaWYgKCF3YXRjaGRvZykge1xuXG4gICAgICAvLyByZWFsIHdhdGNoZG9nXG4gICAgICBsZXQgd2RmID0gKCkgPT4ge1xuXG4gICAgICAgIHBsYXllci50cmlnZ2VyKHtcbiAgICAgICAgICB0eXBlOiAnYXZwbGF5ZXJ1cGRhdGUnLFxuICAgICAgICAgIHBsYXllcklEXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy51cGRhdGV1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgc3RhdHVzOiBwbGF5ZXIucGF1c2VkKCkgPyAncGF1c2VkJyA6ICdwbGF5aW5nJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKGVycm9yLCByZXNwb25zZSkgPT4ge1xuXG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogdXBkYXRlIGFwaSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICAgICAgdGhpcy5ibG9ja1BsYXllcihwbGF5ZXIsICdhdXRoYXBpZmFpbCcsIHttc2c6IGVycm9yfSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgcGxheWVySUQgPSByZXNwb25zZS5wbGF5ZXIgfHwgcGxheWVySUQ7XG4gICAgICAgICAgICAgIHBsYXllclRva2VuID0gcmVzcG9uc2UudG9rZW4gfHwgcGxheWVyVG9rZW47XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZpZGVvanMubG9nKG5ldyBFcnJvcignUGxheWVyIEF1dGggZXJyb3InKSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICB0aGlzLmJsb2NrUGxheWVyKHBsYXllciwgJ25vYXV0aCcsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9O1xuXG4gICAgICB3YXRjaGRvZyA9IHBsYXllci5zZXRJbnRlcnZhbCh3ZGYsIG9wdGlvbnMuaW50ZXJ2YWwgKiAxMDAwKTtcblxuICAgICAgLy8gY2FsbCAmIGJsb2NrXG4gICAgICB3ZGYoKTtcbiAgICB9XG5cbiAgfVxuXG59XG5cbi8qKlxuICogRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHBsYXllciBpcyByZWFkeS5cbiAqXG4gKiBUaGlzIGlzIGEgZ3JlYXQgcGxhY2UgZm9yIHlvdXIgcGx1Z2luIHRvIGluaXRpYWxpemUgaXRzZWxmLiBXaGVuIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHBsYXllciB3aWxsIGhhdmUgaXRzIERPTSBhbmQgY2hpbGQgY29tcG9uZW50c1xuICogaW4gcGxhY2UuXG4gKlxuICogQGZ1bmN0aW9uIG9uUGxheWVyUmVhZHlcbiAqIEBwYXJhbSAgICB7UGxheWVyfSBwbGF5ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqL1xuY29uc3Qgb25QbGF5ZXJSZWFkeSA9IChwbGF5ZXIsIG9wdGlvbnMpID0+IHtcbiAgcGxheWVyLmFkZENsYXNzKCd2anMtY29uY3VycmVuY2UtbGltaXRlcicpO1xuXG4gIHBsYXllci5fY3ZQbHVnaW4gPSBuZXcgQ29uY3VycmVudFZpZXdQbHVnaW4ob3B0aW9ucywgcGxheWVyKTtcbiAgbGV0IGN2UGx1Z2luID0gcGxheWVyLl9jdlBsdWdpbjtcblxuICBjdlBsdWdpbi52YWxpZGF0ZVBsYXkoKGVycm9yLCBvaykgPT4ge1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBlcnJvcicsIGVycm9yKTtcbiAgICAgIGN2UGx1Z2luLmJsb2NrUGxheWVyKCdjYW50cGxheScsIGVycm9yKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGN2UGx1Z2luLnJlY292ZXJTdGF0dXMob2spO1xuICAgICAgLy8gbW9uaXRvclxuICAgICAgY3ZQbHVnaW4ubWFrZVdhdGNoZG9nKG9rKTtcbiAgICB9XG5cbiAgfSk7XG5cbn07XG5cbi8qKlxuICogQSB2aWRlby5qcyBwbHVnaW4uXG4gKlxuICogSW4gdGhlIHBsdWdpbiBmdW5jdGlvbiwgdGhlIHZhbHVlIG9mIGB0aGlzYCBpcyBhIHZpZGVvLmpzIGBQbGF5ZXJgXG4gKiBpbnN0YW5jZS4gWW91IGNhbm5vdCByZWx5IG9uIHRoZSBwbGF5ZXIgYmVpbmcgaW4gYSBcInJlYWR5XCIgc3RhdGUgaGVyZSxcbiAqIGRlcGVuZGluZyBvbiBob3cgdGhlIHBsdWdpbiBpcyBpbnZva2VkLiBUaGlzIG1heSBvciBtYXkgbm90IGJlIGltcG9ydGFudFxuICogdG8geW91OyBpZiBub3QsIHJlbW92ZSB0aGUgd2FpdCBmb3IgXCJyZWFkeVwiIVxuICpcbiAqIEBmdW5jdGlvbiBjb25jdXJyZW5jZUxpbWl0ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqICAgICAgICAgICBBbiBvYmplY3Qgb2Ygb3B0aW9ucyBsZWZ0IHRvIHRoZSBwbHVnaW4gYXV0aG9yIHRvIGRlZmluZS5cbiAqL1xuY29uc3QgY29uY3VycmVuY2VMaW1pdGVyID0gZnVuY3Rpb24odXNlcm9wdGlvbnMpIHtcblxuICB0aGlzLnJlYWR5KCgpID0+IHtcblxuICAgIGxldCBvcHRpb25zID0gdmlkZW9qcy5tZXJnZU9wdGlvbnMoZGVmYXVsdHMsIHVzZXJvcHRpb25zKTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXcgcGx1Z2luJywgb3B0aW9ucyk7XG5cbiAgICBpZiAoIW9wdGlvbnMuYWNjZXNzdXJsIHx8ICFvcHRpb25zLnVwZGF0ZXVybCB8fCAhb3B0aW9ucy5kaXNwb3NldXJsKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIHVybHMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuaW50ZXJ2YWwgfHwgb3B0aW9ucy5pbnRlcnZhbCA8IDUpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGludmFsaWQgb3B0aW9ucycsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9uUGxheWVyUmVhZHkodGhpcywgb3B0aW9ucyk7XG4gIH0pO1xufTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBsdWdpbiB3aXRoIHZpZGVvLmpzLlxudmlkZW9qcy5wbHVnaW4oJ2NvbmN1cnJlbmNlTGltaXRlcicsIGNvbmN1cnJlbmNlTGltaXRlcik7XG5cbi8vIEluY2x1ZGUgdGhlIHZlcnNpb24gbnVtYmVyLlxuY29uY3VycmVuY2VMaW1pdGVyLlZFUlNJT04gPSAnX19WRVJTSU9OX18nO1xuXG5leHBvcnQgZGVmYXVsdCBjb25jdXJyZW5jZUxpbWl0ZXI7XG4iXX0=

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
 * main plugin component class
 */

var ConcurrentViewPlugin = (function () {
  function ConcurrentViewPlugin(options, player) {
    _classCallCheck(this, ConcurrentViewPlugin);

    this.options = options;
    this.player = player;
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

        if (!loadedmetadata || !_this3.fistSent) {
          _this3.fistSent = true;
          return;
        }

        lasTime = Math.round(player.currentTime() || 0);
      });

      _videoJs2['default'].log('concurrence plugin: ok', ok);

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

      player.on('dispose', cleanUp);

      window.addEventListener('beforeunload', cleanUp);

      if (!watchdog) {

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9mcmFuL3dvcmtzcGFjZS92aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIvc3JjL3BsdWdpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7dUJDQW9CLFVBQVU7Ozs7O0FBRzlCLElBQU0sUUFBUSxHQUFHO0FBQ2YsVUFBUSxFQUFFLEVBQUU7QUFDWixXQUFTLEVBQUUsSUFBSTtBQUNmLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsVUFBUSxFQUFFLElBQUk7QUFDZCxlQUFhLEVBQUUsQ0FBQztDQUNqQixDQUFDOzs7Ozs7SUFLSSxvQkFBb0I7QUFFYixXQUZQLG9CQUFvQixDQUVaLE9BQU8sRUFBRSxNQUFNLEVBQUU7MEJBRnpCLG9CQUFvQjs7QUFHdEIsUUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDdkIsUUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7R0FDdEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7ZUFMRyxvQkFBb0I7O1dBY2IscUJBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7QUFDekIsMkJBQVEsR0FBRyxDQUNUO0FBQ0UsWUFBSSxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUk7QUFDeEMsV0FBRyxFQUFILEdBQUc7QUFDSCxjQUFNLEVBQUUsTUFBTTtBQUNkLGVBQU8sRUFBRTtBQUNQLHdCQUFjLEVBQUUsa0JBQWtCO1NBQ25DO09BQ0YsRUFDRCxVQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFLOztBQUVuQixZQUFJLFFBQVEsWUFBQSxDQUFDOztBQUViLFlBQUk7QUFDRixrQkFBUSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FB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QUFhLFNBQU8sT0FBTyxDQUFDLENBQUM7R0FDOUIsQ0FBQyxDQUFDO0NBQ0osQ0FBQzs7O0FBR0YscUJBQVEsTUFBTSxDQUFDLG9CQUFvQixFQUFFLGtCQUFrQixDQUFDLENBQUM7OztBQUd6RCxrQkFBa0IsQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDOztxQkFFNUIsa0JBQWtCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImltcG9ydCB2aWRlb2pzIGZyb20gJ3ZpZGVvLmpzJztcblxuLy8gRGVmYXVsdCBvcHRpb25zIGZvciB0aGUgcGx1Z2luLlxuY29uc3QgZGVmYXVsdHMgPSB7XG4gIGludGVydmFsOiAxMCxcbiAgYWNjZXNzdXJsOiBudWxsLFxuICB1cGRhdGV1cmw6IG51bGwsXG4gIGRpc3Bvc2V1cmw6IG51bGwsXG4gIHBsYXllcklEOiBudWxsLFxuICBzdGFydFBvc2l0aW9uOiAwXG59O1xuXG4vKipcbiAqIG1haW4gcGx1Z2luIGNvbXBvbmVudCBjbGFzc1xuICovXG5jbGFzcyBDb25jdXJyZW50Vmlld1BsdWdpbiB7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucywgcGxheWVyKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLnBsYXllciA9IHBsYXllcjtcbiAgfVxuXG4gIC8qKlxuICAgKiB4aHIgYWxpYXNcbiAgICpcbiAgICogQHBhcmFtIHVybFxuICAgKiBAcGFyYW0gZGF0YVxuICAgKiBAcGFyYW0gY2JcbiAgICAgKi9cbiAgbWFrZVJlcXVlc3QodXJsLCBkYXRhLCBjYikge1xuICAgIHZpZGVvanMueGhyKFxuICAgICAge1xuICAgICAgICBib2R5OiBkYXRhID8gSlNPTi5zdHJpbmdpZnkoZGF0YSkgOiAne30nLFxuICAgICAgICB1cmwsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgKGVyciwgcmVzcCwgYm9keSkgPT4ge1xuXG4gICAgICAgIGxldCBib2R5SnNvbjtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGJvZHlKc29uID0gYm9keSA/IEpTT04ucGFyc2UoYm9keSkgOiB7ZXJyb3I6ICdpbnZhbGlkIGJvZHknLCBib2R5fTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGJvZHlKc29uID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNiKGVyciA/IGVyci5tZXNzYWdlIHx8IGVyciA6IG51bGwsIGJvZHlKc29uKTtcbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIHZhbGlkYXRlcyBwbGF5ZXIgYWNjZXNzXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICB2YWxpZGF0ZVBsYXkoY2IpIHtcblxuICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICB0aGlzLm9wdGlvbnMuYWNjZXNzdXJsLFxuICAgICAge1xuICAgICAgICBwbGF5ZXI6IHRoaXMub3B0aW9ucy5wbGF5ZXJJRFxuICAgICAgfSxcbiAgICAgIChlcnJvciwgb2spID0+IHtcbiAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogY2FucGxheSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgY2IobmV3IEVycm9yKGVycm9yKSwgbnVsbCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9rICYmIG9rLnN1Y2Nlc3MpIHtcbiAgICAgICAgICBjYihudWxsLCBvayk7XG5cbiAgICAgICAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgICAgICAgIHR5cGU6ICdhdnBsYXllcmNhbnBsYXknLFxuICAgICAgICAgICAgY29kZTogMVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNiKG5ldyBFcnJvcignUGxheWVyIEF1dGggZXJyb3InKSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG4gIH1cblxuICBibG9ja1BsYXllcihjb2RlLCBlcnJvciwgcmVhc29uKSB7XG4gICAgY29kZSA9IGNvZGUgfHwgJ2Vycm9yJztcbiAgICByZWFzb24gPSByZWFzb24gfHwgJ0hhcyBhbGNhbnphZG8gbGEgY2FudGlkYWQgbWF4aW1hIGRlIHBsYXllcnMgYWN0aXZvcy4nO1xuXG4gICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogc3RvcCBwbGF5ZXIgLSAnLCByZWFzb24pO1xuXG4gICAgdGhpcy5wbGF5ZXIudHJpZ2dlcih7XG4gICAgICB0eXBlOiAnYXZwbGF5ZXJibG9rZWQnLFxuICAgICAgY29kZSxcbiAgICAgIHJlYXNvbixcbiAgICAgIGVycm9yXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsYXllci5wYXVzZSgpO1xuICAgIHRoaXMucGxheWVyLmRpc3Bvc2UoKTtcbiAgfVxuXG4gIHJlY292ZXJTdGF0dXMoaW5mbykge1xuICAgIGlmICghaW5mby5wb3NpdGlvbikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMucGxheWVyLmN1cnJlbnRUaW1lID0gaW5mby5wb3NpdGlvbjtcblxuICAgIHRoaXMucGxheWVyLm9uKCdsb2FkZWRtZXRhZGF0YScsICgpID0+IHRoaXMuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uKTtcblxuICB9XG5cbiAgLyogKioqKioqKioqKioqKiogKi9cblxuICBtYWtlV2F0Y2hkb2cob2spIHtcblxuICAgIGxldCB3YXRjaGRvZyA9IG51bGw7XG4gICAgbGV0IG9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgbGV0IHBsYXllciA9IHRoaXMucGxheWVyO1xuXG4gICAgbGV0IGxhc1RpbWUgPSBvcHRpb25zLnN0YXJ0UG9zaXRpb24gfHwgMDtcbiAgICBsZXQgcGxheWVyVG9rZW4gPSBudWxsO1xuICAgIGxldCBwbGF5ZXJJRCA9IG9wdGlvbnMucGxheWVySUQ7XG4gICAgbGV0IGxvYWRlZG1ldGFkYXRhID0gZmFsc2U7XG5cbiAgICBwbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gbG9hZGVkbWV0YWRhdGEgPSB0cnVlKTtcblxuICAgIHBsYXllci5vbigndGltZXVwZGF0ZScsIChlKSA9PiB7XG5cbiAgICAgIGlmICghbG9hZGVkbWV0YWRhdGEgfHwgIXRoaXMuZmlzdFNlbnQpIHtcbiAgICAgICAgdGhpcy5maXN0U2VudCA9IHRydWU7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGFzVGltZSA9IE1hdGgucm91bmQocGxheWVyLmN1cnJlbnRUaW1lKCkgfHwgMCk7XG4gICAgfSk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2UgcGx1Z2luOiBvaycsIG9rKTtcblxuICAgIGxldCBjbGVhblVwID0gKCkgPT4ge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogRElTUE9TRScsIG9wdGlvbnMpO1xuXG4gICAgICBpZiAod2F0Y2hkb2cpIHtcbiAgICAgICAgcGxheWVyLmNsZWFySW50ZXJ2YWwod2F0Y2hkb2cpO1xuICAgICAgICB3YXRjaGRvZyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoXG4gICAgICAgICAgb3B0aW9ucy5kaXNwb3NldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHRva2VuOiBwbGF5ZXJUb2tlbixcbiAgICAgICAgICAgIHN0YXR1czogJ3BhdXNlZCdcbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHt9XG4gICAgICAgICk7XG5cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcGxheWVyLm9uKCdkaXNwb3NlJywgY2xlYW5VcCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmVmb3JldW5sb2FkJywgY2xlYW5VcCk7XG5cbiAgICBpZiAoIXdhdGNoZG9nKSB7XG5cbiAgICAgIGxldCB3ZGYgPSAoKSA9PiB7XG5cbiAgICAgICAgcGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgIHR5cGU6ICdhdnBsYXllcnVwZGF0ZScsXG4gICAgICAgICAgcGxheWVySURcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLnVwZGF0ZXVybCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBwbGF5ZXI6IHBsYXllcklELFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgcG9zaXRpb246IGxhc1RpbWUsXG4gICAgICAgICAgICBzdGF0dXM6IHBsYXllci5wYXVzZWQoKSA/ICdwYXVzZWQnIDogJ3BsYXlpbmcnXG4gICAgICAgICAgfSxcbiAgICAgICAgICAoZXJyb3IsIHJlc3BvbnNlKSA9PiB7XG5cbiAgICAgICAgICAgIGlmIChlcnJvcikge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiB1cGRhdGUgYXBpIGVycm9yJywgZXJyb3IpO1xuICAgICAgICAgICAgICB0aGlzLmJsb2NrUGxheWVyKHBsYXllciwgJ2F1dGhhcGlmYWlsJywge21zZzogZXJyb3J9KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2Vzcykge1xuICAgICAgICAgICAgICBwbGF5ZXJJRCA9IHJlc3BvbnNlLnBsYXllciB8fCBwbGF5ZXJJRDtcbiAgICAgICAgICAgICAgcGxheWVyVG9rZW4gPSByZXNwb25zZS50b2tlbiB8fCBwbGF5ZXJUb2tlbjtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmlkZW9qcy5sb2cobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnbm9hdXRoJywgcmVzcG9uc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgIH07XG5cbiAgICAgIHdhdGNoZG9nID0gcGxheWVyLnNldEludGVydmFsKHdkZiwgb3B0aW9ucy5pbnRlcnZhbCAqIDEwMDApO1xuICAgICAgd2RmKCk7XG4gICAgfVxuXG4gIH1cblxufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBwbGF5ZXIgaXMgcmVhZHkuXG4gKlxuICogVGhpcyBpcyBhIGdyZWF0IHBsYWNlIGZvciB5b3VyIHBsdWdpbiB0byBpbml0aWFsaXplIGl0c2VsZi4gV2hlbiB0aGlzXG4gKiBmdW5jdGlvbiBpcyBjYWxsZWQsIHRoZSBwbGF5ZXIgd2lsbCBoYXZlIGl0cyBET00gYW5kIGNoaWxkIGNvbXBvbmVudHNcbiAqIGluIHBsYWNlLlxuICpcbiAqIEBmdW5jdGlvbiBvblBsYXllclJlYWR5XG4gKiBAcGFyYW0gICAge1BsYXllcn0gcGxheWVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKi9cbmNvbnN0IG9uUGxheWVyUmVhZHkgPSAocGxheWVyLCBvcHRpb25zKSA9PiB7XG4gIHBsYXllci5hZGRDbGFzcygndmpzLWNvbmN1cnJlbmNlLWxpbWl0ZXInKTtcblxuICBwbGF5ZXIuX2N2UGx1Z2luID0gbmV3IENvbmN1cnJlbnRWaWV3UGx1Z2luKG9wdGlvbnMsIHBsYXllcik7XG4gIGxldCBjdlBsdWdpbiA9IHBsYXllci5fY3ZQbHVnaW47XG5cbiAgY3ZQbHVnaW4udmFsaWRhdGVQbGF5KChlcnJvciwgb2spID0+IHtcblxuICAgIGlmIChlcnJvcikge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogZXJyb3InLCBlcnJvcik7XG4gICAgICBjdlBsdWdpbi5ibG9ja1BsYXllcignY2FudHBsYXknLCBlcnJvcik7XG5cbiAgICB9IGVsc2Uge1xuXG4gICAgICBjdlBsdWdpbi5yZWNvdmVyU3RhdHVzKG9rKTtcbiAgICAgIC8vIG1vbml0b3JcbiAgICAgIGN2UGx1Z2luLm1ha2VXYXRjaGRvZyhvayk7XG4gICAgfVxuXG4gIH0pO1xuXG59O1xuXG4vKipcbiAqIEEgdmlkZW8uanMgcGx1Z2luLlxuICpcbiAqIEluIHRoZSBwbHVnaW4gZnVuY3Rpb24sIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaXMgYSB2aWRlby5qcyBgUGxheWVyYFxuICogaW5zdGFuY2UuIFlvdSBjYW5ub3QgcmVseSBvbiB0aGUgcGxheWVyIGJlaW5nIGluIGEgXCJyZWFkeVwiIHN0YXRlIGhlcmUsXG4gKiBkZXBlbmRpbmcgb24gaG93IHRoZSBwbHVnaW4gaXMgaW52b2tlZC4gVGhpcyBtYXkgb3IgbWF5IG5vdCBiZSBpbXBvcnRhbnRcbiAqIHRvIHlvdTsgaWYgbm90LCByZW1vdmUgdGhlIHdhaXQgZm9yIFwicmVhZHlcIiFcbiAqXG4gKiBAZnVuY3Rpb24gY29uY3VycmVuY2VMaW1pdGVyXG4gKiBAcGFyYW0gICAge09iamVjdH0gW29wdGlvbnM9e31dXG4gKiAgICAgICAgICAgQW4gb2JqZWN0IG9mIG9wdGlvbnMgbGVmdCB0byB0aGUgcGx1Z2luIGF1dGhvciB0byBkZWZpbmUuXG4gKi9cbmNvbnN0IGNvbmN1cnJlbmNlTGltaXRlciA9IGZ1bmN0aW9uKHVzZXJvcHRpb25zKSB7XG5cbiAgdGhpcy5yZWFkeSgoKSA9PiB7XG5cbiAgICBsZXQgb3B0aW9ucyA9IHZpZGVvanMubWVyZ2VPcHRpb25zKGRlZmF1bHRzLCB1c2Vyb3B0aW9ucyk7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3IHBsdWdpbicsIG9wdGlvbnMpO1xuXG4gICAgaWYgKCFvcHRpb25zLmFjY2Vzc3VybCB8fCAhb3B0aW9ucy51cGRhdGV1cmwgfHwgIW9wdGlvbnMuZGlzcG9zZXVybCkge1xuICAgICAgdmlkZW9qcy5sb2coJ2NvbmN1cnJlbmNldmlldzogaW52YWxpZCB1cmxzJywgb3B0aW9ucyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zLmludGVydmFsIHx8IG9wdGlvbnMuaW50ZXJ2YWwgPCA1KSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIG9wdGlvbnMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBvblBsYXllclJlYWR5KHRoaXMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIFJlZ2lzdGVyIHRoZSBwbHVnaW4gd2l0aCB2aWRlby5qcy5cbnZpZGVvanMucGx1Z2luKCdjb25jdXJyZW5jZUxpbWl0ZXInLCBjb25jdXJyZW5jZUxpbWl0ZXIpO1xuXG4vLyBJbmNsdWRlIHRoZSB2ZXJzaW9uIG51bWJlci5cbmNvbmN1cnJlbmNlTGltaXRlci5WRVJTSU9OID0gJ19fVkVSU0lPTl9fJztcblxuZXhwb3J0IGRlZmF1bHQgY29uY3VycmVuY2VMaW1pdGVyO1xuIl19

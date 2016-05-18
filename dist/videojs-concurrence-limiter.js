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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9mcmFuL3dvcmtzcGFjZS92aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIvc3JjL3BsdWdpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7dUJDQW9CLFVBQVU7Ozs7O0FBRzlCLElBQU0sUUFBUSxHQUFHO0FBQ2YsVUFBUSxFQUFFLEVBQUU7QUFDWixXQUFTLEVBQUUsSUFBSTtBQUNmLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsVUFBUSxFQUFFLElBQUk7QUFDZCxlQUFhLEVBQUUsQ0FBQztDQUNqQixDQUFDOzs7Ozs7SUFLSSxvQkFBb0I7QUFFYixXQUZQLG9CQUFvQixDQUVaLE9BQU8sRUFBRSxNQUFNLEVBQUU7MEJBRnpCLG9CQUFvQjs7QUFHdEIsUUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDdkIsUUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7R0FDdEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7ZUFMRyxvQkFBb0I7O1dBY2IscUJBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUU7QUFDekIsMkJBQVEsR0FBRyxDQUNUO0FBQ0UsWUFBSSxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUk7QUFDeEMsV0FBRyxFQUFILEdBQUc7QUFDSCxjQUFNLEVBQUUsTUFBTTtBQUNkLGVBQU8sRUFBRTtBQUNQLHdCQUFjLEVBQUUsa0JBQWtCO1NBQ25DO09BQ0YsRUFDRCxVQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFLOztBQUVuQixZQUFJLFFBQVEsWUFBQSxDQUFDOztBQUViLFlBQUk7QUFDRixrQkFBUSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FB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QUFPLE9BQU8sQ0FBQyxDQUFDO0dBQzlCLENBQUMsQ0FBQztDQUNKLENBQUM7OztBQUdGLHFCQUFRLE1BQU0sQ0FBQyxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDOzs7QUFHekQsa0JBQWtCLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQzs7cUJBRTVCLGtCQUFrQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJpbXBvcnQgdmlkZW9qcyBmcm9tICd2aWRlby5qcyc7XG5cbi8vIERlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIHBsdWdpbi5cbmNvbnN0IGRlZmF1bHRzID0ge1xuICBpbnRlcnZhbDogMTAsXG4gIGFjY2Vzc3VybDogbnVsbCxcbiAgdXBkYXRldXJsOiBudWxsLFxuICBkaXNwb3NldXJsOiBudWxsLFxuICBwbGF5ZXJJRDogbnVsbCxcbiAgc3RhcnRQb3NpdGlvbjogMFxufTtcblxuLyoqXG4gKiBtYWluIHBsdWdpbiBjb21wb25lbnQgY2xhc3NcbiAqL1xuY2xhc3MgQ29uY3VycmVudFZpZXdQbHVnaW4ge1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMsIHBsYXllcikge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5wbGF5ZXIgPSBwbGF5ZXI7XG4gIH1cblxuICAvKipcbiAgICogeGhyIGFsaWFzXG4gICAqXG4gICAqIEBwYXJhbSB1cmxcbiAgICogQHBhcmFtIGRhdGFcbiAgICogQHBhcmFtIGNiXG4gICAgICovXG4gIG1ha2VSZXF1ZXN0KHVybCwgZGF0YSwgY2IpIHtcbiAgICB2aWRlb2pzLnhocihcbiAgICAgIHtcbiAgICAgICAgYm9keTogZGF0YSA/IEpTT04uc3RyaW5naWZ5KGRhdGEpIDogJ3t9JyxcbiAgICAgICAgdXJsLFxuICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIChlcnIsIHJlc3AsIGJvZHkpID0+IHtcblxuICAgICAgICBsZXQgYm9keUpzb247XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBib2R5SnNvbiA9IGJvZHkgPyBKU09OLnBhcnNlKGJvZHkpIDoge2Vycm9yOiAnaW52YWxpZCBib2R5JywgYm9keX07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBib2R5SnNvbiA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjYihlcnIgPyBlcnIubWVzc2FnZSB8fCBlcnIgOiBudWxsLCBib2R5SnNvbik7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHZhbGlkYXRlUGxheShjYikge1xuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgIHRoaXMub3B0aW9ucy5hY2Nlc3N1cmwsXG4gICAgICB7XG4gICAgICAgIHBsYXllcjogdGhpcy5vcHRpb25zLnBsYXllcklEXG4gICAgICB9LFxuICAgICAgKGVycm9yLCBvaykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBjYW5wbGF5IGFwaSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICBjYihuZXcgRXJyb3IoZXJyb3IpLCBudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2sgJiYgb2suc3VjY2Vzcykge1xuICAgICAgICAgIGNiKG51bGwsIG9rKTtcblxuICAgICAgICAgIHRoaXMucGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgICAgdHlwZTogJ2F2cGxheWVyY2FucGxheScsXG4gICAgICAgICAgICBjb2RlOiAxXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cbiAgfVxuXG4gIGJsb2NrUGxheWVyKGNvZGUsIGVycm9yLCByZWFzb24pIHtcbiAgICBjb2RlID0gY29kZSB8fCAnZXJyb3InO1xuICAgIHJlYXNvbiA9IHJlYXNvbiB8fCAnSGFzIGFsY2FuemFkbyBsYSBjYW50aWRhZCBtYXhpbWEgZGUgcGxheWVycyBhY3Rpdm9zLic7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBzdG9wIHBsYXllciAtICcsIHJlYXNvbik7XG5cbiAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgIHR5cGU6ICdhdnBsYXllcmJsb2tlZCcsXG4gICAgICBjb2RlLFxuICAgICAgcmVhc29uLFxuICAgICAgZXJyb3JcbiAgICB9KTtcblxuICAgIHRoaXMucGxheWVyLnBhdXNlKCk7XG4gICAgdGhpcy5wbGF5ZXIuZGlzcG9zZSgpO1xuICB9XG5cbiAgcmVjb3ZlclN0YXR1cyhpbmZvKSB7XG4gICAgaWYgKCFpbmZvLnBvc2l0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wbGF5ZXIuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uO1xuXG4gICAgdGhpcy5wbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gdGhpcy5jdXJyZW50VGltZSA9IGluZm8ucG9zaXRpb24pO1xuXG4gIH1cblxuICAvKiAqKioqKioqKioqKioqKiAqL1xuXG4gIG1ha2VXYXRjaGRvZyhvaykge1xuXG4gICAgbGV0IHdhdGNoZG9nID0gbnVsbDtcbiAgICBsZXQgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBsZXQgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG5cbiAgICBsZXQgbGFzVGltZSA9IG9wdGlvbnMuc3RhcnRQb3NpdGlvbiB8fCAwO1xuICAgIGxldCBwbGF5ZXJUb2tlbiA9IG51bGw7XG4gICAgbGV0IHBsYXllcklEID0gb3B0aW9ucy5wbGF5ZXJJRDtcbiAgICBsZXQgbG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcblxuICAgIHBsYXllci5vbignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiBsb2FkZWRtZXRhZGF0YSA9IHRydWUpO1xuXG4gICAgcGxheWVyLm9uKCd0aW1ldXBkYXRlJywgKGUpID0+IHtcblxuICAgICAgaWYgKCFsb2FkZWRtZXRhZGF0YSB8fCAhdGhpcy5maXN0U2VudCkge1xuICAgICAgICB0aGlzLmZpc3RTZW50ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsYXNUaW1lID0gTWF0aC5yb3VuZChwbGF5ZXIuY3VycmVudFRpbWUoKSB8fCAwKTtcbiAgICB9KTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZSBwbHVnaW46IG9rJywgb2spO1xuXG4gICAgbGV0IGNsZWFuVXAgPSAoKSA9PiB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBESVNQT1NFJywgb3B0aW9ucyk7XG5cbiAgICAgIGlmICh3YXRjaGRvZykge1xuICAgICAgICBwbGF5ZXIuY2xlYXJJbnRlcnZhbCh3YXRjaGRvZyk7XG4gICAgICAgIHdhdGNoZG9nID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLmRpc3Bvc2V1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgc3RhdHVzOiAncGF1c2VkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKCkgPT4ge31cbiAgICAgICAgKTtcblxuICAgICAgfVxuICAgIH07XG5cbiAgICBwbGF5ZXIub24oJ2Rpc3Bvc2UnLCBjbGVhblVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBjbGVhblVwKTtcblxuICAgIGlmICghd2F0Y2hkb2cpIHtcblxuICAgICAgbGV0IHdkZiA9ICgpID0+IHtcblxuICAgICAgICBwbGF5ZXIudHJpZ2dlcih7XG4gICAgICAgICAgdHlwZTogJ2F2cGxheWVydXBkYXRlJyxcbiAgICAgICAgICBwbGF5ZXJJRFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KFxuICAgICAgICAgIG9wdGlvbnMudXBkYXRldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICB0b2tlbjogcGxheWVyVG9rZW4sXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHN0YXR1czogcGxheWVyLnBhdXNlZCgpID8gJ3BhdXNlZCcgOiAncGxheWluZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIChlcnJvciwgcmVzcG9uc2UpID0+IHtcblxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IHVwZGF0ZSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnYXV0aGFwaWZhaWwnLCB7bXNnOiBlcnJvcn0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHBsYXllcklEID0gcmVzcG9uc2UucGxheWVyIHx8IHBsYXllcklEO1xuICAgICAgICAgICAgICBwbGF5ZXJUb2tlbiA9IHJlc3BvbnNlLnRva2VuIHx8IHBsYXllclRva2VuO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZyhuZXcgRXJyb3IoJ1BsYXllciBBdXRoIGVycm9yJyksIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgdGhpcy5ibG9ja1BsYXllcihwbGF5ZXIsICdub2F1dGgnLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcblxuICAgICAgd2F0Y2hkb2cgPSBwbGF5ZXIuc2V0SW50ZXJ2YWwod2RmLCBvcHRpb25zLmludGVydmFsICogMTAwMCk7XG4gICAgICB3ZGYoKTtcbiAgICB9XG5cbiAgfVxuXG59XG5cbi8qKlxuICogRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHBsYXllciBpcyByZWFkeS5cbiAqXG4gKiBUaGlzIGlzIGEgZ3JlYXQgcGxhY2UgZm9yIHlvdXIgcGx1Z2luIHRvIGluaXRpYWxpemUgaXRzZWxmLiBXaGVuIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHBsYXllciB3aWxsIGhhdmUgaXRzIERPTSBhbmQgY2hpbGQgY29tcG9uZW50c1xuICogaW4gcGxhY2UuXG4gKlxuICogQGZ1bmN0aW9uIG9uUGxheWVyUmVhZHlcbiAqIEBwYXJhbSAgICB7UGxheWVyfSBwbGF5ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqL1xuY29uc3Qgb25QbGF5ZXJSZWFkeSA9IChwbGF5ZXIsIG9wdGlvbnMpID0+IHtcbiAgcGxheWVyLmFkZENsYXNzKCd2anMtY29uY3VycmVuY2UtbGltaXRlcicpO1xuXG4gIHBsYXllci5fY3ZQbHVnaW4gPSBuZXcgQ29uY3VycmVudFZpZXdQbHVnaW4ob3B0aW9ucywgcGxheWVyKTtcbiAgbGV0IGN2UGx1Z2luID0gcGxheWVyLl9jdlBsdWdpbjtcblxuICBjdlBsdWdpbi52YWxpZGF0ZVBsYXkoKGVycm9yLCBvaykgPT4ge1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBlcnJvcicsIGVycm9yKTtcbiAgICAgIGN2UGx1Z2luLmJsb2NrUGxheWVyKCdjYW50cGxheScsIGVycm9yKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGN2UGx1Z2luLnJlY292ZXJTdGF0dXMob2spO1xuICAgICAgLy8gbW9uaXRvclxuICAgICAgY3ZQbHVnaW4ubWFrZVdhdGNoZG9nKG9rKTtcbiAgICB9XG5cbiAgfSk7XG5cbn07XG5cbi8qKlxuICogQSB2aWRlby5qcyBwbHVnaW4uXG4gKlxuICogSW4gdGhlIHBsdWdpbiBmdW5jdGlvbiwgdGhlIHZhbHVlIG9mIGB0aGlzYCBpcyBhIHZpZGVvLmpzIGBQbGF5ZXJgXG4gKiBpbnN0YW5jZS4gWW91IGNhbm5vdCByZWx5IG9uIHRoZSBwbGF5ZXIgYmVpbmcgaW4gYSBcInJlYWR5XCIgc3RhdGUgaGVyZSxcbiAqIGRlcGVuZGluZyBvbiBob3cgdGhlIHBsdWdpbiBpcyBpbnZva2VkLiBUaGlzIG1heSBvciBtYXkgbm90IGJlIGltcG9ydGFudFxuICogdG8geW91OyBpZiBub3QsIHJlbW92ZSB0aGUgd2FpdCBmb3IgXCJyZWFkeVwiIVxuICpcbiAqIEBmdW5jdGlvbiBjb25jdXJyZW5jZUxpbWl0ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqICAgICAgICAgICBBbiBvYmplY3Qgb2Ygb3B0aW9ucyBsZWZ0IHRvIHRoZSBwbHVnaW4gYXV0aG9yIHRvIGRlZmluZS5cbiAqL1xuY29uc3QgY29uY3VycmVuY2VMaW1pdGVyID0gZnVuY3Rpb24odXNlcm9wdGlvbnMpIHtcblxuICB0aGlzLnJlYWR5KCgpID0+IHtcblxuICAgIGxldCBvcHRpb25zID0gdmlkZW9qcy5tZXJnZU9wdGlvbnMoZGVmYXVsdHMsIHVzZXJvcHRpb25zKTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXcgcGx1Z2luJywgb3B0aW9ucyk7XG5cbiAgICBpZiAoIW9wdGlvbnMuYWNjZXNzdXJsIHx8ICFvcHRpb25zLnVwZGF0ZXVybCB8fCAhb3B0aW9ucy5kaXNwb3NldXJsKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIHVybHMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuaW50ZXJ2YWwgfHwgb3B0aW9ucy5pbnRlcnZhbCA8IDUpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGludmFsaWQgb3B0aW9ucycsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9uUGxheWVyUmVhZHkodGhpcywgb3B0aW9ucyk7XG4gIH0pO1xufTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBsdWdpbiB3aXRoIHZpZGVvLmpzLlxudmlkZW9qcy5wbHVnaW4oJ2NvbmN1cnJlbmNlTGltaXRlcicsIGNvbmN1cnJlbmNlTGltaXRlcik7XG5cbi8vIEluY2x1ZGUgdGhlIHZlcnNpb24gbnVtYmVyLlxuY29uY3VycmVuY2VMaW1pdGVyLlZFUlNJT04gPSAnX19WRVJTSU9OX18nO1xuXG5leHBvcnQgZGVmYXVsdCBjb25jdXJyZW5jZUxpbWl0ZXI7XG4iXX0=

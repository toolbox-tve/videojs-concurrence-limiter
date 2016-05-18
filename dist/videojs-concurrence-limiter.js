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

  _createClass(ConcurrentViewIdMaker, [{
    key: 'generate',
    value: function generate(options) {

      //user-made id
      if (options.playerID) {
        return options.playerID;
      }

      return this.generateBySessionStorage() || 'rdm-' + this.generateRandom();
    }
  }, {
    key: 'generateRandom',
    value: function generateRandom(len) {
      return Math.random().toString((len || 30) + 2).substr(2);
    }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9mcmFuL3dvcmtzcGFjZS92aWRlb2pzLWNvbmN1cnJlbmNlLWxpbWl0ZXIvc3JjL3BsdWdpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7Ozs7Ozs7dUJDQW9CLFVBQVU7Ozs7O0FBRzlCLElBQU0sUUFBUSxHQUFHO0FBQ2YsVUFBUSxFQUFFLEVBQUU7QUFDWixXQUFTLEVBQUUsSUFBSTtBQUNmLFdBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBVSxFQUFFLElBQUk7QUFDaEIsVUFBUSxFQUFFLElBQUk7QUFDZCxlQUFhLEVBQUUsQ0FBQztDQUNqQixDQUFDOzs7Ozs7SUFLSSxxQkFBcUI7QUFFZCxXQUZQLHFCQUFxQixHQUVYOzBCQUZWLHFCQUFxQjs7QUFHdkIsUUFBSSxDQUFDLGlCQUFpQixHQUFHLGVBQWUsQ0FBQztHQUMxQzs7Ozs7O2VBSkcscUJBQXFCOztXQU1qQixrQkFBQyxPQUFPLEVBQUU7OztBQUdoQixVQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUU7QUFDbkIsZUFBTyxPQUFPLENBQUMsUUFBUSxDQUFDO09BQ3pCOztBQUVELGFBQU8sSUFBSSxDQUFDLHdCQUF3QixFQUFFLElBQUssTUFBTSxHQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsQUFBQyxDQUFDO0tBQzFFOzs7V0FFYSx3QkFBQyxHQUFHLEVBQUU7QUFDbEIsYUFBTyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFFLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQSxHQUFJLENBQUMsQ0FBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUM1RDs7O1dBR3VCLG9DQUFHOztBQUV6QixVQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRTtBQUMxQixlQUFPLElBQUksQ0FBQztPQUNiOztBQUVELFVBQUksRUFBRSxHQUFHLE1B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QixDQUFDLENBQUM7Q0FDSixDQUFDOzs7QUFHRixxQkFBUSxNQUFNLENBQUMsb0JBQW9CLEVBQUUsa0JBQWtCLENBQUMsQ0FBQzs7O0FBR3pELGtCQUFrQixDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUM7O3FCQUU1QixrQkFBa0IiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiaW1wb3J0IHZpZGVvanMgZnJvbSAndmlkZW8uanMnO1xuXG4vLyBEZWZhdWx0IG9wdGlvbnMgZm9yIHRoZSBwbHVnaW4uXG5jb25zdCBkZWZhdWx0cyA9IHtcbiAgaW50ZXJ2YWw6IDEwLFxuICBhY2Nlc3N1cmw6IG51bGwsXG4gIHVwZGF0ZXVybDogbnVsbCxcbiAgZGlzcG9zZXVybDogbnVsbCxcbiAgcGxheWVySUQ6IG51bGwsXG4gIHN0YXJ0UG9zaXRpb246IDBcbn07XG5cbi8qKlxuICogY3JlYXRlcyBwbGF5ZXIgaWRzXG4gKi9cbmNsYXNzIENvbmN1cnJlbnRWaWV3SWRNYWtlciB7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5zZXNzaW9uU3RvcmFnZUtleSA9ICd2Y2wtcGxheWVyLWlkJztcbiAgfVxuXG4gIGdlbmVyYXRlKG9wdGlvbnMpIHtcblxuICAgIC8vdXNlci1tYWRlIGlkXG4gICAgaWYob3B0aW9ucy5wbGF5ZXJJRCkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMucGxheWVySUQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ2VuZXJhdGVCeVNlc3Npb25TdG9yYWdlKCkgfHwgKCdyZG0tJyt0aGlzLmdlbmVyYXRlUmFuZG9tKCkpO1xuICB9XG5cbiAgZ2VuZXJhdGVSYW5kb20obGVuKSB7XG4gICAgcmV0dXJuIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIChsZW4gfHwgMzApICsgMiApLnN1YnN0cigyKTtcbiAgfVxuXG5cbiAgZ2VuZXJhdGVCeVNlc3Npb25TdG9yYWdlKCkge1xuXG4gICAgaWYgKCF3aW5kb3cuc2Vzc2lvblN0b3JhZ2UpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCBpZCA9IHdpbmRvdy5zZXNzaW9uU3RvcmFnZS5nZXRJdGVtKHRoaXMuc2Vzc2lvblN0b3JhZ2VLZXkpO1xuXG4gICAgaWYgKCFpZCkge1xuICAgICAgaWQgPSAnc3NpLScrdGhpcy5nZW5lcmF0ZVJhbmRvbSgpO1xuICAgICAgd2luZG93LnNlc3Npb25TdG9yYWdlLnNldEl0ZW0odGhpcy5zZXNzaW9uU3RvcmFnZUtleSwgaWQpO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG59XG5cbi8qKlxuICogbWFpbiBwbHVnaW4gY29tcG9uZW50IGNsYXNzXG4gKi9cbmNsYXNzIENvbmN1cnJlbnRWaWV3UGx1Z2luIHtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zLCBwbGF5ZXIpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMucGxheWVyID0gcGxheWVyO1xuXG4gICAgdGhpcy5vcHRpb25zLnBsYXllcklEID0gbmV3IENvbmN1cnJlbnRWaWV3SWRNYWtlcigpLmdlbmVyYXRlKG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIHhociBhbGlhc1xuICAgKlxuICAgKiBAcGFyYW0gdXJsXG4gICAqIEBwYXJhbSBkYXRhXG4gICAqIEBwYXJhbSBjYlxuICAgICAqL1xuICBtYWtlUmVxdWVzdCh1cmwsIGRhdGEsIGNiKSB7XG4gICAgdmlkZW9qcy54aHIoXG4gICAgICB7XG4gICAgICAgIGJvZHk6IGRhdGEgPyBKU09OLnN0cmluZ2lmeShkYXRhKSA6ICd7fScsXG4gICAgICAgIHVybCxcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAoZXJyLCByZXNwLCBib2R5KSA9PiB7XG5cbiAgICAgICAgbGV0IGJvZHlKc29uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYm9keUpzb24gPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHtlcnJvcjogJ2ludmFsaWQgYm9keScsIGJvZHl9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgYm9keUpzb24gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY2IoZXJyID8gZXJyLm1lc3NhZ2UgfHwgZXJyIDogbnVsbCwgYm9keUpzb24pO1xuICAgICAgfVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogdmFsaWRhdGVzIHBsYXllciBhY2Nlc3NcbiAgICogQHBhcmFtIGNiXG4gICAgICovXG4gIHZhbGlkYXRlUGxheShjYikge1xuXG4gICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgIHRoaXMub3B0aW9ucy5hY2Nlc3N1cmwsXG4gICAgICB7XG4gICAgICAgIHBsYXllcjogdGhpcy5vcHRpb25zLnBsYXllcklEXG4gICAgICB9LFxuICAgICAgKGVycm9yLCBvaykgPT4ge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBjYW5wbGF5IGFwaSBlcnJvcicsIGVycm9yKTtcbiAgICAgICAgICBjYihuZXcgRXJyb3IoZXJyb3IpLCBudWxsKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2sgJiYgb2suc3VjY2Vzcykge1xuICAgICAgICAgIGNiKG51bGwsIG9rKTtcblxuICAgICAgICAgIHRoaXMucGxheWVyLnRyaWdnZXIoe1xuICAgICAgICAgICAgdHlwZTogJ2F2cGxheWVyY2FucGxheScsXG4gICAgICAgICAgICBjb2RlOiAxXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2IobmV3IEVycm9yKCdQbGF5ZXIgQXV0aCBlcnJvcicpLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cbiAgfVxuXG4gIGJsb2NrUGxheWVyKGNvZGUsIGVycm9yLCByZWFzb24pIHtcbiAgICBjb2RlID0gY29kZSB8fCAnZXJyb3InO1xuICAgIHJlYXNvbiA9IHJlYXNvbiB8fCAnSGFzIGFsY2FuemFkbyBsYSBjYW50aWRhZCBtYXhpbWEgZGUgcGxheWVycyBhY3Rpdm9zLic7XG5cbiAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBzdG9wIHBsYXllciAtICcsIHJlYXNvbik7XG5cbiAgICB0aGlzLnBsYXllci50cmlnZ2VyKHtcbiAgICAgIHR5cGU6ICdhdnBsYXllcmJsb2tlZCcsXG4gICAgICBjb2RlLFxuICAgICAgcmVhc29uLFxuICAgICAgZXJyb3JcbiAgICB9KTtcblxuICAgIHRoaXMucGxheWVyLnBhdXNlKCk7XG4gICAgdGhpcy5wbGF5ZXIuZGlzcG9zZSgpO1xuICB9XG5cbiAgcmVjb3ZlclN0YXR1cyhpbmZvKSB7XG4gICAgaWYgKCFpbmZvLnBvc2l0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wbGF5ZXIuY3VycmVudFRpbWUgPSBpbmZvLnBvc2l0aW9uO1xuXG4gICAgdGhpcy5wbGF5ZXIub24oJ2xvYWRlZG1ldGFkYXRhJywgKCkgPT4gdGhpcy5jdXJyZW50VGltZSA9IGluZm8ucG9zaXRpb24pO1xuXG4gIH1cblxuICAvKiAqKioqKioqKioqKioqKiAqL1xuXG4gIG1ha2VXYXRjaGRvZyhvaykge1xuXG4gICAgbGV0IHdhdGNoZG9nID0gbnVsbDtcbiAgICBsZXQgb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICBsZXQgcGxheWVyID0gdGhpcy5wbGF5ZXI7XG5cbiAgICBsZXQgbGFzVGltZSA9IG9wdGlvbnMuc3RhcnRQb3NpdGlvbiB8fCAwO1xuICAgIGxldCBwbGF5ZXJUb2tlbiA9IG51bGw7XG4gICAgbGV0IHBsYXllcklEID0gb3B0aW9ucy5wbGF5ZXJJRDtcbiAgICBsZXQgbG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcblxuICAgIHBsYXllci5vbignbG9hZGVkbWV0YWRhdGEnLCAoKSA9PiBsb2FkZWRtZXRhZGF0YSA9IHRydWUpO1xuXG4gICAgcGxheWVyLm9uKCd0aW1ldXBkYXRlJywgKGUpID0+IHtcblxuICAgICAgaWYgKCFsb2FkZWRtZXRhZGF0YSB8fCAhdGhpcy5maXN0U2VudCkge1xuICAgICAgICB0aGlzLmZpc3RTZW50ID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBsYXNUaW1lID0gTWF0aC5yb3VuZChwbGF5ZXIuY3VycmVudFRpbWUoKSB8fCAwKTtcbiAgICB9KTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZSBwbHVnaW46IG9rJywgb2spO1xuXG4gICAgbGV0IGNsZWFuVXAgPSAoKSA9PiB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBESVNQT1NFJywgb3B0aW9ucyk7XG5cbiAgICAgIGlmICh3YXRjaGRvZykge1xuICAgICAgICBwbGF5ZXIuY2xlYXJJbnRlcnZhbCh3YXRjaGRvZyk7XG4gICAgICAgIHdhdGNoZG9nID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5tYWtlUmVxdWVzdChcbiAgICAgICAgICBvcHRpb25zLmRpc3Bvc2V1cmwsXG4gICAgICAgICAge1xuICAgICAgICAgICAgcGxheWVyOiBwbGF5ZXJJRCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiBsYXNUaW1lLFxuICAgICAgICAgICAgdG9rZW46IHBsYXllclRva2VuLFxuICAgICAgICAgICAgc3RhdHVzOiAncGF1c2VkJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAgKCkgPT4ge31cbiAgICAgICAgKTtcblxuICAgICAgfVxuICAgIH07XG5cbiAgICBwbGF5ZXIub24oJ2Rpc3Bvc2UnLCBjbGVhblVwKTtcblxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdiZWZvcmV1bmxvYWQnLCBjbGVhblVwKTtcblxuICAgIGlmICghd2F0Y2hkb2cpIHtcblxuICAgICAgbGV0IHdkZiA9ICgpID0+IHtcblxuICAgICAgICBwbGF5ZXIudHJpZ2dlcih7XG4gICAgICAgICAgdHlwZTogJ2F2cGxheWVydXBkYXRlJyxcbiAgICAgICAgICBwbGF5ZXJJRFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KFxuICAgICAgICAgIG9wdGlvbnMudXBkYXRldXJsLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHBsYXllcjogcGxheWVySUQsXG4gICAgICAgICAgICB0b2tlbjogcGxheWVyVG9rZW4sXG4gICAgICAgICAgICBwb3NpdGlvbjogbGFzVGltZSxcbiAgICAgICAgICAgIHN0YXR1czogcGxheWVyLnBhdXNlZCgpID8gJ3BhdXNlZCcgOiAncGxheWluZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIChlcnJvciwgcmVzcG9uc2UpID0+IHtcblxuICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IHVwZGF0ZSBhcGkgZXJyb3InLCBlcnJvcik7XG4gICAgICAgICAgICAgIHRoaXMuYmxvY2tQbGF5ZXIocGxheWVyLCAnYXV0aGFwaWZhaWwnLCB7bXNnOiBlcnJvcn0pO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgIHBsYXllcklEID0gcmVzcG9uc2UucGxheWVyIHx8IHBsYXllcklEO1xuICAgICAgICAgICAgICBwbGF5ZXJUb2tlbiA9IHJlc3BvbnNlLnRva2VuIHx8IHBsYXllclRva2VuO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2aWRlb2pzLmxvZyhuZXcgRXJyb3IoJ1BsYXllciBBdXRoIGVycm9yJyksIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgdGhpcy5ibG9ja1BsYXllcihwbGF5ZXIsICdub2F1dGgnLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgfTtcblxuICAgICAgd2F0Y2hkb2cgPSBwbGF5ZXIuc2V0SW50ZXJ2YWwod2RmLCBvcHRpb25zLmludGVydmFsICogMTAwMCk7XG4gICAgICB3ZGYoKTtcbiAgICB9XG5cbiAgfVxuXG59XG5cbi8qKlxuICogRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHBsYXllciBpcyByZWFkeS5cbiAqXG4gKiBUaGlzIGlzIGEgZ3JlYXQgcGxhY2UgZm9yIHlvdXIgcGx1Z2luIHRvIGluaXRpYWxpemUgaXRzZWxmLiBXaGVuIHRoaXNcbiAqIGZ1bmN0aW9uIGlzIGNhbGxlZCwgdGhlIHBsYXllciB3aWxsIGhhdmUgaXRzIERPTSBhbmQgY2hpbGQgY29tcG9uZW50c1xuICogaW4gcGxhY2UuXG4gKlxuICogQGZ1bmN0aW9uIG9uUGxheWVyUmVhZHlcbiAqIEBwYXJhbSAgICB7UGxheWVyfSBwbGF5ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqL1xuY29uc3Qgb25QbGF5ZXJSZWFkeSA9IChwbGF5ZXIsIG9wdGlvbnMpID0+IHtcbiAgcGxheWVyLmFkZENsYXNzKCd2anMtY29uY3VycmVuY2UtbGltaXRlcicpO1xuXG4gIHBsYXllci5fY3ZQbHVnaW4gPSBuZXcgQ29uY3VycmVudFZpZXdQbHVnaW4ob3B0aW9ucywgcGxheWVyKTtcbiAgbGV0IGN2UGx1Z2luID0gcGxheWVyLl9jdlBsdWdpbjtcblxuICBjdlBsdWdpbi52YWxpZGF0ZVBsYXkoKGVycm9yLCBvaykgPT4ge1xuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBlcnJvcicsIGVycm9yKTtcbiAgICAgIGN2UGx1Z2luLmJsb2NrUGxheWVyKCdjYW50cGxheScsIGVycm9yKTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGN2UGx1Z2luLnJlY292ZXJTdGF0dXMob2spO1xuICAgICAgLy8gbW9uaXRvclxuICAgICAgY3ZQbHVnaW4ubWFrZVdhdGNoZG9nKG9rKTtcbiAgICB9XG5cbiAgfSk7XG5cbn07XG5cbi8qKlxuICogQSB2aWRlby5qcyBwbHVnaW4uXG4gKlxuICogSW4gdGhlIHBsdWdpbiBmdW5jdGlvbiwgdGhlIHZhbHVlIG9mIGB0aGlzYCBpcyBhIHZpZGVvLmpzIGBQbGF5ZXJgXG4gKiBpbnN0YW5jZS4gWW91IGNhbm5vdCByZWx5IG9uIHRoZSBwbGF5ZXIgYmVpbmcgaW4gYSBcInJlYWR5XCIgc3RhdGUgaGVyZSxcbiAqIGRlcGVuZGluZyBvbiBob3cgdGhlIHBsdWdpbiBpcyBpbnZva2VkLiBUaGlzIG1heSBvciBtYXkgbm90IGJlIGltcG9ydGFudFxuICogdG8geW91OyBpZiBub3QsIHJlbW92ZSB0aGUgd2FpdCBmb3IgXCJyZWFkeVwiIVxuICpcbiAqIEBmdW5jdGlvbiBjb25jdXJyZW5jZUxpbWl0ZXJcbiAqIEBwYXJhbSAgICB7T2JqZWN0fSBbb3B0aW9ucz17fV1cbiAqICAgICAgICAgICBBbiBvYmplY3Qgb2Ygb3B0aW9ucyBsZWZ0IHRvIHRoZSBwbHVnaW4gYXV0aG9yIHRvIGRlZmluZS5cbiAqL1xuY29uc3QgY29uY3VycmVuY2VMaW1pdGVyID0gZnVuY3Rpb24odXNlcm9wdGlvbnMpIHtcblxuICB0aGlzLnJlYWR5KCgpID0+IHtcblxuICAgIGxldCBvcHRpb25zID0gdmlkZW9qcy5tZXJnZU9wdGlvbnMoZGVmYXVsdHMsIHVzZXJvcHRpb25zKTtcblxuICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXcgcGx1Z2luJywgb3B0aW9ucyk7XG5cbiAgICBpZiAoIW9wdGlvbnMuYWNjZXNzdXJsIHx8ICFvcHRpb25zLnVwZGF0ZXVybCB8fCAhb3B0aW9ucy5kaXNwb3NldXJsKSB7XG4gICAgICB2aWRlb2pzLmxvZygnY29uY3VycmVuY2V2aWV3OiBpbnZhbGlkIHVybHMnLCBvcHRpb25zKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuaW50ZXJ2YWwgfHwgb3B0aW9ucy5pbnRlcnZhbCA8IDUpIHtcbiAgICAgIHZpZGVvanMubG9nKCdjb25jdXJyZW5jZXZpZXc6IGludmFsaWQgb3B0aW9ucycsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG9uUGxheWVyUmVhZHkodGhpcywgb3B0aW9ucyk7XG4gIH0pO1xufTtcblxuLy8gUmVnaXN0ZXIgdGhlIHBsdWdpbiB3aXRoIHZpZGVvLmpzLlxudmlkZW9qcy5wbHVnaW4oJ2NvbmN1cnJlbmNlTGltaXRlcicsIGNvbmN1cnJlbmNlTGltaXRlcik7XG5cbi8vIEluY2x1ZGUgdGhlIHZlcnNpb24gbnVtYmVyLlxuY29uY3VycmVuY2VMaW1pdGVyLlZFUlNJT04gPSAnX19WRVJTSU9OX18nO1xuXG5leHBvcnQgZGVmYXVsdCBjb25jdXJyZW5jZUxpbWl0ZXI7XG4iXX0=

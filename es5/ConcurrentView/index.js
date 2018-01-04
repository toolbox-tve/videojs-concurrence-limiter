'use strict';
/**
 * ConcurrentView class
 *
 * @file index.js
 * @module ConcurrentView
 */
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

var _utils = require('../utils');

/**
* main plugin component class
*/

var ConcurrentViewPlugin = (function () {
  function ConcurrentViewPlugin(options, player) {
    _classCallCheck(this, ConcurrentViewPlugin);

    this.options = options;
    this.player = player;
    this.eventsFlags = {};
    this.updateFailsCount = 1;

    this.playerToken = null;
    this.startDate = null;
  }

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
        player: this.options.playerID || ''
      }, function (error, ok) {
        if (error) {
          (0, _utils.log)('accessurl api error', error);

          if (_this2.updateFailsCount >= _this2.options.maxUpdateFails) {
            cb(new Error(error), null);
          } else {

            (0, _utils.log)('accessurl retry', _this2.updateFailsCount, _this2.options.maxUpdateFails);

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
            type: 'tbxplayercanplay',
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
      var _this3 = this;

      code = code || 'error';
      reason = reason || 'Has alcanzado la cantidad maxima de players activos.';

      (0, _utils.log)('stop player - ', reason);

      this.player.trigger({
        type: 'tbxplayerblocked',
        code: code,
        reason: reason,
        error: error
      });

      this.player.pause();
      this.player.dispose();

      if (this.options.showAlert) {
        setTimeout(function () {
          alert(_this3.options.errorMsg);
        }, 0);
      }
    }

    /**
     * get last position
     *
     * @param info
     */
  }, {
    key: 'recoverStatus',
    value: function recoverStatus(info) {
      var _this4 = this;

      if (!info.position) {
        return;
      }

      this.player.currentTime = info.position;

      this.player.on('loadedmetadata', function () {
        return _this4.currentTime = info.position;
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
      var _this5 = this;

      var watchdog = null;
      var options = this.options;
      var player = this.player;

      var lasTime = options.startPosition || 0;
      var playerToken = null;
      var playerID = options.playerID;

      player.on('timeupdate', function (e) {

        // waits until 'loadedmetadata' event is raised
        if (!_this5.eventsFlags.loadedmetadata || !_this5.firstSent) {
          _this5.firstSent = true;
          return;
        }

        lasTime = Math.round(player.currentTime() || 0);
      });

      // clear after dispose
      var cleanUp = function cleanUp() {

        if (watchdog) {
          player.clearInterval(watchdog);
          watchdog = false;

          _this5.makeRequest(options.disposeurl, {
            player: playerID,
            position: lasTime,
            token: playerToken,
            status: 'paused',
            timeSpent: getTimeSpent(_this5.startDate)
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
              type: 'tbxplayerupdate',
              playerID: playerID
            });

            // avoid conflicts
            if (pendingRequest) {
              return;
            }
            pendingRequest = true;

            _this5.makeRequest(options.updateurl, {
              player: playerID,
              token: playerToken,
              position: lasTime,
              status: player.paused() ? 'paused' : 'playing',
              event: 'Progress',
              timeSpent: getTimeSpent(_this5.startDate)
            }, function (error, response) {

              pendingRequest = false;

              if (error) {
                (0, _utils.log)('updateurl api error', error);

                // allow some error level
                if (_this5.updateFailsCount >= options.maxUpdateFails) {
                  _this5.blockPlayer(player, 'authapifail', { msg: error });
                }

                (0, _utils.log)('updateurl retry later', _this5.updateFailsCount, options.maxUpdateFails);

                _this5.updateFailsCount++;

                return;
              }

              _this5.updateFailsCount = 1;

              if (response && response.success) {
                playerID = response.player || playerID;
                playerToken = response.token || playerToken;
                _this5.playerToken = playerToken;
              } else {
                (0, _utils.log)(new Error('Player Auth error'), response);
                _this5.blockPlayer(player, 'noauth', response);
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

exports['default'] = ConcurrentViewPlugin;

////////////////////////////////////

/**
 *
 * @param {*} start
 */
function getTimeSpent(start) {

  if (!start) {

    return null;
  }

  return Math.round((Date.now() - start) / 1000);
}
module.exports = exports['default'];
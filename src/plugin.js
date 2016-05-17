import videojs from 'video.js';

// Default options for the plugin.
const defaults = {
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
class ConcurrentViewPlugin {

  constructor(options, player) {
    this.options = options;
    this.player = player;
  }

  /**
   * xhr alias
   *
   * @param url
   * @param data
   * @param cb
     */
  makeRequest(url, data, cb) {
    videojs.xhr(
      {
        body: data ? JSON.stringify(data) : '{}',
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      (err, resp, body) => {
        cb(err ? err.message || err : null, body ? JSON.parse(body) : null);
      }
    );
  }

  validatePlay(cb) {

    this.makeRequest(
      this.options.accessurl,
      {
        player: this.options.playerID
      },
      (error, ok) => {
        if (error) {
          videojs.log('concurrenceview: canplay api error', error);
          cb(new Error(error), null);
          return;
        }

        if (ok && ok.success) {
          cb(null, ok);

          this.player.trigger({
            type: 'avplayercanplay',
            code: 1
          });
        } else {
          cb(new Error('Player Auth error'), null);
        }
      }
    );

  }

  blockPlayer(code, error, reason) {
    code = code || 'error';
    reason = reason || 'Has alcanzado la cantidad maxima de players activos.';

    videojs.log('concurrenceview: stop player - ', reason);

    this.player.trigger({
      type: 'avplayerbloked',
      code,
      reason,
      error
    });

    this.player.pause();
    this.player.dispose();
  }

  recoverStatus(info) {
    if (!info.position) {
      return;
    }

    this.player.currentTime = info.position;

    this.player.on('loadedmetadata', () => this.currentTime = info.position);

  }

  /* ************** */

  makeWatchdog(ok) {

    let watchdog = null;
    let options = this.options;
    let player = this.player;

    let lasTime = options.startPosition || 0;
    let playerToken = null;
    let playerID = options.playerID;
    let loadedmetadata = false;

    player.on('loadedmetadata', () => loadedmetadata = true);

    player.on('timeupdate', (e) => {

      if (!loadedmetadata || !this.fistSent) {
        this.fistSent = true;
        return;
      }

      lasTime = Math.round(player.currentTime() || 0);
    });

    videojs.log('concurrence plugin: ok', ok);

    let cleanUp = () => {
      videojs.log('concurrenceview: DISPOSE', options);

      if (watchdog) {
        player.clearInterval(watchdog);
        watchdog = false;

        this.makeRequest(
          options.disposeurl,
          {
            player: playerID,
            position: lasTime,
            token: playerToken,
            status: 'paused'
          },
          () => {}
        );

      }
    };

    player.on('dispose', cleanUp);

    $(window).on('beforeunload', cleanUp);

    if (!watchdog) {

      let wdf = () => {

        player.trigger({
          type: 'avplayerupdate',
          playerID
        });

        this.makeRequest(
          options.updateurl,
          {
            player: playerID,
            token: playerToken,
            position: lasTime,
            status: player.paused() ? 'paused' : 'playing'
          },
          (error, response) => {

            if (error) {
              videojs.log('concurrenceview: update api error', error);
              this.blockPlayer(player, 'authapifail', {msg: error});
              return;
            }

            if (response && response.success) {
              playerID = response.player || playerID;
              playerToken = response.token || playerToken;

            } else {
              videojs.log(new Error('Player Auth error'), response);
              this.blockPlayer(player, 'noauth', response);
            }
          }
        );
      };

      watchdog = player.setInterval(wdf, options.interval * 1000);
      wdf();
    }

  }

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
const onPlayerReady = (player, options) => {
  player.addClass('vjs-concurrence-limiter');

  player._cvPlugin = new ConcurrentViewPlugin(options, player);
  let cvPlugin = player._cvPlugin;

  cvPlugin.validatePlay((error, ok) => {

    if (error) {
      videojs.log('concurrenceview: error', error);
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
const concurrenceLimiter = function(useroptions) {

  let options = videojs.mergeOptions(defaults, useroptions);

  videojs.log('concurrenceview plugin', options);

  if (!options.accessurl || !options.updateurl || !options.disposeurl) {
    videojs.log('concurrenceview: invalid urls', options);
    return;
  }

  if (!options.interval || options.interval < 5) {
    videojs.log('concurrenceview: invalid options', options);
    return;
  }

  if (!$) {
    videojs.log('concurrenceview: invalid jquery', options);
    return;
  }

  this.ready(() => {
    onPlayerReady(this, options);
  });
};

// Register the plugin with video.js.
videojs.plugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '0.1.3';

export default concurrenceLimiter;

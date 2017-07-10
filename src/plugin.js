import videojs from 'video.js';
import merge from 'deepmerge';

// Default options for the plugin.
const defaults = {
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
const EVENTS = {
  LOAD: 'Load',
  START: 'Start',
  PROGRESS: 'Progress',
  FIRSTQUARTILE: 'FirstQuartile',
  MIDPOINT: 'Midpoint',
  THIRDQUARTILE: 'ThirdQuartile',
  COMPLETE: 'Complete',
  PAUSE: 'Pause',
  RESUME: 'Resume'
};
const PERCENTAGE = {
  FIRSTQUARTILE: 25,
  MIDPOINT: 50,
  THIRDQUARTILE: 75,
  COMPLETE: 95
};
const eventsSent = [];

function getEvent(player, position) {
  const duration = player.duration();
  if ((duration === 0 || parseInt(position, 0) === 0) &&
    !eventsSent.includes(EVENTS.START)) {
    eventsSent.push(EVENTS.START);
    return EVENTS.START;
  }
  const percentage = (position / duration) * 100;
  let rtnEvent = EVENTS.PROGRESS;

  if (percentage >= PERCENTAGE.COMPLETE) {
    rtnEvent = EVENTS.COMPLETE;
  } else if (percentage >= PERCENTAGE.THIRDQUARTILE) {
    rtnEvent = EVENTS.THIRDQUARTILE;
  } else if (percentage >= PERCENTAGE.MIDPOINT) {
    rtnEvent = EVENTS.MIDPOINT;
  } else if (percentage >= PERCENTAGE.FIRSTQUARTILE) {
    rtnEvent = EVENTS.FIRSTQUARTILE;
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
class ConcurrentViewIdMaker {

  constructor() {
    this.sessionStorageKey = 'vcl-player-id';
  }

  /**
   * create id (if needed)
   * @param options
   * @returns {*}
   */
  generate(options) {

    // user-made id
    if (options.playerID) {
      return options.playerID;
    }

    return this.generateBySessionStorage() || ('rdm-' + this.generateRandom());
  }

  /**
   * random words
   * @param len
   * @returns {string}
   */
  generateRandom(len) {
    return Math.random().toString((len || 30) + 2).substr(2);
  }

  /**
   * sessionStorage id
   * @returns {null}
   */
  generateBySessionStorage() {

    if (!window.sessionStorage) {
      return null;
    }

    let id = window.sessionStorage.getItem(this.sessionStorageKey);

    if (!id) {
      id = 'ssi-' + this.generateRandom();
      window.sessionStorage.setItem(this.sessionStorageKey, id);
    }

    return id;
  }

}

/**
 * main plugin component class
 */
class ConcurrentViewPlugin {

  constructor(options, player) {
    this.options = options;
    this.player = player;
    this.eventsFlags = {};
    this.updateFailsCount = 1;

    this.options.playerID = new ConcurrentViewIdMaker().generate(options);

    this.playerToken = null;
    this.startDate = null;
  }

  /**
   * hook into player events right after player is ready to set flags for later checks
   */
  hookPlayerEvents() {
    this.player.on('loadedmetadata', () => this.eventsFlags.loadedmetadata = true);

    this.player.on('pause', this.reportEvent.bind(this, this.player, EVENTS.PAUSE));
    this.player.on('play', this.reportEvent.bind(this, this.player, EVENTS.RESUME));
  }

  /**
   * xhr alias
   *
   * @param url
   * @param data
   * @param cb
   */
  makeRequest(url, data, cb) {
    let requestConfig = {
      body: data ? JSON.stringify(data) : '{}',
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    requestConfig = merge(requestConfig, this.options.request);

    videojs.xhr(
      requestConfig,
      (err, resp, body) => {

        let bodyJson;

        try {
          bodyJson = body ? JSON.parse(body) : {error: 'invalid body', body};
        } catch (e) {
          bodyJson = null;
        }

        cb(err ? err.message || err : null, bodyJson);
      }
    );
  }

  /**
   * validates player access
   * @param cb
   */
  validatePlay(cb) {

    this.makeRequest(
      this.options.accessurl,
      {
        player: this.options.playerID
      },
      (error, ok) => {
        if (error) {
          videojs.log('concurrenceview: accessurl api error', error);

          if (this.updateFailsCount >= this.options.maxUpdateFails) {
            cb(new Error(error), null);

          } else {

            videojs.log('concurrenceview: accessurl retry',
              this.updateFailsCount, this.options.maxUpdateFails);

            this.updateFailsCount++;
            // try again
            this.player.setTimeout(() => this.validatePlay(cb), 200);
          }

          return;
        }

        this.updateFailsCount = 1;

        if (ok && ok.success) {
          cb(null, ok);

          this.player.trigger({
            type: 'avplayercanplay',
            code: 1
          });

          // Save the starting date if null
          if (!this.startDate) {
            this.startDate = Date.now();
          }
        } else {
          cb(new Error('Player Auth error'), null);
        }
      }
    );

  }

  /**
   * disposes current player instance
   *
   * @param code
   * @param error
   * @param reason
   */
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

  /**
   * get last position
   *
   * @param info
   */
  recoverStatus(info) {
    if (!info.position) {
      return;
    }

    this.player.currentTime = info.position;

    this.player.on('loadedmetadata', () => this.currentTime = info.position);

  }

  /* ************** */

  /**
   * creates a monitor interval
   *
   * @param ok
   */
  makeWatchdog(ok) {

    let watchdog = null;
    let options = this.options;
    let player = this.player;

    let lasTime = options.startPosition || 0;
    let playerToken = null;
    let playerID = options.playerID;

    player.on('timeupdate', (e) => {

      // waits until 'loadedmetadata' event is raised
      if (!this.eventsFlags.loadedmetadata || !this.firstSent) {
        this.firstSent = true;
        return;
      }

      lasTime = Math.round(player.currentTime() || 0);
    });

    videojs.log('concurrence plugin: ok', ok);

    // clear after dispose
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
          () => {
          }
        );

      }
    };

    // add hooks
    player.on('dispose', cleanUp);
    window.addEventListener('beforeunload', cleanUp);

    if (!watchdog) {

      let pendingRequest = false;
      // real watchdog
      let wdf = () => {

        player.trigger({
          type: 'avplayerupdate',
          playerID
        });

        // avoid conflicts
        if (pendingRequest) {
          return;
        }
        pendingRequest = true;

        this.makeRequest(
          options.updateurl,
          {
            player: playerID,
            token: playerToken,
            position: lasTime,
            status: player.paused() ? 'paused' : 'playing',
            event: getEvent(player, lasTime),
            timeSpent: getTimeSpent(this.startDate)
          },
          (error, response) => {

            pendingRequest = false;

            if (error) {
              videojs.log('concurrenceview: updateurl api error', error);

              // allow some error level
              if (this.updateFailsCount >= options.maxUpdateFails) {
                this.blockPlayer(player, 'authapifail', {msg: error});
              }

              videojs.log('concurrenceview: updateurl retry later',
                this.updateFailsCount, options.maxUpdateFails);

              this.updateFailsCount++;

              return;
            }

            this.updateFailsCount = 1;

            if (response && response.success) {
              playerID = response.player || playerID;
              playerToken = response.token || playerToken;
              this.playerToken = playerToken;

            } else {
              videojs.log(new Error('Player Auth error'), response);
              this.blockPlayer(player, 'noauth', response);
            }
          }
        );
      };

      watchdog = player.setInterval(wdf, options.interval * 1000);

      // call & block
      wdf();
    }

  }

  reportEvent(player, event) {
    this.makeRequest(
      this.options.updateurl,
      {
        player: this.options.playerID,
        token: this.playerToken,
        position: Math.round(player.currentTime() || 0),
        status: player.paused() ? 'paused' : 'playing',
        event: event,
        timeSpent: getTimeSpent(this.startDate)
      },
      (error, response) => {

      }
    );

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

  // Hook into player events after player is ready to avoid missing first triggered events
  cvPlugin.hookPlayerEvents();

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

  this.ready(() => {

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

    onPlayerReady(this, options);
  });
};

// Register the plugin with video.js.
videojs.plugin('concurrenceLimiter', concurrenceLimiter);

// Include the version number.
concurrenceLimiter.VERSION = '__VERSION__';

export default concurrenceLimiter;

'use strict';
/**
 * ConcurrentView class
 *
 * @file index.js
 * @module ConcurrentView
 */
import videojs from 'video.js';
import merge from 'deepmerge';

import { log } from '../utils';

 /**
 * main plugin component class
 */
class ConcurrentViewPlugin {

    constructor(options, player) {

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
    hookPlayerEvents() {
      this.player.on('loadedmetadata', () => this.eventsFlags.loadedmetadata = true);
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
          player: this.options.playerID || ''
        },
        (error, ok) => {
          if (error) {
            log('accessurl api error', error);

            if (this.updateFailsCount >= this.options.maxUpdateFails) {
              cb(new Error(error), null);

            } else {

              log('accessurl retry',
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
              type: 'tbxplayercanplay',
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

      log('stop player - ', reason);

      this.player.trigger({
        type: 'tbxplayerblocked',
        code,
        reason,
        error
      });

      this.player.pause();
      this.player.dispose();

      if (this.options.showAlert) {
        setTimeout(() => {
            alert(this.options.errorMsg);
        }, 0);
      }
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

      // clear after dispose
      let cleanUp = () => {

        if (watchdog) {
          player.clearInterval(watchdog);
          watchdog = false;

          this.makeRequest(
            options.disposeurl,
            {
              player: playerID,
              position: lasTime,
              token: playerToken,
              status: 'paused',
              timeSpent: getTimeSpent(this.startDate)
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
            type: 'tbxplayerupdate',
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
              event: 'Progress',
              timeSpent: getTimeSpent(this.startDate)
            },
            (error, response) => {

              pendingRequest = false;

              if (error) {
                log('updateurl api error', error);

                // allow some error level
                if (this.updateFailsCount >= options.maxUpdateFails) {
                  this.blockPlayer(player, 'authapifail', {msg: error});
                }

                log('updateurl retry later',
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
                log(new Error('Player Auth error'), response);
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
  }

  export default ConcurrentViewPlugin;
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
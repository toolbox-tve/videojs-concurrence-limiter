/* globals videojs */
'use strict';

(function (videojs, $) {
    'use strict';

    var defaults = {
        interval: 10,
        accessurl: null,
        updateurl: null,
        disposeurl: null,
        playerID: null,
        startPosition: 0
    };

    var extend = Object.assign || function () {
        var args, target, i, object, property;

        args = Array.prototype.slice.call(arguments);
        target = args.shift() || {};

        for (i in args) {
            object = args[i];
            for (property in object) {
                if (object.hasOwnProperty(property)) {
                    if (typeof object[property] === 'object') {
                        target[property] = extend(target[property], object[property]);
                    } else {
                        target[property] = object[property];
                    }
                }
            }
        }
        return target;
    };

    var watchdog = null;

    var makeRequest = function makeRequest(url, data, cb) {

        videojs.xhr({
            body: data ? JSON.stringify(data) : '{}',
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, function (err, resp, body) {
            cb(err ? err.message || err : null, body ? JSON.parse(body) : null);
        });
    };

    var makeWatchdog = function makeWatchdog(options, player, ok) {

        var lasTime = options.startPosition || 0;
        var playerToken,
            playerID = options.playerID;
        var loadedmetadata = false;

        player.on('loadedmetadata', function () {
            loadedmetadata = true;
        });

        player.on('timeupdate', function (e) {

            if (!loadedmetadata || !this.fistSent) {
                this.fistSent = true;
                return;
            }

            lasTime = Math.round(player.currentTime() || 0);
        });

        videojs.log('concurrence plugin: ok', ok);

        var cleanUp = function cleanUp() {
            videojs.log('concurrenceview: DISPOSE', options);

            if (watchdog) {
                player.clearInterval(watchdog);
                watchdog = false;

                makeRequest(options.disposeurl, {
                    player: playerID,
                    position: lasTime,
                    token: playerToken,
                    status: 'paused'
                }, function () {});
            }
        };

        player.on('dispose', cleanUp);

        $(window).on('beforeunload', cleanUp);

        if (!watchdog) {

            var wdf = function wdf() {

                player.trigger({
                    type: 'avplayerupdate',
                    playerID: playerID
                });

                makeRequest(options.updateurl, {
                    player: playerID,
                    token: playerToken,
                    position: lasTime,
                    status: player.paused() ? 'paused' : 'playing'
                }, function (error, ok) {

                    if (error) {
                        videojs.log('concurrenceview: update api error', error);
                        blockPlayer(player, 'authapifail', { msg: error });
                        return;
                    }

                    if (ok && ok.success) {
                        playerID = ok.player || playerID;
                        playerToken = ok.token || playerToken;
                    } else {
                        videojs.log(new Error('Player Auth error'), ok);
                        blockPlayer(player, 'noauth', ok);
                    }
                });
            };

            watchdog = player.setInterval(wdf, options.interval * 1000);
            wdf();
        }
    };

    var blockPlayer = function blockPlayer(player, code, error, reason) {
        code = code || 'error';
        reason = reason || 'Has alcanzado la cantidad maxima de players activos.';

        videojs.log('concurrenceview: stop player - ', reason);

        player.trigger({
            type: 'avplayerbloked',
            code: code,
            reason: reason,
            error: error
        });

        player.pause();
        player.dispose();
    };

    var canplay = function canplay(options, player, cb) {

        makeRequest(options.accessurl, {
            player: options.playerID
        }, function (error, ok) {
            if (error) {
                videojs.log('concurrenceview: canplay api error', error);
                cb(new Error(error), null);
                return;
            }

            if (ok && ok.success) {
                cb(null, ok);

                player.trigger({
                    type: 'avplayercanplay',
                    code: 1
                });
            } else {
                cb(new Error('Player Auth error'), null);
            }
        });
    };

    var recoverStatus = function recoverStatus(info, player) {
        if (!info.position) {
            return;
        }

        player.currentTime = info.position;

        player.on('loadedmetadata', function () {
            this.currentTime = info.position;
        });
    };

    ////events
    var makeCheks = function makeCheks(options, player) {

        var voidf = function voidf() {};

        if (!options.accessurl || !options.updateurl || !options.disposeurl) {
            videojs.log('concurrenceview: invalid urls', options);
            return voidf;
        }

        if (!options.interval || options.interval < 5) {
            videojs.log('concurrenceview: invalid options', options);
            return voidf;
        }

        if (!$) {
            videojs.log('concurrenceview: invalid jquery', options);
            return voidf;
        }

        return function () {

            canplay(options, player, function (error, ok) {

                if (error) {
                    videojs.log('concurrenceview: error', error);
                    blockPlayer(player, 'cantplay', error);
                } else {

                    recoverStatus(ok, player);
                    //monitor
                    makeWatchdog(options, player, ok);
                }
            });
        };
    };

    /**
     * Register the Plugin
     */
    videojs.plugin('concurrenceview', function (pluginoptions) {

        var options = extend({}, defaults, pluginoptions);
        var player = this;

        videojs.log('concurrenceview plugin', options);

        player.ready(makeCheks(options, player), false);
    });
})(window.videojs, window.jQuery);
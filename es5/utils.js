'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.log = log;
exports.validateRequiredOpts = validateRequiredOpts;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _videoJs = require('video.js');

var _videoJs2 = _interopRequireDefault(_videoJs);

/**
 * videojs.log customization
 */

function log() {
    var logCmd = _videoJs2['default'].log;
    var args = [].slice.call(arguments);

    var type = args.find(function (arg) {

        return arg === 'error' || arg === 'warn';
    });

    if (type) {
        logCmd = _videoJs2['default'].log[type];
    }

    args[0] = '[videojs/plugins/concurrence-limiter]: ' + args[0];

    logCmd.apply(_videoJs2['default'], args);
}

;

/**
 * Validate required options
 *
 * @param {*} options plugin options
 */

function validateRequiredOpts(options) {
    var URI_PATTERN = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i;
    var schema = {
        playerID: function playerID(value) {
            return value !== null || typeof value !== 'undefined';
        },
        accessurl: function accessurl(value) {
            return URI_PATTERN.test(value);
        },
        updateurl: function updateurl(value) {
            return URI_PATTERN.test(value);
        },
        disposeurl: function disposeurl(value) {
            return URI_PATTERN.test(value);
        },
        interval: function interval(value) {
            return value && !isNaN(value) && parseInt(value) <= 10;
        }
    };

    var errors = Object.keys(schema).map(function (prop) {
        var validator = schema[prop],
            current = options[prop];

        return [prop, validator(current)];
    }).reduce(function (errors, pair) {

        if (pair[1] === false) {
            errors.push(pair[0] + ' is invalid. option required.');
        }

        return errors;
    }, []);

    if (errors.length > 0) {
        errors.forEach(function (error) {
            log(error, 'error');
        });

        log('CURRENT OPTIONS: ', options);
        return false;
    }

    return true;
}
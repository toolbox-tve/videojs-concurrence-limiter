import videojs from 'video.js';

/**
 * videojs.log customization
 */
export function log() {
    let logCmd = videojs.log;
    let args = [].slice.call(arguments);

    let type = args.find((arg) => {

        return arg === 'error' || arg === 'warn';
    });

    if (type) {
        logCmd = videojs.log[type];
    }

    args[0] = '[videojs/plugins/concurrence-limiter]: ' + args[0];

    logCmd.apply(videojs, args);
};

/**
 * Validate required options
 *
 * @param {*} options plugin options
 */
export function validateRequiredOpts(options) {
    const URI_PATTERN = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/i;
    let schema = {
        accessurl: (value) => {
          return URI_PATTERN.test(value);
        },
        updateurl: (value) => {
            return URI_PATTERN.test(value);
        },
        disposeurl: (value) => {
            return URI_PATTERN.test(value);
        },
        interval: (value) => {
            return value && !isNaN(value) && parseInt(value) <= 10;
        }
    };

    let errors = Object.keys(schema).map(function (prop) {
        let validator = schema[prop],
            current = options[prop]
        ;

        return [prop, validator(current)];
      }).reduce((errors, pair) => {

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
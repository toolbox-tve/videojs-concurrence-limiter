Video.js Concurrence Limiter
============================

A Video.js plugin for concurrency control on played contents

Contents
--------
1. [Installation](#installation)
1. [Dependencies](#dependencies)
1. [Usage](#usage)
1. [Options](#options)
1. [TODO](#TODO)

### Installation
----------------

The *dist* folder contains the library bundles: for debugging or the minfied version.

##### Development:
- Install the dependencies with npm:
```sh
$ npm install
```
- You can test with te example folder and using gulp to watch changes:
```sh
$ npm run watch
```
- To generate a build:
```sh
$ npm run build
```
- Run linter:
```sh
$ npm run lint
```

##### Testing:
Unit Test are on test folder, using karma & qunit:
```sh
$ npm run test
```
- Run Specific browser tests:
```sh
$ npm run test:chrome
$ npm run test:firefox
$ npm run test:ie
$ npm run test:safari
```

### Dependencies
----------------

The plugin has the following mandatory dependencies:

- [Video.js](https://github.com/videojs/video.js) - HTML5 media player that provides the user interface.

- [jQuery](http://jquery.com) - Cross-platform Javascript library for client-side scripting.

### Usage
---------

First include video.js library and stylesheet.

The videojs-concurrence-limiter plugin automatically register itself to Video.JS when include
the script on page:

```html
<script src="videojs.concurrence.js"></script>
```
or the minified version:
```html
<script src="videojs.concurrence.min.js"></script>
```

### Options
-----------

Configure the player using the Video.js
[options](https://github.com/videojs/video.js/blob/master/docs/guides/options.md),
and enable the plugin by adding a `concurrenceview` configuration to `plugins`. For
example:

```javascript
var player = videojs("myVideo",
{
    // video.js options
    controls: true,
    loop: false,
    width: 320,
    height: 240,
    plugins: {
        // videojs-concurrence-limiter plugin options
        concurrenceLimiter: {
        	// options here
        }
    }
});
```
##### Available options:
| Option | Required | Type | Default | Description |
| --- | --- | --- | --- | --- |
| interval | false | number | 10 | Plugin update interval, in seconds |
| playerID | false | string | _null_ | Current player id, if null, the player generates one |
| accessurl | true | string | `none` | Server url for access request |
| updateurl | true | string | `none` | Server update url |
| disposeurl | true | string | `none` | Server dispose/stop url |
| startPosition | true | number | `none` | Player starting position for updates |
| maxUpdateFails | true | number | 1 | Max http failures for 'updateurl' before error event |
| requestTimeoutInMillis | true | number | 15000 | Player http request timeouts |
  
### Request & Response formats
-----------
Standar format:

request:
```json
{
  player: 'a plyaer id',
  position: currentPlayerTime,
  token: 'SomeHelpfulValidationTokenFromServer',
  status: 'currentPlayerStatus'
}
```

response:
```json
{
  success: true|false,
  player: 'a player id',
  token: 'SomeHelpfulValidationTokenFromServer',
  position: positionFromParams,
  status: statusFromParams
}
```


See SimpleLimitServer.js for more information and usage

### TODO
--------

- [ ] Add Request/Response information.
- [ ] Create unit test specs.

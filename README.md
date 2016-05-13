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
        concurrence: {
        	// options here
        }
    }
});
```
##### Available options:
| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `playerID` | string | `none` |  |
| `accessurl` | string | `none` |  |
| `updateurl` | string | `none` |  |
| `disposeurl` | string | `none` |  |
| `startPosition` | number | `none` |  |


### TODO
--------

- [ ] Complete Options in README.
- [ ] Create unit test specs.

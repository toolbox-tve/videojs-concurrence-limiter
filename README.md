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
    ------------

The *dist* folder contains the library bundles: for debugging or the minfied version.

##### Development:
- Install the dependencies with npm:
$ npm install
- You can test with te example folder and using gulp to watch changes:
$ gulp
- To generate a build:
$ gulp build


### Dependencies
    ------------

The plugin has the following mandatory dependencies:

- [Video.js](https://github.com/videojs/video.js) - HTML5 media player that provides the user interface.

- [jQuery](http://jquery.com) - Cross-platform Javascript library for client-side scripting.

### Usage
    -----

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
    -------

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

### TODO

- [ ] .

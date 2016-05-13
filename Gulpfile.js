'use strict';

var gulp                = require('gulp'),
    concat              = require('gulp-concat'),
    util                = require('gulp-util'),
    uglify              = require('gulp-uglify'),
    rename              = require('gulp-rename');

var jsFiles = './src/js/**/*.js';

// Bundle & Minifiyng scripts:
gulp.task('scripts', function() {
  util.log('Generate bundle...');

  // TBX Player Plugins:
  gulp.src([ jsFiles ])
  .pipe(concat('videojs.concurrence.js'))
  .pipe(gulp.dest('dist'))
  .pipe(rename({ suffix: '.min' }))
  .pipe(uglify({ mangle: false }))
  .pipe(gulp.dest('dist'));
});

// Task to generate dist files:
gulp.task('build', [ 'scripts' ]);

// Watch Generate bundle on change src:
gulp.task('watch', function() {
  util.log('Watching changes...');
  gulp.watch([ jsFiles ], [ 'scripts' ]);
});

// watch changes on src to re-generate dist files:
gulp.task('default', [ 'watch' ]);

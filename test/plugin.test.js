import document from 'global/document';

import QUnit from 'qunit';
import sinon from 'sinon';
import videojs from 'video.js';

import plugin from '../src/plugin';

const Player = videojs.getComponent('Player');
let videojsXhrStub;

QUnit.test('the environment is sane', function(assert) {
  assert.strictEqual(typeof Array.isArray, 'function', 'es5 exists');
  assert.strictEqual(typeof sinon, 'object', 'sinon exists');
  assert.strictEqual(typeof videojs, 'function', 'videojs exists');
  assert.strictEqual(typeof plugin, 'function', 'plugin is a function');
});

QUnit.module('videojs-concurrence-limiter', {

  beforeEach() {
    // TODO: before() no esta siendo llamado
    if (!videojsXhrStub) {
      videojsXhrStub = sinon
        .stub(videojs, 'xhr')
        .yields(null, null, JSON.stringify({success: true}));
    } else {
      videojsXhrStub.reset();
    }

    // Mock the environment's timers because certain things - particularly
    // player readiness - are asynchronous in video.js 5. This MUST come
    // before any player is created; otherwise, timers could get created
    // with the actual timer methods!
    this.clock = sinon.useFakeTimers();

    this.fixture = document.getElementById('qunit-fixture');
    this.video = document.createElement('video');
    this.fixture.appendChild(this.video);
    this.player = videojs(this.video);
  },

  afterEach() {
    this.player.dispose();
    this.clock.restore();
  }
});

QUnit.test('registers itself with video.js', function(assert) {
  assert.expect(2);

  assert.strictEqual(
    Player.prototype.concurrenceLimiter,
    plugin,
    'videojs-concurrence-limiter plugin was registered'
  );

  this.player.concurrenceLimiter({
    accessurl: '/limiter/canplay',
    updateurl: '/limiter/playing',
    disposeurl: '/limiter/stop',
    startPosition: 123
  });

  // Tick the clock forward enough to trigger the player to be "ready".
  this.clock.tick(1);

  assert.ok(
    this.player.hasClass('vjs-concurrence-limiter'),
    'the plugin adds a class to the player'
  );
});

QUnit.test('accepts requests configuration', function(assert) {
  assert.expect(2);

  this.player.concurrenceLimiter({
    accessurl: '/limiter/canplay',
    updateurl: '/limiter/playing',
    disposeurl: '/limiter/stop',
    request: {
      timeout: 10000,
      headers: {
        'my-header-key': 'my-header-value'
      }
    }
  });

  // Tick the clock forward enough to trigger the player to be "ready".
  this.clock.tick(1);

  const xhrCallConfig = videojsXhrStub.lastCall.args[0];

  assert.equal(
    xhrCallConfig.timeout,
    10000,
    'the xhr request config has the passed timeout'
  );

  assert.equal(
    xhrCallConfig.headers['my-header-key'],
    'my-header-value',
    'the xhr request config has the passed headers'
  );
});

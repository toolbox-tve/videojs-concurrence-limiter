var PlayerModule = PlayerModule || (function () {

    var player = videojs('myVideo',
    {
        controls: true,
        width: 320,
        height: 240,
        plugins: {

        }
    });

    /**
     * HANDLERS
     **/

    // error handling
    player.on('deviceError', function() {
        console.log('device error:', player.deviceErrorCode);
    });

    player.on('error', function(error) {
        console.log('error:', error);
    });

})();

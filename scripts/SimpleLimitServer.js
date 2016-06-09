/**
 * simple class to handle server reponses
 *
 */
class SimpleLimitServer {

  constructor(maxPlayers) {
    this.maxPlayers = maxPlayers || 3;
    this.players = { };
  }

  /**
   * validates current players
   * @param params
   * @returns {*}
     */
  canplay(params) {

    let players = Object.keys(this.players);
    let canplay = true;

    // limit exided and player not included
    if (players.length >= this.maxPlayers) {
      canplay = players.indexOf(params.player) !== -1;
    }

    return {
      success: canplay,
      player: params.player,
      token: 'SomeHelpfulValidationToken'
    };
  }

  /**
   * play update (position, status, etc)
   * @param params
   * @returns {*}
     */
  playing(params) {

    // validate existent
    let valid = this.canplay(params);

    if (!valid.success) {
      return valid;
    }

    // block
    this.players[params.player] = params;
    this.players[params.player].lastUpdate = new Date();

    return {
      success: true,
      player: params.player,
      token: 'SomeHelpfulValidationToken',
      position: params.position,
      status: params.status
    };
  }

  /**
   * stop current player
   *
   * @param params
   * @returns {{success: boolean}}
     */
  stop(params) {
    // unblock
    delete this.players[params.player];

    return {success: true};
  }

  /**
   * parse body
   *
   * @param url
   * @param body
     */
  getBodyParams(url, body) {

    let params = JSON.parse(body);

    if (!params.player) {
      throw new Error('Invalid player id');
    }

    return params;
  }

  /**
   * main midleware entry
   * @param url
   * @param req
   * @param res
     * @param next
     */
  handleRequest(url, req, res, next) {

    if (req.method !== 'POST') {
      this.sendJsonReponse(res, 400, {
        success: false,
        error: true,
        message: 'bad method'
      });
      return;
    }

    let body = [];
    let sendError = this.sendJsonReponse.bind(this);
    let resp = this.sendResponse.bind(this);

    req
      .on('data', (chunk) => body.push(chunk))
      .on('error', (error) => {
        sendError(res, 400, {
          success: false,
          error: true,
          message: error.message
        });
      })
      .on('end', () => {
        resp(url, req, res, next, Buffer.concat(body).toString());
      });

  }

  /**
   * url-base reponse
   *
   * @param url
   * @param req
   * @param res
   * @param next
     * @param body
     */
  sendResponse(url, req, res, next, body) {

    let response = null;

    let params = {};

    try {

      params = this.getBodyParams(url, body);

    } catch (e) {
      this.sendJsonReponse(res, 400, {
        success: false,
        error: true,
        message: 'Param error: ' + e.message
      });

      return;
    }

    switch (url.pathname) {

    case '/limiter/canplay':
      response = this.canplay(params);
      break;

    case '/limiter/playing':
      response = this.playing(params);
      break;

    case '/limiter/stop':
      response = this.stop(params);
      break;

      // debug url
    case '/limiter/players':
      let keys = Object.keys(this.players);

      response = {
        count: keys.length,
        all: keys,
        data: this.players
      };
      break;

    default:
      next();
      return;
    }

    /* timeout test
    if(url.pathname !== '/limiter/canplay') {
      return setTimeout(()  => this.sendJsonReponse(res, 200, response), 2 * 1000);
    }

    setTimeout(()  => this.sendJsonReponse(res, 200, response), 17 * 1000);
    /*/

    this.sendJsonReponse(res, 200, response);
    // */
  }

  /**
   * http reponse
   *
   * @param res
   * @param status
   * @param json
     */
  sendJsonReponse(res, status, json) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(json, null, 3) || '??');
  }

}

export default SimpleLimitServer;

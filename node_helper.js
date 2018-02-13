/* Magic Mirror
 * Module: MMM-Paris_RATP-PG
 *
 * script from da4throux
 * based on a Script from  Georg Peters (https://lane6.de)
 * band a Script from Benjamin Angst http://www.beny.ch
 * MIT Licensed.
 *
 * For the time being just the first bus from the config file
 */

const NodeHelper = require("node_helper");
const unirest = require('unirest');

module.exports = NodeHelper.create({
  start: function () {
    this.started = false;
  },

  socketNotificationReceived: function(notification, payload) {
    const self = this;
    if (notification === 'SET_CONFIG' && this.started == false) {
      this.config = payload;
      if (this.config.debug) {
        console.log (' *** config received from MMM.js & set in node_helper: ');
        console.log ( payload );
      }
      this.started = true;
      this.config.lines.forEach(function(l){
        setTimeout(function(){
          if (self.config.debug) {
            console.log (' *** line ' + l.label + ' intial update in ' + l.initialLoadDelay);
          }
          self.fetchHandleAPI(l);
        }, l.initialLoadDelay);
      });
    }
  },

  fetchHandleAPI: function(_l) {
    var self = this, _url = _l.url, retry = true;
    if (this.config.debug) { console.log (' *** fetching: ' + _url);}
    unirest.get(_url)
      .header({
        'Accept': 'application/json;charset=utf-8'
      })
      .end(function(response){
        if (response && response.body) {
          if (self.config.debug) {
            console.log (' *** received answer for: ' + _l.label);
          }
          switch (_l.type) {
            case'pluie':
              self.processPluie(response.body, _l);
              break;
            case 'tramways':
            case 'bus':
            case 'rers':
            case 'metros':
              self.processRATP(response.body, _l);
              break;
            case 'traffic':
              self.processTraffic(response.body, _l);
              break;
            case 'autolib':
              self.processAutolib(response.body, _l);
              break;
            case 'velib':
              self.processVelib(response.body, _l);
              break;
            default:
              if (this.config.debug) {
                console.log(' *** unknown request: ' + l.type);
              }
          }
        } else {
          if (self.config.debug) {
            if (response) {
              console.log (' *** partial response received for: ' + _l.label);
              console.log (response);
            } else {
              console.log (' *** no response received for: ' + _l.label);
            }
          }
        }
        if (self.config.debug) { console.log (' *** getResponse: set retry for ' + _l.label); }
      })
    if (retry) {
      if (this.config.debug) {
        console.log (' *** line ' + _l.label + ' intial update in ' + _l.updateInterval);
      }
      setTimeout(function() {
        self.fetchHandleAPI(_l);
      }, _l.updateInterval);
    }
  },

  processAutolib: function (data, _l) {
    this.config.infos[_l.id].lastUpdate = new Date();
    this.config.infos[_l.id].data = data.records[0].fields;
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processVelib: function (data, _l) {
    var _p = this.config.infos[_l.id];
    _p.lastUpdate = new Date();
    _p.data = data.records[0].fields;
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processPluie: function(data, _l) {
    var _p = this.config.infos[_l.id];
    if (this.config.debug) {
      console.log(' *** Pluie: ' + JSON.stringify(data));
    }
    _p.lastUpdateData = data.lastUpdate; //? useful
    _p.lastUpdate = new Date();
    _p.niveauPluieText = data.niveauPluieText;
    _p.dataCadran = data.dataCadran;
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processRATP: function(data, _l) {
    if (this.config.debug) {
      console.log (' *** processRATP data received for ' + _l.label);
      console.log (data.result);
      console.log ('___');
    }
    this.config.infos[_l.id].schedules = data.result.schedules;
    this.config.infos[_l.id].lastUpdate = new Date();
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processTraffic: function (data, _l) {
    var result, idMaker;
    if (this.config.debug) {
      console.log('response receive: ');
      console.log(data.result); //line, title, message
      console.log('___');
    }
    result = {};
    if (data.result) {
      result = data.result;
      idMaker = data._metadata.call.split('/');
    }
    result.id = idMaker[idMaker.length - 3].toString().toLowerCase() + '/' + idMaker[idMaker.length - 2].toString().toLowerCase() + '/' + idMaker[idMaker.length - 1].toString().toLowerCase();
    result.loaded = true;
    this.config.infos[_l.id].status = result;
    this.config.infos[_l.id].lastUpdate = new Date();
    this.sendSocketNotification("DATA", this.config.infos);
  }

});

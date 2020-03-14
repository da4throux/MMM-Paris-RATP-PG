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
            console.log (' *** line ' + l.label + ' initial update in ' + l.initialLoadDelay);
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
            console.log (' *** received answer for: ' + (_l.label || ''));
            console.log (JSON.toString(_l)); //**** to clean up
          }
          switch (_l.type) {
            case'pluie':
              self.processPluie(response.body, _l);
              break;
            case 'tramways':
            case 'buses':
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
        console.log (' *** line ' + _l.label + ' initial update in ' + _l.updateInterval);
      }
      setTimeout(function() {
        self.fetchHandleAPI(_l);
      }, _l.updateInterval);
    }
  },

  log: function (message) {
    if (this.config.debug) {
      console.log (message);
    }
  },

  orderResult: function (result) {
    this.config.reorderPotential++;
    let orderChanged = false;
    let schedules = result.schedules;
    if (schedules) {
      schedules.sort( function (objA, objB) {
        let dateA, dateB;
        let a = objA.message, b = objB.message;
        dateA = Date.parse('01/01/2011 ' + a + ':00');
        dateB = Date.parse('01/01/2011 ' + b + ':00');
        if ((a[0] == '2') && (b[0] + b[1] == '00')) {
          return -1
        }
        if ((b[0] == '2') && (a[0] + a[1] == '00')) {
          orderChanged = true;
          return 1
        }
        if (dateA > dateB) {
          orderChanged = true;
          return 1;
        } else {
          return -1;
        }
      });
    }
    if (orderChanged) {
      result.schedules = schedules;
      this.config.reordered++;
    }
    return orderChanged;
  },

  processAutolib: function (data, _l) {
    this.config.infos[_l.id].lastUpdate = new Date();
    this.config.infos[_l.id].data = data.records[0].fields;
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processVelib: function (data, _l) {
    var _p = this.config.infos[_l.id];
    if (data.records) { // else it was missing
      _p.lastUpdate = new Date();
      _p.data = data.records[0].fields;
      _p.data.nbbike = _p.data.mechanical;
      _p.data.nbebike = _p.data.ebike;
      _p.data.nbfreeedock = _p.data.numdocksavailable;
      _p.data.station_state = _p.data.is_renting == "OUI" ? 'Operative' : 'Closed';
      _p.data.update = new Date();
      this.loaded = true;
      this.sendSocketNotification("DATA", this.config.infos);
    }
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
    this.log (' *** processRATP data received for ' + (_l.label || ''));
    if (this.config.reorder && _l.type == 'rers') {
      this.log ('reordered: ' + this.config.reordered + ' / ' + this.config.reorderPotential);
    }
    this.log (data.result);
//      let a = JSON.parse('{"schedules" : [ { "code": "AURA", "message": "20:50", "destination": "Gare du Nord" }, { "code": "ASAR", "message": "00:49", "destination": "Gare du Nord" }, { "code": "AURA", "message": "20:48", "destination": "Gare du Nord" }]}'); // testing schedule if needed
    if (this.config.reorder && _l.type == 'rers' && this.orderResult(data.result)) {
      this.log (' schedule reordered in :');
      this.log (data.result);
    };
    this.log ('___');
    this.config.infos[_l.id].schedules = data.result.schedules;
    this.config.infos[_l.id].lastUpdate = new Date();
    this.loaded = true;
    this.sendSocketNotification("DATA", this.config.infos);
  },

  processTraffic: function (data, _l) {
    var result, idMaker;
    if (this.config.debug) {
      console.log('*** processTraffic response receive: ' + (_l.label || ''));
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

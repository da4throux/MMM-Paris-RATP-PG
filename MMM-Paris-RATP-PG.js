/* Timetable for Paris local transport Module */

/* Magic Mirror
 * Module: MMM-Paris-RATP-PG
 *
 * By da4throux
 * based on a script from Georg Peters (https://lane6.de)
 * and a script from Benjamin Angst http://www.beny.ch
 * MIT Licensed.
 */

Module.register("MMM-Paris-RATP-PG",{

  // Define module defaults
  defaults: {
      maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
//    maxTimeOffset: 200, // Max time in the future for entries // Does not seem to be used
//    useRealtime: true, // Does not seem to be used
      updateInterval: 1 * 60 * 1000, //time in ms between pulling request for new times (update request)
    animationSpeed: 2000,
      convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
      initialLoadDelay: 0, // start delay seconds.
      apiBaseV3: 'https://api-ratp.pierre-grimaud.fr/v3/',
    ratp_api: 'https://api-ratp.pierre-grimaud.fr/v3/',
    maxLettersForDestination: 22, //will limit the length of the destination string
    concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
    showSecondsToNextUpdate: true,  // display a countdown to the next update pull (should I wait for a refresh before going ?)
    showLastUpdateTime: false,  //display the time when the last pulled occured (taste & color...)
    oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
    oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
    debug: false, //console.log more things to help debugging
      apiVelib: 'https://opendata.paris.fr/api/records/1.0/search/?dataset=stations-velib-disponibilites-en-temps-reel', // add &q=141111 to get info of that station
      velibGraphWidth: 400, //Height will follow
    autolib_api: 'https://opendata.paris.fr/explore/dataset/stations_et_espaces_autolib_de_la_metropole_parisienne/api/', ///add '?q=' mais pas d'info temps réel... pour l'instant
    conversion: { "Trafic normal sur l'ensemble de la ligne." : 'Traffic OK'},
      pluie: true,
      pluieAPI: 'http://www.meteofrance.com/mf3-rpc-portlet/rest/pluie/',
    pluie_api:  'http://www.meteofrance.com/mf3-rpc-portlet/rest/pluie/',
      pluieUpdateInterval: 1 * 10 * 60 * 1000, //every 10 minutes
    line_template: {
      updateInterval: 1 * 60 * 1000,
      maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
      convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
      updateTimer: null,
      initialLoadDelay: 0, // start delay seconds
      showUpdateAge: true,
    },
  },

  // Define required scripts.
  getStyles: function() {
    return ["MMM-Paris-RATP-Transport.css", "font-awesome.css", "weather-icons.css"];
  },

  // Define start sequence.
  start: function() {
    var l;
    Log.info("Starting module: " + this.name);
    this.config.infos = [];
    for (i=0; i < this.config.lines.length; i++) {
      this.config.infos[i]={};
      l = Object.assign(JSON.parse(JSON.stringify(this.config.line_template)),
        JSON.parse(JSON.stringify(this.config.lines[i])));
      l.id = i;
      switch (l.type) {
        case 'tramways':
        case 'bus':
        case 'rers':
        case 'metros':
          l.url = this.config.ratp_api + 'schedules/' + l.type + '/' + l.line.toString().toLowerCase() + '/' + l.stations + '/' + l.destination; // get schedule for that bus
          break;
        case 'traffic':
          l.url = this.config.ratp_api + 'traffic/' +l.line[0] + '/' + l.line[1];
          break;
        case 'pluie':
          l.url = this.config.pluie_api + l.place;
        default:
          if (this.config.debug) { console.log(' *** unknown request: ' + l.type)}
      }
      this.config.lines[i] = l;
    }
    this.sendSocketNotification('SET_CONFIG', this.config);
    this.loaded = false;
    var self = this;
    setInterval(function () {
      self.caller = 'updateInterval';
      self.updateDom();
    }, 1000);
  },

  getHeader: function () {
    var header = this.data.header;
    return header;
  },

  // Override dom generator.
  getDom: function() {
    var now = new Date();
    var wrapper = document.createElement("div");

    if (!this.loaded) {
      wrapper.innerHTML = "Loading connections ...";
      wrapper.className = "dimmed light small";
      return wrapper;
    } else {
      wrapper.className = "paristransport";
    }
    var lines = this.config.lines;
    var l, d, n, firstLine, delta;
    var table = document.createElement("table");
    var stopIndex, firstCell, secondCell;
    var previousRow, previousDestination, previousMessage, row, comingBus;
    wrapper.appendChild(table);
    table.className = "small";
    for (var i = 0; i < lines.length; i++) {
      l = lines[i]; // line config
      d = this.infos[i]; // data received for the line
      firstLine =  true;
      firstCellHeader = '';
      if ((new Date() - Date.parse(d.lastUpdate) )/ 1000 > 0 && l.showUpdateAge) {
        delta = Math.floor((new Date() - Date.parse(d.lastUpdate) )/ 1000 / 10);
        if (delta <= 20) {
          firstCellHeader += '&#' + (9312 + delta) + ';';
        } else if (delta > 20) {
          firstCellHeader += '&#9471;';
        }
      }
      switch (l.type) {
        case "traffic":
          row = document.createElement("tr");
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.label || l.line[1]);
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.className = "align-left";
          secondCell.innerHTML = d.status ? this.config.conversion[d.status.message] || d.status.message : 'N/A';
          secondCell.colSpan = 2;
          row.appendChild(secondCell);
          table.appendChild(row);
          break;
        case "bus":
        case "metros":
        case "tramways":
        case "rers":
          var nexts = d.schedules || [{message: 'N/A', destination: 'N/A'}];
          for (var rank = 0; (rank < this.config.maximumEntries) && (rank < nexts.length); rank++) {
            n = nexts[rank]; //next transport
            row = document.createElement("tr");
            var firstCell = document.createElement("td");
            firstCell.className = "align-right bright";
            firstCell.innerHTML = firstLine ? firstCellHeader + (l.label || l.line) : ' ';
            row.appendChild(firstCell);
            var busDestinationCell = document.createElement("td");
            busDestinationCell.innerHTML = n.destination.substr(0, this.config.maxLettersForDestination);
            busDestinationCell.className = "align-left";
            row.appendChild(busDestinationCell);
            var depCell = document.createElement("td");
            depCell.className = "bright";
            if (this.config.convertToWaitingTime && /^\d{1,2}[:][0-5][0-9]$/.test(n.message)) {
              var transportTime = n.message.split(':');
              var trainDate = new Date(0, 0, 0, transportTime[0], transportTime[1]);
              var startDate = new Date(0, 0, 0, now.getHours(), now.getMinutes(), now.getSeconds());
              var waitingTime = trainDate - startDate;
              if (startDate > trainDate ) {
                if (startDate - trainDate < 1000 * 60 * 2) {
                  waitingTime = 0;
                } else {
                  waitingTime += 1000 * 60 * 60 * 24;
                }
              }
              waitingTime = Math.floor(waitingTime / 1000 / 60);
              depCell.innerHTML = waitingTime + ' mn';
            } else {
              depCell.innerHTML = n.message;
            }
            depCell.innerHTML = depCell.innerHTML.substr(0, this.config.maxLettersForTime);
            row.appendChild(depCell);
            if (this.config.concatenateArrivals && !firstLine && (n.destination == previousDestination)) {
              previousMessage += ' / ' + depCell.innerHTML;
              previousRow.getElementsByTagName('td')[2].innerHTML = previousMessage;
            } else {
              table.appendChild(row);
              previousRow = row;
              previousMessage = depCell.innerHTML;
              previousDestination = n.destination;
            }
            firstLine = false;
          }
          break;
        case "pluie":
          row = document.createElement("tr");
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.name || 'temps');
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.className = "align-left";
          secondCell.innerHTML = d.niveauPluieText.join('</br>');
          secondCell.colSpan = 2;
          row.appendChild(secondCell);
          table.appendChild(row);
        break;
      }
    }
    return wrapper;
  },

  socketNotificationReceived: function(notification, payload) {
    var maxVelibArchiveAge = this.config.velibTrendDay ? 24 * 60 * 60 : this.config.velibTrendTimeScale || 60 * 60;
    var velibArchiveCleaned = 0;
    var now = new Date();
    this.caller = notification;
    switch (notification) {
      case "DATA":
        this.infos = payload;
        this.loaded = true;
        break;
    }
  }
});

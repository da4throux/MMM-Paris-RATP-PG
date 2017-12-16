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
    maxTimeOffset: 200, // Max time in the future for entries
    useRealtime: true,
    updateInterval: 1 * 60 * 1000, //time in ms between pulling request for new times (update request)
    animationSpeed: 2000,
    convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
    initialLoadDelay: 0, // start delay seconds.
    apiBaseV3: 'https://api-ratp.pierre-grimaud.fr/v3/',
    maxLettersForDestination: 22, //will limit the length of the destination string
    concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
    showSecondsToNextUpdate: true,  // display a countdown to the next update pull (should I wait for a refresh before going ?)
    showLastUpdateTime: false,  //display the time when the last pulled occured (taste & color...)
    oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
    oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
    debug: false, //console.log more things to help debugging
    apiVelib: 'https://opendata.paris.fr/api/records/1.0/search/?dataset=stations-velib-disponibilites-en-temps-reel', // add &q=141111 to get info of that station
    velibGraphWidth: 400, //Height will follow
    apiAutolib: 'https://opendata.paris.fr/explore/dataset/stations_et_espaces_autolib_de_la_metropole_parisienne/api/', ///add '?q=' mais pas d'info temps réel... pour l'instant
    conversion: { "Trafic normal sur l'ensemble de la ligne." : 'Traffic OK'},
    pluie: true,
    pluieAPI: 'http://www.meteofrance.com/mf3-rpc-portlet/rest/pluie/',
    pluieUpdateInterval: 1 * 10 * 60 * 1000, //every 10 minutes
  },
  
  // Define required scripts.
  getStyles: function() {
    return ["MMM-Paris-RATP-Transport.css", "font-awesome.css"];
  },
  
  // Define start sequence.
  start: function() {
    Log.info("Starting module: " + this.name);
    this.sendSocketNotification('SET_CONFIG', this.config);
    this.busSchedules = {};
    this.ratpTraffic = {};
    this.ratpTrafficLastUpdate = {};
    this.velibHistory = {};
    this.busLastUpdate = {};
    this.loaded = false;
    this.updateTimer = null;
    this.pluieStatus = {};
    var self = this;
    setInterval(function () {
      self.caller = 'updateInterval';
      self.updateDom();
    }, 1000);
  },

  getHeader: function () {
    var header = this.data.header;
    if (this.config.showSecondsToNextUpdate) {
      var timeDifference = Math.round((this.config.updateInterval - new Date() + Date.parse(this.config.lastUpdate)) / 1000);
      if (timeDifference > 0) {
        header += ', next update in ' + timeDifference + 's';
      } else {
        header += ', update requested ' + Math.abs(timeDifference) + 's ago';
      }
    }
    if (this.config.showLastUpdateTime) {
      var now = this.config.lastUpdate;
      header += (now ? (' @ ' + now.getHours() + ':' + (now.getMinutes() > 9 ? '' : '0') + now.getMinutes() + ':' + (now.getSeconds() > 9 ? '' : '0') + now.getSeconds()) : '');
    }
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
    
    var table = document.createElement("table");
    var stopIndex;
    var previousRow, previousDestination, previousMessage, row, comingBus;
    var firstCell, secondCell;
    wrapper.appendChild(table);
    table.className = "small";

    for (var busIndex = 0; busIndex < this.config.busStations.length; busIndex++) {      
      var firstLine = true;
      var stop = this.config.busStations[busIndex];
      switch (stop.type) {
        case "traffic":
          stopIndex = 'traffic' + '/' + stop.line[0].toString().toLowerCase() + '/' + stop.line[1].toString().toLowerCase();
          row = document.createElement("tr");
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = stop.label || stop.line[1];
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.className = "align-left";
          secondCell.innerHTML = this.ratpTraffic[stopIndex] ? this.config.conversion[this.ratpTraffic[stopIndex].message] || this.ratpTraffic[stopIndex].message : 'N/A';
          secondCell.colSpan = 2;
          row.appendChild(secondCell);
          table.appendChild(row);
          break;
        case "bus":
        case "metros":
        case "tramways":
        case "rers":
          stopIndex = stop.line.toString().toLowerCase() + '/' + stop.stations + '/' + stop.destination;
          var comingBuses = this.busSchedules[stopIndex] || [{message: 'N/A', destination: 'N/A'}];
          var comingBusLastUpdate = this.busLastUpdate[stopIndex];
          for (var comingIndex = 0; (comingIndex < this.config.maximumEntries) && (comingIndex < comingBuses.length); comingIndex++) {
            row = document.createElement("tr");
            comingBus = comingBuses[comingIndex];
            var busNameCell = document.createElement("td");
            busNameCell.className = "align-right bright";
            if (firstLine) {
              busNameCell.innerHTML = stop.label || stop.line;
            } else {
              busNameCell.innerHTML = ' ';
            }
            row.appendChild(busNameCell);

            var busDestination = document.createElement("td");
            busDestination.innerHTML = comingBus.destination.substr(0, this.config.maxLettersForDestination);
            busDestination.className = "align-left";
            row.appendChild(busDestination);

            var depCell = document.createElement("td");
            depCell.className = "bright";
            if (!this.busSchedules[stopIndex]) {
              depCell.innerHTML = "N/A ";
            } else {
              if (this.config.convertToWaitingTime && /^\d{1,2}[:][0-5][0-9]$/.test(comingBus.message)) {
                var transportTime = comingBus.message.split(':');
                var endDate = new Date(0, 0, 0, transportTime[0], transportTime[1]);
                var startDate = new Date(0, 0, 0, now.getHours(), now.getMinutes(), now.getSeconds());
                var waitingTime = endDate - startDate;
                if (startDate > endDate) {
                  waitingTime += 1000 * 60 * 60 * 24;
                }
                waitingTime = Math.floor(waitingTime / 1000 / 60);
                depCell.innerHTML = waitingTime + ' mn';
              } else {
                depCell.innerHTML = comingBus.message;
              }
            }
            depCell.innerHTML = depCell.innerHTML.substr(0, this.config.maxLettersForTime);
            row.appendChild(depCell);
            if ((new Date() - Date.parse(comingBusLastUpdate)) > (this.config.oldUpdateThreshold ? this.config.oldUpdateThreshold : (this.config.updateInterval * (1 + this.config.oldThreshold)) )) {
              busDestination.style.opacity = this.config.oldUpdateOpacity;
              depCell.style.opacity = this.config.oldUpdateOpacity;
            }
            if (this.config.concatenateArrivals && !firstLine && (comingBus.destination == previousDestination)) {
              previousMessage += ' / ' + comingBus.message;
              previousRow.getElementsByTagName('td')[2].innerHTML = previousMessage;
            } else {
              table.appendChild(row);
              previousRow = row;
              previousMessage = comingBus.message;
              previousDestination = comingBus.destination;
            }
            firstLine = false;
          }
          break;
        case 'velib':
          row = document.createElement("tr");
          if (this.velibHistory[stop.stations]) {
            var station = this.velibHistory[stop.stations].slice(-1)[0];
            if (this.config.trendGraphOff) {
              var velibStation = document.createElement("td");
              velibStation.className = "align-left";
              velibStation.innerHTML = station.total;
              row.appendChild(velibStation);
              var velibStatus = document.createElement("td");
              velibStatus.className = "bright";
              velibStatus.innerHTML = station.bike + ' velibs ' + station.empty + ' spaces';
              row.appendChild(velibStatus);
              var velibName = document.createElement("td");
              velibName.className = "align-right";
              velibName.innerHTML = stop.label || station.name;
              row.appendChild(velibName);
            } else {
              var rowTrend = document.createElement("tr");
              var cellTrend = document.createElement("td");
              var trendGraph = document.createElement('canvas');
              trendGraph.className = "velibTrendGraph";
              trendGraph.width  = this.config.velibTrendWidth || 400;
              trendGraph.height = this.config.velibTrendHeight || 100;
              trendGraph.timeScale = this.config.velibTrendDay ? 24 * 60 * 60 : this.config.velibTrendTimeScale || 60 * 60; // in nb of seconds, the previous hour
              this.config.velibTrendZoom = this.config.velibTrendZoom || 30 * 60; //default zoom windows is 30 minutes for velibTrendDay
              var ctx = trendGraph.getContext('2d');
              var currentStation = this.velibHistory[stop.stations];
              var previousX = trendGraph.width;
              var inTime = false;
              for (var dataIndex = currentStation.length - 1; dataIndex >= 0 ; dataIndex--) { //start from most recent
                var dataTimeStamp = (now - new Date(currentStation[dataIndex].lastUpdate)) / 1000; // time of the event in seconds ago
                if (dataTimeStamp < trendGraph.timeScale || inTime) {
                  inTime = dataTimeStamp < trendGraph.timeScale; // compute the last one outside of the time window
                  if (dataTimeStamp - trendGraph.timeScale < 10 * 60) { //takes it only if it is within 10 minutes of the closing windows
                    dataTimeStamp = Math.min(dataTimeStamp, trendGraph.timeScale); //to be sure it does not exit the graph
                    var x, y;
                    if (this.config.velibTrendDay) {
                      if ( dataTimeStamp  < this.config.velibTrendZoom ) { //1st third in zoom mode
                        x = (1 - dataTimeStamp / this.config.velibTrendZoom / 3) * trendGraph.width;
                      } else if (dataTimeStamp < trendGraph.timeScale - this.config.velibTrendZoom) { //middle in compressed mode
                        x = (2/3 - (dataTimeStamp - this.config.velibTrendZoom) / (trendGraph.timeScale - 2 * this.config.velibTrendZoom)/ 3) * trendGraph.width;
                      } else {
                        x = (1 / 3 - (dataTimeStamp - trendGraph.timeScale + this.config.velibTrendZoom)/ this.config.velibTrendZoom / 3) * trendGraph.width;
                      }
                    } else {
                      x = (1 - dataTimeStamp / trendGraph.timeScale) * trendGraph.width;
                    }
                    y = currentStation[dataIndex].bike / currentStation[dataIndex].total * trendGraph.height * 4 / 5;
                    ctx.fillStyle = 'white';
                    ctx.fillRect(x, trendGraph.height - y - 1, previousX - x, Math.max(y, 1)); //a thin line even if it's zero
                    previousX = x;
                  }
                }
              }
//              var bodyStyle = window.getComputedStyle(document.getElementsByTagName('body')[0], null);
//              ctx.font = bodyStyle.getPropertyValue(('font-size')) + ' ' + ctx.font.split(' ').slice(-1)[0]; //00px sans-serif
              ctx.font = Math.round(trendGraph.height / 5) + 'px ' + ctx.font.split(' ').slice(-1)[0];
              ctx.fillStyle = 'grey';
              ctx.textAlign = 'center';
              ctx.fillText(stop.label || station.name, trendGraph.width / 2, Math.round(trendGraph.height / 5));
              ctx.textAlign = 'left';
              ctx.fillText(station.bike, 10, trendGraph.height - 10);
              ctx.fillText(station.empty, 10, Math.round(trendGraph.height / 5) + 10);
              if (this.config.velibTrendDay) {
                ctx.font = Math.round(trendGraph.height / 10) + 'px ' + ctx.font.split(' ').slice(-1)[0];
                ctx.fillText(Math.round(this.config.velibTrendZoom / 60) + 'mn', trendGraph.width * 5 / 6, trendGraph.height / 2);
                ctx.fillText(Math.round(this.config.velibTrendZoom / 60) + 'mn', trendGraph.width / 6, trendGraph.height / 2);
                ctx.strokeStyle = 'grey';
                ctx.setLineDash([5, 15]);
                ctx.beginPath();
                ctx.moveTo(2/3 * trendGraph.width, 0);
                ctx.lineTo(2/3 * trendGraph.width, 100);
                ctx.stroke();
                ctx.moveTo(trendGraph.width / 3, 0);
                ctx.lineTo(trendGraph.width / 3, 100);
                ctx.stroke();
                var hourMark = new Date(); var alpha;
                hourMark.setMinutes(0); hourMark.setSeconds(0);
                alpha = (hourMark - now + 24 * 60 * 60 * 1000 - this.config.velibTrendZoom * 1000) / (24 * 60 * 60 * 1000 - 2 * this.config.velibTrendZoom * 1000);
                alpha = (hourMark - now + this.config.velibTrendZoom * 1000) / (24 * 60 * 60 * 1000) * trendGraph.width;
                for (var h = 0; h < 24; h = h + 2) {
                  ctx.fillStyle = 'red';
                  ctx.textAlign = 'center';
                  ctx.font = Math.round(trendGraph.height / 12) + 'px';
                  ctx.fillText((hourMark.getHours() + 24 - h) % 24, (2 - h / 24) * trendGraph.width / 3 + alpha, h % 12 * trendGraph.height / 12 / 3 + trendGraph.height / 3);
                }
              }
              cellTrend.colSpan = '3'; //so that it takes the whole row
              cellTrend.appendChild(trendGraph);
              rowTrend.appendChild(cellTrend);
              table.appendChild(rowTrend);
            }
          } else {
            var message = document.createElement("td");
            message.className = "bright";
            message.innerHTML = (stop.label || stop.stations) + ' no info yet';
            row.appendChild(message);
          }
          table.appendChild(row);
          break;
      }
    }
    if (this.config.pluie) {
      for (var index = 0; index < this.config.pluiePlaces.length; index++) {
        row = document.createElement("tr");
        firstCell = document.createElement("td");
        firstCell.className = "align-right bright";
        firstCell.innerHTML = this.config.pluiePlaces[index].name;
        row.appendChild(firstCell);
        secondCell = document.createElement("td");
        secondCell.className = "align-left";
        secondCell.innerHTML = this.pluieStatus[this.config.pluiePlaces[index].id] ? this.pluieStatus[this.config.pluiePlaces[index].id].niveauPluieText.join('</br>') : 'N/A';
        secondCell.colSpan = 2;
        row.appendChild(secondCell);
        table.appendChild(row);
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
      case "BUS":
        this.busSchedules[payload.id] = payload.schedules;
        this.busLastUpdate[payload.id] = payload.lastUpdate;
        this.loaded = true;
        this.updateDom();
        break;
      case "VELIB":
        if (!this.velibHistory[payload.id]) { // loading of data
          this.velibHistory[payload.id] = localStorage[payload.id] ? JSON.parse(localStorage[payload.id]) : [];
          while ((this.velibHistory[payload.id].length > 0) && (((now - new Date(this.velibHistory[payload.id][0].lastUpdate)) / 1000) > maxVelibArchiveAge) ) {
            this.velibHistory[payload.id].shift();
            velibArchiveCleaned++;
          }
          if (this.config.debug) {
            console.log (' *** First load size of velib History for ' + payload.id + ' is: ' + this.velibHistory[payload.id].length);
            console.log (velibArchiveCleaned + ' elements removed');
            console.log (this.velibHistory[payload.id]);
          }
          this.velibHistory[payload.id].push(payload);
          localStorage[payload.id] = JSON.stringify(this.velibHistory[payload.id]);
          if (this.config.debug) {console.log (' *** size of velib History for ' + payload.id + ' is: ' + this.velibHistory[payload.id].length);}
          this.updateDom();
        } else if (this.velibHistory[payload.id][this.velibHistory[payload.id].length - 1].lastUpdate != payload.lastUpdate) {
          while ((this.velibHistory[payload.id].length > 0) && (((now - new Date(this.velibHistory[payload.id][0].lastUpdate)) / 1000) > maxVelibArchiveAge) ) {
            this.velibHistory[payload.id].shift();
            velibArchiveCleaned++;
          }
          this.velibHistory[payload.id].push(payload);
          localStorage[payload.id] = JSON.stringify(this.velibHistory[payload.id]);
          this.updateDom();
          if (this.config.debug) {
            console.log (' *** Update - size of velib History for ' + payload.id + ' is: ' + this.velibHistory[payload.id].length);
            console.log (velibArchiveCleaned + ' elements removed');
            console.log (this.velibHistory[payload.id]);
          }
        } else {
          if (this.config.debug) {
            console.log(' *** redundant velib payload for ' + payload.id + ' with time ' + payload.lastUpdate + ' && ' + this.velibHistory[payload.id][this.velibHistory[payload.id].length - 1].lastUpdate);
          }
        }
        this.loaded = true;
        break;
      case "TRAFFIC":
        if (this.config.debug) {
          console.log(' *** received traffic information for: ' + payload.id);
          console.log(payload);
        }
        this.ratpTraffic[payload.id] = payload;
        this.ratpTrafficLastUpdate[payload.id] = payload.lastUpdate;
        this.loaded = true;
        this.updateDom();
        break;
      case "UPDATE":
        this.config.lastUpdate = payload.lastUpdate;
        this.updateDom();
        break;
      case "PLUIE":
        if (this.config.debug) {
          console.log(' *** received pluie information for: ' + payload.id);
          console.log(payload);
        }
        pluieTypes = JSON.parse(localStorage['pluieTypes'] || '[]');
        pluieTypesChanged = false;
        for (var index = 0; index < payload.niveauPluieText.length; index++) {
          pluieType = payload.niveauPluieText[index].split(":").pop();
          if (!pluieTypes.includes(pluieType)) {
            pluieTypes.push(pluieType);
            pluieTypesChanged = true;
          }
        }
        if (pluieTypesChanged) {
          console.log ('*** new pluieType: ') + JSON.stringify(pluieTypes);
          localStorage['pluieTypes'] = JSON.stringify(pluieTypes);
        }
        localStorage['pluieTypes'] = JSON.stringify(pluieTypes);
        this.pluieStatus[payload.id] = payload;
        this.loaded = true;
        this.updateDom();
        break;
    }
  }
});

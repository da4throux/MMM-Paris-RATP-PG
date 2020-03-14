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
    animationSpeed: 2000,
    debug: false, //console.log more things to help debugging
    pluie_api:  'http://www.meteofrance.com/mf3-rpc-portlet/rest/pluie/',
    ratp_api: 'https://api-ratp.pierre-grimaud.fr/v4/',
    autolib_api: 'https://opendata.paris.fr/api/records/1.0/search/?dataset=autolib-disponibilite-temps-reel&refine.public_name=',
    velib_api: 'https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&refine.stationcode=',
    velib_api_max: 5000, //nb of request max par jour
    conversion: { "Trafic normal sur l'ensemble de la ligne." : 'Traffic OK'},
    reorder: false, //no reorder of rers schedule (seems to be quite rare)
    reordered: 0,
    reorderPotential: 0,
    pluieIconConverter: {
      "Pas de précipitations" : 'wi-day-cloudy',
      "Précipitations faibles": 'wi-day-showers',
      "Précipitations modérés": 'wi-day-rain',
      "Précipidations fortes": 'wi-day-storm-showers',
    },
    pluieIconColors: {
      "Pas de précipitations" : 'blue',
      "Précipitations faibles": 'yellow',
      "Précipitations modérés": 'orange',
      "Précipidations fortes": 'red',
    },
    autolibIconConverter: {
     "cars" : 'car',
     "parking" : 'map-marker',
     "utilib" : 'wrench',
     "utilib-0.9" : 'cube',
     "utilib-1.4" : 'cubes',
     "charge" : 'bolt',
     "closed" : 'window-close',
   },
   line_template: {
      updateInterval: 1 * 60 * 1000,
      maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
      maxLettersForDestination: 22, //will limit the length of the destination string
      maxLetters: 70, //will limit the length of other second column messages
      convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
      concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
      initialLoadDelay: 0, // start delay seconds
      showUpdateAge: true,
      pluieAsText: false,
      velibTrendDay : true,
      conversion: {},
      hideTraffic: [],
    },
    updateDomFrequence: 10000,
  },

  // Define required scripts.
  getStyles: function() {
    return ["MMM-Paris-RATP-Transport.css", "font-awesome.css", "weather-icons.css"];
  },

  cleanStoreVelibHistory: function(_l, _first) {
    var now = new Date();
    var j, velib, evelib, dock, maxVelibArchiveAge, velibArchiveCleaned, oldHistory;
    if (_first) {
      //récupération de l'historique si existant et cleaning
      _l.velibHistory = localStorage['velib-' + _l.stationId] ? JSON.parse(localStorage['velib-' + _l.stationId]) : [];
    }
    velibArchiveCleaned = 0;
    maxVelibArchiveAge = _l.velibTrendDay ? 24 * 60 * 60 : _l.velibTrendTimeScale || 60 * 60;
    oldHistory = _l.velibHistory;
    //remove old lines, but keep at least one out of frame if any
    while ((oldHistory.length > 1) && ((((now - new Date(oldHistory[1].lastUpdate)) / 1000) > maxVelibArchiveAge) || !oldHistory[1].lastUpdate) ) {
      oldHistory.shift();
    }
    _l.velibHistory = [];
    if (oldHistory.length > 0 && oldHistory[0].data) {
      oldHistory[0].data.update = oldHistory[0].data.update ? oldHistory[0].data.update : oldHistory[0].lastUpdate;
      _l.velibHistory.push(oldHistory[0]);
      velib = oldHistory[0].data.nbbike;
      evelib = oldHistory[0].data.nbebike;
      dock = oldHistory[0].data.nbfreeedock;
      for (j = 1; j < oldHistory.length; j++) {
        if (velib !== oldHistory[j].data.nbbike || oldHistory[j].data.nbfreeedock !== dock || evelib != oldHistory[j].data.nbebike) {
          oldHistory[j].data.update = oldHistory[j].data.update ? oldHistory[j].data.update : oldHistory[j].lastUpdate;
          velib = oldHistory[j].data.nbbike
          evelib = oldHistory[j].data.nbebike;
          dock = oldHistory[j].data.nbfreeedock;
          _l.velibHistory.push(oldHistory[j]);
        } else {
          _l.velibHistory[_l.velibHistory.length - 1].lastUpdate = oldHistory[j].lastUpdate;
        }
      }
    }
    localStorage['velib-' + _l.stationId] = JSON.stringify(_l.velibHistory);
    if (this.config.debug && _first) {
      console.log ('First load size of velib History for ' + _l.stationId + ' is: ' + _l.velibHistory.length);
      console.log (velibArchiveCleaned + ' elements removed');
      console.log (_l.velibHistory);
    }
    return true;
  },

  // Define start sequence.
  start: function() {
    var l, i, nb_velib = 0, velibs = [];
    Log.info("Starting module: " + this.name);
    this.config.infos = [];
    this.traffic = [];
    if (!this.config.lines) {
      this.config.lines = this.config.busStations || []; //v1 legacy support for migration
    }
    for (i=0; i < this.config.lines.length; i++) {
      this.config.infos[i]={};
      l = Object.assign(JSON.parse(JSON.stringify(this.config.line_template)),
        JSON.parse(JSON.stringify(this.config.lineDefault || {})),
        JSON.parse(JSON.stringify(this.config.lines[i])));
      l.id = i;
      switch (l.type) {
        case 'tramways':
        case 'bus':
        case 'buses':
        case 'rers':
        case 'metros':
          if (l.type == 'bus') { l.type = 'buses';} //to avoid update config from v3 to v4
          l.url = this.config.ratp_api + 'schedules/' + l.type + '/' + l.line.toString().toLowerCase() + '/' + l.stations + '/' + l.destination; // get schedule for that bus
          break;
        case 'traffic':
          l.url = this.config.ratp_api + 'traffic/' +l.line[0] + '/' + l.line[1];
          break;
        case 'pluie':
          l.url = this.config.pluie_api + l.place;
          break;
        case 'autolib':
          l.url = this.config.autolib_api + l.name;
          break;
        case 'velib':
          l.url = this.config.velib_api + l.stationId;
          nb_velib++;
          velibs.push(l);
          if (l.velibGraph || l.keepVelibHistory) {
            this.cleanStoreVelibHistory(l, true);
          }
          break;
        default:
          if (this.config.debug) { console.log('Unknown request type: ' + l.type)}
      }
      this.config.lines[i] = l;
    }
    if (nb_velib > 0) {
      for (i = 0; i < velibs.length; i++) {
        velibs[i].updateInterval = Math.max(Math.ceil(24 * 60 * 60 / this.config.velib_api_max * nb_velib) * 1000, velibs[i].updateInterval);
      }
      console.log ('MMM RATP: setting velib update Interval to: ' + Math.ceil( 24 * 60 * 60 / this.config.velib_api_max * nb_velib) + 's');
    }
    this.sendSocketNotification('SET_CONFIG', this.config);
    this.loaded = false;
    var self = this;
    setInterval(function () {
      self.caller = 'updateInterval';
      self.updateDom();
    }, this.config.updateDomFrequence);
  },

  getHeader: function () {
    var header = this.data.header;
    return header;
  },

  buildVelibGraph: function(l, d) {
    var dataIndex, dataTimeStamp, now = new Date();
    var rowTrend = document.createElement("tr");
    var cellTrend = document.createElement("td");
    var trendGraph = document.createElement('canvas');
    trendGraph.className = "velibTrendGraph";
    trendGraph.width  = l.velibTrendWidth || 400;
    trendGraph.height = l.velibTrendHeight || 100;
    trendGraph.timeScale = l.velibTrendDay ? 24 * 60 * 60 : l.velibTrendTimeScale || 60 * 60; // in nb of seconds, the previous hour
    l.velibTrendZoom = l.velibTrendZoom || 30 * 60; //default zoom windows is 30 minutes for velibTrendDay
    var ctx = trendGraph.getContext('2d');
    var currentStation = l.stationId;
    var previousX = trendGraph.width;
    var inTime = false;
    for (dataIndex = l.velibHistory.length - 1; dataIndex >= 0 ; dataIndex--) { //start from most recent
      dataTimeStamp = (now - new Date(l.velibHistory[dataIndex].data.update)) / 1000; // time of the event in seconds ago
      if (dataTimeStamp < trendGraph.timeScale || inTime) {
        inTime = dataTimeStamp < trendGraph.timeScale; // compute the last one outside of the time window
        if (dataTimeStamp - trendGraph.timeScale < 10 * 60) { //takes it only if it is within 10 minutes of the closing windows
          dataTimeStamp = Math.min(dataTimeStamp, trendGraph.timeScale); //to be sure it does not exit the graph
          var x, y, ye;
          if (l.velibTrendDay) {
            if ( dataTimeStamp  < l.velibTrendZoom ) { //1st third in zoom mode
              x = (1 - dataTimeStamp / l.velibTrendZoom / 3) * trendGraph.width;
            } else if (dataTimeStamp < trendGraph.timeScale - l.velibTrendZoom) { //middle in compressed mode
              x = (2/3 - (dataTimeStamp - l.velibTrendZoom) / (trendGraph.timeScale - 2 * l.velibTrendZoom)/ 3) * trendGraph.width;
            } else {
              x = (1 / 3 - (dataTimeStamp - trendGraph.timeScale + l.velibTrendZoom)/ l.velibTrendZoom / 3) * trendGraph.width;
            }
          } else {
            x = (1 - dataTimeStamp / trendGraph.timeScale) * trendGraph.width;
          }
          y = (l.velibHistory[dataIndex].data['nbbike'] + l.velibHistory[dataIndex].data['nbebike']) / l.velibHistory[dataIndex].data['nbedock'] * trendGraph.height * 4 / 5;
          ye = (l.velibHistory[dataIndex].data['nbebike']) / l.velibHistory[dataIndex].data['nbedock'] * trendGraph.height * 4 / 5;
          ctx.fillStyle = 'white';
          ctx.fillRect(x, trendGraph.height - y - 1, previousX - x, Math.max(y, 1)); //a thin line even if it's zero
          ctx.fillStyle = 'blue';
          ctx.fillRect(x, trendGraph.height - ye - 1, previousX - x, Math.max(ye, 1)); //electric bike graph
          previousX = x;
        }
      }
    }
//              var bodyStyle = window.getComputedStyle(document.getElementsByTagName('body')[0], null);
//              ctx.font = bodyStyle.getPropertyValue(('font-size')) + ' ' + ctx.font.split(' ').slice(-1)[0]; //00px sans-serif
    ctx.font = Math.round(trendGraph.height / 5) + 'px ' + ctx.font.split(' ').slice(-1)[0];
    ctx.fillStyle = 'grey';
    ctx.textAlign = 'center';
    ctx.fillText(l.label || l.name, trendGraph.width / 2, Math.round(trendGraph.height / 5));
    ctx.textAlign = 'left';
    ctx.fillText(d.data['nbbike'] + d.data['nbebike'], 10, trendGraph.height - 10);
    ctx.fillText(d.data['nbedock'], 10, Math.round(trendGraph.height / 5) + 10);
    if (l.velibTrendDay) {
      ctx.font = Math.round(trendGraph.height / 10) + 'px ' + ctx.font.split(' ').slice(-1)[0];
      ctx.fillText(Math.round(l.velibTrendZoom / 60) + 'mn', trendGraph.width * 5 / 6, trendGraph.height / 2);
      ctx.fillText(Math.round(l.velibTrendZoom / 60) + 'mn', trendGraph.width / 6, trendGraph.height / 2);
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
      alpha = (hourMark - now + 24 * 60 * 60 * 1000 - l.velibTrendZoom * 1000) / (24 * 60 * 60 * 1000 - 2 * l.velibTrendZoom * 1000);
      alpha = (hourMark - now + l.velibTrendZoom * 1000) / (24 * 60 * 60 * 1000) * trendGraph.width;
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
    return (rowTrend);
  },

  // Override dom generator.
  getDom: function() {
    var now = new Date();
    var wrapper = document.createElement("div");
    var lines = this.config.lines;
    var i, j, l, d, n, firstLine, delta, lineColor, cars, currentHistory;
    var table = document.createElement("table");
    var stopIndex, firstCell, secondCell;
    var previousRow, previousDestination, previousMessage, row, comingBus, iconSize, nexts;
    if (lines.length > 0) {
      if (!this.loaded) {
        wrapper.innerHTML = "Loading connections ...";
        wrapper.className = "dimmed light small";
        return wrapper;
      } else {
        wrapper.className = "paristransport";
        wrapper.appendChild(table);
        table.className = "small";
      }
    } else {
      wrapper.className = "small";
      wrapper.innerHTML = "Configuration now requires a 'lines' element.<br />Check github da4throux/MMM-Paris-RATP-PG<br />for more information";
    }
    if (this.config.busStations) {
      row = document.createElement("tr");
      firstCell = document.createElement("td");
      firstCell.innerHTML = "Configuration now requires to rename your 'busStations' element in 'lines'.<br />Check github da4throux/MMM-Paris-RATP-PG<br />for more information";
      firstCell.className = "dimmed light small";
      firstCell.colSpan = 3;
      row.appendChild(firstCell);
      table.appendChild(row);
    }
    for (i = 0; i < lines.length; i++) {
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
      lineColor = l.lineColor ? 'color:' + l.lineColor + ' !important' : false;
      switch (l.type) {
        case "traffic":
          row = document.createElement("tr");
          row.id = 'line-' + i;
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.label || l.line[1]);
          if (lineColor) {
              firstCell.setAttribute('style', lineColor);
          }
          if (l.firstCellColor) {
              firstCell.setAttribute('style', 'color:' + l.firstCellColor + ' !important');
          }
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.className = "align-left";
          if (d.status && l.hideTraffic.indexOf(d.status.message) < 0 && this.traffic.indexOf(d.status.message) < 0) {
            this.traffic.push(d.status.message);
            if (this.config.debug) { console.warn(this.traffic); } //to find it more easily
          }
          secondCell.innerHTML = d.status ? l.conversion[d.status.message] || d.status.message.substr(0, l.maxLetters) : 'N/A';
          secondCell.colSpan = 2;
          if (lineColor) {
              secondCell.setAttribute('style', lineColor);
          }
          row.appendChild(secondCell);
          if (l.hideTraffic.indexOf(d.status.message) < 0) {
            table.appendChild(row);
          }
          break;
        case "buses":
        case "metros":
        case "tramways":
        case "rers":
          nexts = d.schedules || [{message: 'N/A', destination: 'N/A'}];
          let currentEntries = 0;
          for (var rank = 0; (currentEntries < l.maximumEntries) && (rank < nexts.length); rank++) {
            let showEntry = true;
            n = nexts[rank]; //next transport
            if (l.type == 'rers' && l.mission1 && l.mission1.indexOf(n.code[0]) < 0) {
                showEntry = false;
            }
            if (l.type == 'rers' && l.mission2 && l.mission2.indexOf(n.code[1]) < 0) {
                showEntry = false;
            }
            if (showEntry) {
              currentEntries++;
              row = document.createElement("tr");
              row.id = 'line-' + i + '-' + 'rank';
              var firstCell = document.createElement("td");
              firstCell.className = "align-right bright";
              firstCell.innerHTML = firstLine ? firstCellHeader + (l.label || l.line) : ' ';
              if (lineColor) {
                firstCell.setAttribute('style', lineColor);
              }
              if (l.firstCellColor) {
                firstCell.setAttribute('style', 'color:' + l.firstCellColor + ' !important');
              }
              row.appendChild(firstCell);
              var destinationCell = document.createElement("td");
              destinationCell.innerHTML = l.conversion[n.destination] || n.destination.substr(0, l.maxLettersForDestination);
              destinationCell.className = "align-left";
              if (lineColor) {
                destinationCell.setAttribute('style', lineColor);
              }
              row.appendChild(destinationCell);
              var depCell = document.createElement("td");
              depCell.className = "bright";
              if (l.convertToWaitingTime && /^\d{1,2}[:][0-5][0-9]$/.test(n.message)) {
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
                depCell.innerHTML = l.conversion[n.message] || n.message.substr(0, l.maxLetters);
              }
              if (lineColor) {
                depCell.setAttribute('style', lineColor);
              }
              row.appendChild(depCell);
              if (l.concatenateArrivals && !firstLine && (n.destination == previousDestination)) {
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
          }
          break;
        case "pluie":
          row = document.createElement("tr");
          row.id = 'line-' + i;
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.label || l.place);
          if (lineColor) {
            firstCell.setAttribute('style', lineColor);
          }
          if (l.firstCellColor) {
            firstCell.setAttribute('style', 'color:' + l.firstCellColor + ' !important');
          }
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.colSpan = 2;
          if (lineColor) {
            secondCell.setAttribute('style', lineColor);
          }
          if (l.pluieAsText) {
            secondCell.className = "align-left";
            secondCell.innerHTML = d.niveauPluieText.join('</br>');
          } else {
            secondCell.className = "align-center";
            secondCell.innerHTML = '';
            iconSize = l.iconSize ? "font-size: " + l.iconSize + "em" : "";
            for (j = 0; j < d.dataCadran.length; j++) {
              var iconColor = '';
              iconColor = l.pluieNoColor ? '' : 'color:' + this.config.pluieIconColors[d.dataCadran[j].niveauPluieText] + ' !important;';
              secondCell.innerHTML += '<i id="' + l.place + 'pluie' + j + '" class="wi ' + this.config.pluieIconConverter[d.dataCadran[j].niveauPluieText] + '" style="' + iconSize+ ';' + iconColor + '"></i>';
            }
          }
          row.appendChild(secondCell);
          table.appendChild(row);
          break;
        case "velib":
          if (l.keepVelibHistory || l.velibGraph) {
            l.velibHistory.push(d);
            this.cleanStoreVelibHistory(l);
          }
          row = document.createElement("tr");
          row.id = 'line-' + i;
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.label || l.stationId);
          if (lineColor) {
            firstCell.setAttribute('style', lineColor);
          }
          if (l.firstCellColor) {
            firstCell.setAttribute('style', 'color:' + l.firstCellColor + ' !important');
          }
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.colSpan = 2;
          if (lineColor) {
            secondCell.setAttribute('style', lineColor);
          }
          secondCell.style.align = "center";
          if (d.data && d.data.station_state == 'Operative') { //&&&
            secondCell.innerHTML = d.data['nbbike'] + '<i id="line-' + i + '-velib" class="fa fa-bicycle' + '"></i>&nbsp';
            secondCell.innerHTML += d.data['nbebike'] + '<i id="line-' + i + '-velib" class="fa fa-motorcycle' + '"></i>&nbsp';
            secondCell.innerHTML += d.data['nbfreeedock'] + '<i id="line-' + i + '-velibDock" class="fa fa-unlock' + '"></i>&nbsp';
          } else {
            secondCell.innerHTML = '<i id="line-' + i + '-velib" class="fa fa-window-close' + '"></i>&nbsp';
          }
          row.appendChild(secondCell);
          table.appendChild(row);
          if (l.velibGraph) {
            table.appendChild(this.buildVelibGraph(l, d));
          }
          break;
        case "autolib":
          row = document.createElement("tr");
          row.id = 'line-' + i;
          firstCell = document.createElement("td");
          firstCell.className = "align-right bright";
          firstCell.innerHTML = firstCellHeader + (l.label || l.place);
          if (lineColor) {
            firstCell.setAttribute('style', lineColor);
          }
          if (l.firstCellColor) {
            firstCell.setAttribute('style', 'color:' + l.firstCellColor + ' !important');
          }
          row.appendChild(firstCell);
          secondCell = document.createElement("td");
          secondCell.colSpan = 2;
          if (lineColor) {
            secondCell.setAttribute('style', lineColor);
          }
          autolib = d.data['cars_counter_bluecar'];
          cars = autolib + d.data['cars_counter_utilib_1.4'] + d.data['cars_counter_utilib'];
          l.empty = cars < 1;
          //secondCell.className = "aligncenter";
          secondCell.style.align = "center";
          secondCell.innerHTML = (l.utilib ? autolib : cars)
            + '<i id="line-' + i + '-voitures" class="fa fa-' + this.config.autolibIconConverter['cars'] + '"></i>&nbsp';
          if (l.utilib) {
            secondCell.innerHTML +=
              d.data['cars_counter_utilib_1.4']
              + '<i id="line-' + i + '-utilib-1.4" class="fa fa-' + this.config.autolibIconConverter['utilib-1.4'] + '"></i>&nbsp'
              + d.data['cars_counter_utilib']
              + '<i id="line-' + i + '-utilib-0.9" class="fa fa-' + this.config.autolibIconConverter['utilib-0.9'] + '"></i>&nbsp';
          }
          secondCell.innerHTML +=
              d.data.slots
              + '<i id="line-' + i + '-parking" class="fa fa-' + this.config.autolibIconConverter['parking'] + '"></i>&nbsp'
              + d.data['charge_slots']
              + '<i id="line-' + i + '-charge" class="fa fa-' + this.config.autolibIconConverter['charge'] + '"></i>';
          if (d.data.status === 'closed') {
            secondCell.innerHTML = '<i id="line-' + i + '-autolib" class="fa fa-' + this.config.autolibIconConverter['closed'] + '"></i>';
          }
          row.appendChild(secondCell);
          if (l.backup) {
            for (j = 0; j < lines.length; j++) {
              if ((lines[j].name === l.backup) && lines[j].empty) {
                table.appendChild(row);
                break;
              }
            }
          } else {
            table.appendChild(row);
          }
          break;
        default:
          if (this.config.debug) { console.log('Unknown request type: ' + l.type)}
      }
    }
    return wrapper;
  },

  socketNotificationReceived: function(notification, payload) {
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

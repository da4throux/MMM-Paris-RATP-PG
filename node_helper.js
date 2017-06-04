/* Magic Mirror
 * Module: MMM-Toulouse-Transports
 *
 * script from Telomere31 based on:
 * da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
 * (itself based on:
 *    a Script from  Georg Peters (https://lane6.de)
 *    band a Script from Benjamin Angst http://www.beny.ch
 * )
 * MIT Licensed.
 */

const NodeHelper = require( "node_helper" );
const unirest = require( 'unirest' );

var moment = require('moment');

//const synchronize = require('synchronize');
//const fiber = sync.fiber;
//const await = sync.await;
//const defer = sync.defer;


// for logger
const WARNING = "WARNING";
const INFO    = "INFO";
const ERROR   = "ERROR";
const DEBUG   = "DEBUG";
const TRACE   = "TRACE";

module.exports = NodeHelper.create( {

    contains : function (array, obj) {
        var i = array.length;
        while (i--) {
           if (array[i] === obj) {
               return true;
           }
        }
        return false;
    },

    start: function ( ) {
        this.log(TRACE, "start - start");
        this.started = false;


        this.neededTisseoLines = [];
        this.neededTisseoStops = [];

        // respective sizes should be identical
        this.uniqueLines = [];
        this.uniqueStops = [];

        // full list of required bus schedule data
        this.busScheduleData = {};
        this.busScheduleData.lastUpdate = new Date( );
        this.busScheduleData.loaded = false;
        this.busScheduleData.data = [];

        this.log(TRACE, "start - end");
    },

    log: function ( level, string) {
        switch (level) {
            case WARNING:
            case INFO:
            case ERROR:
                console.log(level + " MMM-Toulouse-Transports - " + string);
                break;
            case DEBUG:
            case TRACE:
                if ( "undefined" === typeof this.config) {
                    console.log("ERROR MMM-Toulouse-Transports - logger - configuration NOT SET YET. Logging anyway.");
                } else if ("undefined" === typeof this.config.debug) {
                    console.log("ERROR MMM-Toulouse-Transports - logger - DEBUG configuration variable NOT SET YET. Logging anyway");
                };
                console.log(level + " MMM-Toulouse-Transports - " + string);
                break;
        };
    },

    /*
     * Comm layer
     */
    socketNotificationReceived: function ( notification, payload ) {
        this.log(TRACE, "socketNotificationReceived - received: " + notification);
        if ( notification === 'SET_CONFIG' && this.started == false ) {
            this.config = payload;
            this.log(DEBUG, ' *** config set in node_helper: ' );
            this.log(DEBUG, JSON.stringify(payload));
            for(var i=0; i < this.config.stopSchedules.length; i++){
                var line = this.config.stopSchedules[i].lineNumber;
                var stop = this.config.stopSchedules[i].stopCode;
                if(! this.contains(this.uniqueLines, line)) {
                    this.uniqueLines.push(line);
                };
                if(! this.contains(this.uniqueStops,stop)) {
                    this.uniqueStops.push(stop);
                };
            };
        };
        if (notification === 'UPDATE_GLOBAL_TISSEO_DATA' && this.started == false ) {
            this.log(TRACE, ' *** call Update Lines list');
            this.updateAllTisseoData();
            this.started = true;
            this.log(TRACE, "socketNotificationReceived - schedule update of bus data (call scheduleBusScheduleUpdate())");
            this.scheduleBusScheduleUpdate(this.config.initialLoadDelay);
        };
        if (notification === 'UPDATE_BUS_SCHEDULES' && this.started == true) {
            this.log(TRACE, ' *** call Update Bus Schedules' );
            this.scheduleBusScheduleUpdate(this.config.initialLoadDelay);
        };
    },

    updateLineInfo: function(index) {
        this.log(TRACE, "updateLineInfo - start");
        var self = this;
        var nextIndex = index + 1;
        var apiKey = self.config.apiKey;
        if ( index <= self.config.stopSchedules.length - 1) {
            var lineShortName = self.config.stopSchedules[index].lineNumber;
            self.log(DEBUG, "updateLineInfo - iteration:" + index +" get Line data for: " + lineShortName);

            var urlGetLineId = 'https://api.tisseo.fr/v1/lines.json?network=Tiss%C3%A9o&shortName='+ lineShortName +'&key=' + apiKey;

            unirest.get( urlGetLineId )
                .headers( { 'Accept': 'text/html,application/xhtml+xml,application/xml;charset=utf-8' } )
                .end( function ( response ) {
                    //self.log(DEBUG, "updateLineInfo - response"+ JSON.stringify(response));
                    if ( response && response.statusCode >= 200 && response.statusCode < 300 && response.body ) {
                        //self.log(DEBUG, "updateLineInfo - REQUEST_END - the received Tisseo Lines: " + JSON.stringify(response.body));
                        self.log(DEBUG, "updateLineInfo - REQUEST_END - found the lineId=" + response.body.lines.line[0].id + " for lineNumber=" + lineShortName);
                        self.neededTisseoLines.push( {
                            lineNumber: lineShortName,
                            lineId: response.body.lines.line[0].id,
                            lineData: response.body
                        });
                        // do callback recursion ...
                        self.updateLineInfo(nextIndex);
                        self.updateStopInfo(self.config.stopSchedules[index].stopCode, response.body.lines.line[0].id);
                    } else {
                        if ( response ) {
                            self.log(DEBUG, 'updateLineInfo - REQUEST_END - *** partial response received - HTTP return code ='+response.statusCode);
                            self.log(DEBUG, 'updateLineInfo - REQUEST_END - ' + JSON.stringify(response));
                        } else {
                            self.log(DEBUG, 'updateLineInfo - REQUEST_END - *** no response received' );
                        };
                    };
                } );
        }
        this.log(TRACE, "updateLineInfo - end");
    },

    updateStopInfo: function (stopCode, lineId) {
        this.log(TRACE, "updateStopInfo - start - stopCode="+stopCode+" - lineId="+lineId);
        var self = this;
        var apiKey = self.config.apiKey;
        var urlAllStop = 'https://api.tisseo.fr/v1/stop_points.json?lineId=' + lineId +'&key=' + apiKey;
        unirest.get( urlAllStop )
            .headers( {'Accept': 'text/html,application/xhtml+xml,application/xml;charset=utf-8'} )
            .end( function ( response ) {
                if ( response && response.statusCode >= 200 && response.statusCode < 300 && response.body ) {
                    //self.log(DEBUG, "updateStopInfo - the received Tisseo stops: " + JSON.stringify(response.body));
                    for(var j = 0; j <= response.body.physicalStops.physicalStop.length - 1; j++) {
                        //self.log(DEBUG, "updateStopInfo - "+ JSON.stringify(response.body.physicalStops.physicalStop[j]));
                        var currentStopInfo = response.body.physicalStops.physicalStop[j];
                        var currentCode = currentStopInfo.operatorCodes[0].operatorCode.value;
                        if(currentCode == stopCode.toString() ) {
                            var stopId = currentStopInfo.id;
                            self.log(DEBUG, "updateStopInfo - REQUEST_END - found the stopId " + stopId + " for stopCode " + stopCode);
                            self.neededTisseoStops.push( {
                                stopCode: stopCode,
                                stopId: stopId
                            });
                            break;
                        };
                    };
                } else {
                        if ( response ) {
                            self.log(DEBUG, 'updateStopInfo - REQUEST_END - *** partial response received - HTTP return code ='+response.statusCode);
                            self.log(DEBUG, 'updateStopInfo - REQUEST_END - ' + JSON.stringify(response));
                        } else {
                            self.log(DEBUG, 'updateStopInfo - REQUEST_END - *** no response received' );
                        };
                };
            } );
        this.log(TRACE, "updateStopInfo - stop");
    },

    /**
     * Stores the full Tisseo Lines configuration
     */
    updateAllTisseoData : function( ) {
        this.log(TRACE, "updateAllTisseoData - start");
        var self = this;
        // reset local tables
        this.neededTisseoStops = [];
        this.neededTisseoLines = [];
        // get all necessary lines Data
        self.log(DEBUG, "updateAllTisseoData - itreations to do: "+ self.config.stopSchedules.length);
        // start lineId and stopID search chain
        self.updateLineInfo(0);
        this.log(TRACE, "updateAllTisseoData - end");
    },
    
    /* scheduleUpdate()
     * Schedule next update.
     * argument delay number - Millis econds before next update. If empty, this.config.updateInterval is used.
     */
    scheduleJourneysUpdate: function ( delay ) {
        this.log(TRACE, "scheduleJourneysUpdate - start");
        var nextLoad = this.config.updateInterval;
        if ( typeof delay !== "undefined" && delay >= 0 ) {
            nextLoad = delay;
        }
        var self = this;
        clearTimeout( this.updateTimer );
        this.updateTimer = setTimeout( function ( ) {
            self.updateJourneysTimetable( );
        }, nextLoad );
        this.log(TRACE, "scheduleJourneysUpdate - end");
    },

    scheduleBusScheduleUpdate: function ( delay ) {
        this.log(TRACE, "scheduleBusScheduleUpdate - start");
        var nextLoad = this.config.updateInterval;
        if ( typeof delay !== "undefined" && delay >= 0 ) {
            nextLoad = delay;
        }
        var self = this;
        clearTimeout( this.updateBusScheduleTimer );
        this.updateBusScheduleTimer = setTimeout( function ( ) {
            self.updateBusScheduleTimetable(0);
        }, nextLoad );
        this.log(TRACE, "scheduleBusScheduleUpdate - end");
    },
    
    updateJourneysTimetable: function () {
        this.log(TRACE, "updateJourneysTimetable - start");
        this.sendSocketNotification( "UPDATE_JOURNEYS", { lastUpdate: new Date( ) } );
        // Toulouse transportation system API
        var url = this.config.apiBase + '&maxTransferNumber='+ this.config.maxTransferNumber+'&departurePlace=' + this.config.departurePlace + '&arrivalPlace=' + this.config.arrivalPlace + '&displayResultTable' + '&displayWording=1' + '&key=' + this.config.apiKey;
        var self = this;
        var retry = true;
        this.log(TRACE, ' *** fetching: ' + url );
        unirest.get( url )
            .headers( {
                'Accept': 'text/html,application/xhtml+xml,application/xml;charset=utf-8'
            } )
            .end( function ( response ) {
                if ( response && response.statusCode >= 200 && response.statusCode < 300 && response.body ) {
                    self.processJourneys( response.body );
                } else {
                    if ( response ) {
                        self.log(DEBUG, ' *** partial response received' );
                        self.log(DEBUG, response );
                    } else {
                        self.log(DEBUG, ' *** no response received' );
                    }
                }
                if ( retry ) {
                    self.scheduleJourneysUpdate( ( self.loaded ) ? -1 : this.config.retryDelay );
                }
            } );
        //}
        this.log(TRACE, "updateJourneysTimetable - end");
    },
    
    /*
     *
     */
    updateBusScheduleTimetable: function (index) {
        this.log(TRACE, "updateBusScheduleTimetable - start - parameter: index="+index);
        this.sendSocketNotification( "UPDATE_BUS_SCHEDULES", { lastUpdate: new Date( ) } );
        var apiKey=this.config.apiKey;
        var self = this;
        var retry = true;
        var tableItem = {};
        // {
        //    lineId        : XXXXXXXXXXXXXX,
        //    lineShortName : XXXXXXXXXXXXXX,
        //    stopId        : XXXXXXXXXXXXXX,
        //    stopOpCode    : XXXXXXXXXXXXXX,
        //    scheduleData: []
        // }
        var scheduleData = [];
        //this.log(TRACE, "updateBusScheduleTimetable - unique lines size: "+ this.uniqueLines.length);
        //this.log(TRACE, "updateBusScheduleTimetable - unique stops size: "+ this.uniqueStops.length);
        //this.log(TRACE, "updateBusScheduleTimetable - grabbed lines size: "+ this.neededTisseoLines.length);
        //this.log(TRACE, "updateBusScheduleTimetable - grabbed stops size: "+ this.neededTisseoStops.length);
        if ( this.uniqueStops.length == this.neededTisseoStops.length &&
             this.uniqueLines.length == this.neededTisseoLines.length ) {
            // we have all stops and lines needed to work
            self.log(DEBUG, "updateBusScheduleTimetable -  all relevant Tisseo Data is present");
            if(index < this.config.stopSchedules.length) {
                // we progres in the table of required data
                self.log(DEBUG, "updateBusScheduleTimetable - iteration N°: " + index);
                currentStopConfig = this.config.stopSchedules[index];
                // 1- grab the lineId from given lineNumber
                var resultLine = this.findBusLineId(currentStopConfig.lineNumber);
                // 2- grab the stopId from given stopOperatorCode
                var resultStop = this.findStopId(currentStopConfig.stopCode);
                if ( !resultLine.error && !resultStop.error ) {
                    this.log(TRACE, "updateBusScheduleTimetable - lineId Found and stopId found");
                    // prepare table element to add
                    tableItem.lineId = resultLine;
                    tableItem.lineShortName = currentStopConfig.lineNumber;
                    tableItem.stopId = resultStop;
                    tableItem.stopOpCode = currentStopConfig.stopCode;
                    // 2- get associated schedule data
                    var url = this.config.apiBaseSchedules
                    + '&operatorCode='+ tableItem.stopOpCode
                    + '&lineId=' + tableItem.lineId
                    + '&displayRealTime=1'
                    + '&number=' + currentStopConfig.maxEntries
                    + '&key=' + apiKey;
                    this.log(TRACE, ' *** fetching: ' + url );
                    // get the data
                    unirest.get( url )
                        .headers({'Accept': 'text/html,application/xhtml+xml,application/xml;charset=utf-8'})
                        .end( function ( response ) {
                            if ( response && response.statusCode >= 200 && response.statusCode < 300 && response.body ) {
                                self.log(DEBUG, "updateBusScheduleTimetable - response.body.departures: " + JSON.stringify(response.body.departures));
                                tableItem.scheduleData = response.body.departures;
                                self.busScheduleData.data.push(tableItem);
                                self.log(DEBUG, "updateBusScheduleTimetable - tableItem: " + JSON.stringify(tableItem));
                                var nextIndex = index + 1;
                                self.updateBusScheduleTimetable(nextIndex);
                            } else {
                                if ( response ) {
                                    self.log(DEBUG, 'updateBusScheduleTimetable - *** partial response received - HTTP return code =' + response.statusCode);
                                    self.log(DEBUG, 'updateBusScheduleTimetable - ' + JSON.stringify(response));
                                } else {
                                    self.log(DEBUG, "updateBusScheduleTimetable - *** no response received" );
                                }
                            }
                            if ( retry ) {
                                self.scheduleBusScheduleUpdate( ( self.loaded ) ? -1 : this.config.retryDelay );
                            }
                        } );
                } // end if resultLine + resultStop
                else {
                    this.log(TRACE, "updateBusScheduleTimetable - Bus line id not found or stop Id not found ...");
                    this.log(DEBUG, "updateBusScheduleTimetable - return data for bus line " + resultLine);
                    this.log(DEBUG, "updateBusScheduleTimetable - return data for bus stop " + resultStop);
                };// end else esultLine + resultStop
            } // end if full tisseo data is present
            else {
                self.log(DEBUG, "updateBusScheduleTimetable - end of required data reached (" + index+"). Re-schedule update.");
                self.processBusScheduleData();
                self.scheduleBusScheduleUpdate( ( self.loaded ) ? -1 : this.config.retryDelay );
            }; // end else full tisseo data is present
        } // end if
        else {
            self.log(DEBUG, "updateBusScheduleTimetable - not all relevant Tisseo Data is present ==> reschedule");
            self.log(DEBUG, "updateBusScheduleTimetable - self.loaded="+self.loaded);
            self.log(DEBUG, "updateBusScheduleTimetable - this.config.retryDelay="+this.config.retryDelay);
            // reschedule
            self.scheduleBusScheduleUpdate( ( self.loaded ) ? -1 : this.config.retryDelay );
        };
        this.log(TRACE, "updateBusScheduleTimetable - end");
    },
    
    findBusLineId: function ( lineNumber) {
        this.log(TRACE, "findBusLineId - start");
        var returnData = {error: true, msg: 'not found'};
        this.log(TRACE, "findBusLineId - trying to find LineId for lineNumber: " + lineNumber);
        if (this.neededTisseoLines.length > 0) {
            // parse the tisseo lines data
            this.log(DEBUG, "findBusLineId - Number of known tisseo lines = " + this.neededTisseoLines.length);
            for( var i  = 0; i < this.neededTisseoLines.length; i++) {
                currentLine = this.neededTisseoLines[i];
                //this.log(DEBUG, "findBusLineId - currentLine = " + JSON.stringify(currentLine));
                if (currentLine.lineNumber == lineNumber.toString()) {
                    this.log(TRACE, "Processing - findBusLineId - lineId found:" + currentLine.lineId);
                    returnData = currentLine.lineId;
                    break;
                };
            };
        } else {
            returnData = {error: true, msg: "Could not find lineId for lineNumber: "+lineNumber+". neededTisseoLines not available !"};
        };
        this.log(TRACE, "findBusLineId - end");
        return returnData;
    },

    findStopId: function ( stopOperatorCode) {
        this.log(TRACE, "findStopId - start");
        var returnData = {error: true, msg: 'not found'};
        this.log(TRACE, "findStopId - trying to find stopId for stopOperatorCode : " + stopOperatorCode);
        if (this.neededTisseoStops.length > 0) {
            // parse the tisseo lines data
            this.log(DEBUG, "findStopId - length of stops found = " + this.neededTisseoStops.length);
            for( var i  = 0; i < this.neededTisseoStops.length ; i++) {
                currentStopInfo = this.neededTisseoStops[i];
                // sturcture is
                // {
                //    stopCode: stopCode,
                //    stopId: stopId
                // }
                if (currentStopInfo.stopCode == stopOperatorCode.toString()){
                    this.log(TRACE, "findStopId - stopId found:" + currentStopInfo.stopId);
                    returnData = currentStopInfo.stopId;
                    break;
                };
            };
        } else {
            returnData = {error: true, msg: "Could not find stopId for stopOperatorCode: " + stopOperatorCode + ". neededTisseoStops not available !"};
        };
        this.log(TRACE, "findStopId - end");
        return returnData;
    },

    /* send bus schedule data to module DOM management*/
    processBusScheduleData: function () {
        this.log(TRACE, "processBusScheduleData - start");
        this.log(DEBUG, "processBusScheduleData - sending the data to MM module. Data: ");
        this.busScheduleData.lastUpdate = new Date( );
        this.busScheduleData.loaded = true;
        this.log(DEBUG, "processBusScheduleData - " + JSON.stringify(this.busScheduleData));
        this.sendSocketNotification( "BUS_SCHEDULES", this.busScheduleData );
        // reset data
        this.busScheduleData = {};
        this.busScheduleData.lastUpdate = new Date( );
        this.busScheduleData.loaded = false;
        this.busScheduleData.data = [];
        this.log(TRACE, "processBusScheduleData - end");
    }
} );

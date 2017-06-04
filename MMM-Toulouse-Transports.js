// config is expected as follows:
/*
        {
            module: 'MMM-Toulouse-Transports',
            position: 'top_right',

            // pour trajets:
            //header: 'mes trajets à toulouse',

            // pour horaires
            header: 'Horaires de passage',
            config: {
                apiKey: '555f2a57-4b76-40cd-bb26-40965bc75d73',

                // pour trajets:
                //departurePlace: 'Arènes Toulouse', // free text address
                //arrivalPlace: 'Université Paul Sabatier Toulouse', // free text adddress



                // pour horaires
                stopSchedules: [
                    {
                        lineNumber: 22, // shall be >0
                        stopCode: 6601, // shall be >0
                        maxEntries:2    // shall be >1
                    },
                    {
                        lineNumber: 22, // shall be >0
                        stopCode: 431,  // shall be >0
                        maxEntries:2    // shall be >1
                    }
                ],

                debug: true,
                maximumEntries: 1,
                updateInterval: 120000,
                giveDetailedInstructions: false

                // pour trajets:
                //maxTransferNumber: 3,
            }
        }
*/

// var moment = require('moment');

Module.register( "MMM-Toulouse-Transports", {
    defaults: {
        //apiKey: '', // should be removed
        // pour trajets:
        // maxTransferNumber: '5',
        giveDetailedInstructions: false,
        // inherited from
        // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)

        // pour trajets:
        //maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
        maxTimeOffset: 200, // Max time in the future for entries
        useRealtime: true,
        updateInterval: 1 * 60 * 1000, //time in ms between pulling request for new times (update request)
        animationSpeed: 2000,
        convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
        initialLoadDelay: 0, // start delay seconds.
        // pour trajets:
        // apiBase: 'https://api.tisseo.fr/v1/journeys.json?',
        // pour horaires:
        apiBaseSchedules: 'https://api.tisseo.fr/v1/stops_schedules.json?',
        maxLettersForDestination: 22, //will limit the length of the destination string
        concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
        showSecondsToNextUpdate: true, // display a countdown to the next update pull (should I wait for a refresh before going ?)
        showLastUpdateTime: false, //display the time when the last pulled occured (taste & color...)
        oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
        oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
        retryDelay: 10 * 1000, // delay before data update retrys (ms)

        debug: false
    }, //console.log more things to help debugging

    /* Start Sequence*/
    start: function ( ) {
        Log.info("start - Starting module: " + this.name );
        Log.info("start - Send notification SET_CONFIG");
        // give config to node_helper
        this.sendSocketNotification( 'SET_CONFIG', this.config );

        // for bus schedules
        // ask to get all lines defininitions from API
        // only one call should be necessary for now
        Log.info("start - Send notification UPDATE_GLOBAL_TISSEO_DATA");
        this.sendSocketNotification( 'UPDATE_GLOBAL_TISSEO_DATA', null);

        // for journeys
        //this.allJourneys = [];
        //this.maxDepartureHour = '';
        //this.minArrivalHour = '';
        //this.roadMode = '';

        // for bus schedules
        this.busScheduleData = [];

        this.lastUpdate = new Date();
        this.loaded = false;
        this.updateTimer = null;


        var self = this;
        setInterval( function ( ) {
            self.updateDom( );
        }, 1000 );
        Log.info("start - End fo start for module: " + this.name );
    },


    getHeader: function ( ) {
        //Log.info("Start getHeader");
        var header = this.data.header;
        if ( this.config.showSecondsToNextUpdate ) {
            var timeDifference = Math.round( ( this.config.updateInterval - new Date( ) + Date.parse( this.config.lastUpdate ) ) / 1000 );
            if ( timeDifference > 0 ) {
                header += ', next update in ' + timeDifference + 's';
            } else {
                header += ', update requested ' + Math.abs( timeDifference ) + 's ago';
            }
        }
        if ( this.config.showLastUpdateTime ) {
            var now = this.config.lastUpdate;
            header += ( now ? ( ' @ ' + now.getHours( ) + ':' + ( now.getMinutes( ) > 9 ? '' : '0' ) + now.getMinutes( ) + ':' + ( now.getSeconds( ) > 9 ? '' : '0' ) + now.getSeconds( ) ) : '' );
        }

        //Log.info("End getHeader (before return statement)");
        return header;
    },

    getStyles: function () {
        //Log.info("Start getStyles");
        //Log.info("End getStyles (before return statement)");
        return ['font-awesome.css'];
    },


// following dom generation is intended for journeys display
// far from being sexy or optimum, but ... don't have time for fancy tuning now
// todo one day : allow to config module in journey mode and bus schedules mode
/*
    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    // Override dom generator.
    getDom: function ( ) {
        var now = new Date( );
        var wrapper = document.createElement( "div" );
        wrapper.classList.add("small");


        if ( !this.loaded ) {
            wrapper.innerHTML = "Loading journeys ...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        var uList = document.createElement( "ul" );
        uList.classList.add("fa-ul");
        uList.classList.add("small");

        for ( var journeyIndex = 0; journeyIndex < this.config.maximumEntries; journeyIndex++ ) {

            //if (this.config.debug) { Log.debug("JOURNEYS - " + JSON.stringify(this.allJourneys));}
            var departureDateTime = this.allJourneys[ journeyIndex ].journey.departureDateTime;
            var arrivalDateTime = this.allJourneys[ journeyIndex ].journey.arrivalDateTime;
            var duration = this.allJourneys[ journeyIndex ].journey.duration;

            var chunks = this.allJourneys[ journeyIndex ].journey.chunks;
            if (this.config.debug) {
                Log.debug("JOURNEYS - There are " + chunks.length + " chunk(s)");
            }

            var stepIndex = 0;

            while ( stepIndex < chunks.length ) {
                var listElement = document.createElement( "li" );
                //listElement.classList.add("fa");
                listElement.classList.add("small");
                //listElement.style.textAlign = 'left';

                var icon = document.createElement("i");
                icon.classList.add("fa-fw");
                // <i class="fa fa-subway" aria-hidden="true"></i>
                // <i class="fa fa-train" aria-hidden="true"></i>
                //'<i class="fa fa-street-view" aria-hidden="true"></i>';
                if(this.config.giveDetailedInstructions && chunks[ stepIndex ]["street"] != null){
                    icon.classList.add("fa-li", "fa", "fa-blind");
                    listElement.appendChild(icon);

                    listElement.innerHTML += chunks[ stepIndex ].street.text.text;
                }
                else if (chunks[ stepIndex ]["stop"] != null) {
                    icon.classList.add("fa-li", "fa", "fa-exchange");
                    icon.classList.add("dimmed");
                    listElement.appendChild(icon);

                    listElement.innerHTML += chunks[ stepIndex ].stop.text.text;
                }
                else if (chunks[ stepIndex ]["service"] != null) {
                    icon.classList.add("fa-li", "fa", "fa-bus");
                    listElement.appendChild(icon);
                    icon.classList.add("bright");

                    listElement.innerHTML += chunks[ stepIndex ].service.text.text;
                }
                //listElement.style.fontSize = '60%';
                listElement.style.fontSize = 'small';
                uList.appendChild( listElement );

                // go next instruction
                stepIndex++;
            }
        }
        wrapper.appendChild( uList );
        return wrapper;
    },
*/

// the following is intended for display of bus stop schedules
    getDom: function ( ) {
        Log.info("getDom - Start");
        var now = new Date(); // moment(); // moment package cannot be invoked in here ... only in nodehelper ?! not very handy
        var minutesLeft;
        var wrapper = document.createElement( "div" );
        wrapper.classList.add("small");

        if ( !this.loaded ) {
            Log.info("getDom - not loaded yet");
            wrapper.innerHTML = "Loading stop schedules ...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        var table = document.createElement("table");
        table.className = "small";
        wrapper.appendChild(table);

        var row;
        var lineIdCell, destCell, stopNameCell, timeLeftCell;

        // cells:
        // |   icon NUmber   |               |   stopName (code)   |
        // |                 |   Direction   |   timeleft          |
        // |                 |   Direction   |   timeleft          |
        // |   icon NUmber   |               |   stopName (code)   |
        // |                 |   Direction   |   timeleft          |
        // |                 |   Direction   |   timeleft          |

        //var icon;

        Log.info("getDom - start loop over all schedule data");
        //Log.info("getDom - this.busScheduleData: "+ JSON.stringify(this.busScheduleData));
        //Log.info(this.busScheduleData);
        for ( var scheduleDataIndex = 0; scheduleDataIndex < this.busScheduleData.length; scheduleDataIndex++ ) {
            row = document.createElement("tr");

            lineIdCell = document.createElement("td");
            lineIdCell.className = "align-right bright";

            destCell = document.createElement("td");
            destCell.className = "align-right bright";

            timeLeftCell = document.createElement("td");
            timeLeftCell.className = "align-right bright";

            stopNameCell = document.createElement("td");
            stopNameCell.className = "align-right bright";

            var currentDataToDisplay = this.busScheduleData[ scheduleDataIndex ];
            var lineNumber = currentDataToDisplay.lineShortName;
            var data = currentDataToDisplay.scheduleData;
            var stopName = data.stop.name;
            var stopCode = data.stop.operatorCode;

            // put icon
            var span = document.createElement("span");
            var icon = document.createElement("i");
            icon.classList.add("fa-fw");
            icon.classList.add("fa-li", "fa", "fa-bus");
            icon.classList.add("bright");
            span.appendChild(icon);
            lineIdCell.appendChild(span);

            // put line N°
            lineIdCell.innerHTML = lineNumber;
            row.appendChild(lineIdCell);

            // put empty dest cell
            destCell.innerHTML = "";
            row.appendChild(destCell);

            // put stopname cell
            stopNameCell.innerHTML = stopName + " ("+stopCode+")";
            row.appendChild(stopNameCell);

            // create section row
            table.appendChild(row);

            // display the next scheduled times
            for(var index = 0; index < data.departure.length ; index++) {
                Log.info("getDom - start loop over a given stop schedule data ( lineNumber"+ lineNumber+")");
                row = document.createElement("tr");

                lineIdCell = document.createElement("td");
                lineIdCell.className = "align-right bright";

                destCell = document.createElement("td");
                destCell.className = "align-right bright";

                timeLeftCell = document.createElement("td");
                timeLeftCell.className = "align-right bright";

                stopNameCell = document.createElement("td");
                stopNameCell.className = "align-right bright";

                var currentElement = data.departure[index];
                // put empty icon
                span = document.createElement("span");
                icon = document.createElement("i");
                span.appendChild(icon);
                lineIdCell.appendChild(span);
                // put empty line N°
                lineIdCell.innerHTML = "";
                row.appendChild(lineIdCell);
                // put dest cell
                destCell.innerHTML = currentElement.destination[0].name;
                row.appendChild(destCell);
                // put timeleft cell
                minutesLeft = this.computeWaitingTime(now, currentElement.dateTime);
                //listElement.innerHTML += minutesLeft + " minutes";
                //uList.appendChild( listElement );
                timeLeftCell.innerHTML = minutesLeft;
                row.appendChild(timeLeftCell);
                // put row
                table.appendChild(row);
            };// end loop over all schedule times
        };// end loop over all buses numbers
        //wrapper.appendChild( uList );
        //Log.info("End getDom (before return statement)");
        return wrapper;
    },

    computeWaitingTime: function(now, string) {
        Log.info("computeWaitingTime - start - params: now: " + now + " - string: " + string);
        //var scheduledDate = moment(string);
        ////var now = moment();
        //var minutesLeft = scheduledDate.diff(now, 'minutes');
        //if(minutesLeft < 0) {
        //    Log.debug("Difference betweens moments is negative, are we trying to display a schedule time that is in the past ?");
        //    Log.debug(" Now was          : " + now.toISOString());
        //    Log.debug(" scheduledDate was: " + scheduledDate.toISOString());
        //};
        //return minutesLeft;

        // inpout string is in the form "2017-06-03 15:11"
        // now is in the form
        var endTime = string.split(' ')[1].split(':');
        //Log.info("computeWaitingTime - endTime="+endTime);

        var endDate = new Date(0, 0, 0, endTime[0], endTime[1]);
        var startDate = new Date(0, 0, 0, now.getHours(), now.getMinutes(), now.getSeconds());

        //Log.info("computeWaitingTime - startDate = "+startDate);
        //Log.info("computeWaitingTime - endDate   = "+endDate);

        var waitingTime = endDate - startDate;
        if (startDate > endDate) {
            Log.info("computeWaitingTime - startDate > endDate  !!!");

            waitingTime += 1000 * 60 * 60 * 24;
        };
        if (waitingTime > 60 * 60 * 1000) {
            // return time in hours
            waitingTime = "" + Math.ceil( ((waitingTime / 1000) / 60) / 60) + " h";
        }
        else if (waitingTime > 60 * 1000) {
            // return time in minutes
            waitingTime = "" + Math.ceil( (waitingTime / 1000) / 60) + " m";
        }
        else {
            waitingTime = "" + Math.ceil( waitingTime / 1000) + " s";
        };

        Log.info("computeWaitingTime - end - waitingTime="+waitingTime);
        return waitingTime;
    },

    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    socketNotificationReceived: function ( notification, payload ) {
        Log.info("socketNotificationReceived - Module received notification: " + notification);
        switch ( notification ) {
            case "JOURNEYS":
                //this.allJourneys = payload.allJourneys;
                //this.roadMode = payload.roadMode;
                //this.maxDepartureHour = payload.maxDepartureHour;
                //this.minArrivalHour = payload.minArrivalHour;
                //this.LastUpdate = payload.lastUpdate;
                //this.loaded = payload.loaded;
                //this.updateDom( );
                break;
            case "BUS_SCHEDULES":
                this.busScheduleData = payload.data;
                this.lastUpdate = payload.lastUpdate;
                this.loaded = payload.loaded;
                Log.info("socketNotificationReceived - bus schedule data received is: " + this.busScheduleData);
                //Log.info("socketNotificationReceived - bus schedule data received is: " + JSON.stringify(this.busScheduleData));
                this.updateDom( );
                break;
            case "UPDATE_JOURNEYS":
                //this.config.lastUpdate = payload.lastUpdate;
                //this.updateDom( );
                break;
            case "UPDATE_BUS_SCHEDULES":
                this.config.lastUpdate = payload.lastUpdate;
                this.updateDom( );
                break;
            case "ALL_LINES_AVAILABLE":
                this.sendSocketNotification("UPDATE_BUS_SCHEDULES");
        }
        Log.info("socketNotificationReceived - End of Module received notification: " + notification);
    }
} );


// config is expected as follows:
/*
config: {
    apiKey: 'YOUR TOULOUSE TRANSPORTS API KEY',
    departurePlace: '', // free text address
    arrivalPlace: '', // free text adddress
    firstDepartureDatetime: '', // YYYY-MMDD HH:MM
    lastDepartureDatetime: '', // YYYY-MMDD HH:MM
    maxTransferNumber: '5',
    roadMode: 'walk', //  walk / wheelchair / bike / car

    // inherited from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
    updateInterval: 60000, //time in ms between pulling request for new times (update request)
    converToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
    showSecondsToNextUpdate: true, // display a countdown to the next update pull (should I wait for a refresh before going ?)
    showLastUpdateTime: false, //display the time when the last pulled occured (taste & color...)
    oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
    oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
    debug: false, //console.log more things to help debugging

    // for future dev ?
    //departurePlaceXY: '', //lat long in radians WGS84
    //arrivalPlaceXY: '', //lat long in radians WGS84
    //rollingStockList : '', // [metro 13792273858822586, bus 13792273858822585, tram 13792273858822588, TAD 13792273858822589]
}
*/


Module.register( "MMM-Toulouse-Transports", {
    defaults: {
        //apiKey: '', // should be removed

        // inherited from
        // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
        maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
        maxTimeOffset: 200, // Max time in the future for entries
        useRealtime: true,
        updateInterval: 1 * 60 * 1000, //time in ms between pulling request for new times (update request)
        animationSpeed: 2000,
        convertToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
        initialLoadDelay: 0, // start delay seconds.
        apiBase: 'https://api.tisseo.fr/v1/journeys.json?',
        maxLettersForDestination: 22, //will limit the length of the destination string
        concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
        showSecondsToNextUpdate: true, // display a countdown to the next update pull (should I wait for a refresh before going ?)
        showLastUpdateTime: false, //display the time when the last pulled occured (taste & color...)
        oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
        oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
        debug: false
    }, //console.log more things to help debugging

    // inherited from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    // Define start sequence.
    start: function ( ) {
        Log.info( "Starting module: " + this.name );
        this.sendSocketNotification( 'SET_CONFIG', this.config );
        this.allJourneys = [];

        this.maxDepartureHour = '';
        this.minArrivalHour = '';

        this.roadMode = '';

        this.lastUpdate = 'never updated';
        this.loaded = true;

        this.loaded = false;
        this.updateTimer = null;
        var self = this;
        setInterval( function ( ) {
            self.updateDom( );
        }, 1000 );
    },

    // inherited from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    getHeader: function ( ) {
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
        return header;
    },

    getStyles: function () {
        return ['font-awesome.css'];
    },

    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    // Override dom generator.
    getDom: function ( ) {
        var now = new Date( );
        var wrapper = document.createElement( "div" );

        if ( !this.loaded ) {
            wrapper.innerHTML = "Loading journeys ...";
            wrapper.className = "dimmed light small";
            return wrapper;
        }

        var table = document.createElement( "table" );
        wrapper.appendChild( table );
        table.className = "small";


        for ( var journeyIndex = 0; journeyIndex < this.config.maximumEntries; journeyIndex++ ) {

            /*if (this.config.debug) {
                console.log("JOURNEYS - " + JSON.stringify(this.allJourneys));
            }*/
            var departureDateTime = this.allJourneys[ journeyIndex ].journey.departureDateTime;
            var arrivalDateTime = this.allJourneys[ journeyIndex ].journey.arrivalDateTime;
            var duration = this.allJourneys[ journeyIndex ].journey.duration;


            //
            var chunks = this.allJourneys[ journeyIndex ].journey.chunks;
            if (this.config.debug) {
                console.log("JOURNEYS - There are " + chunks.length + " chunk(s)");
            }

            var stepIndex = 0;

            while ( stepIndex < chunks.length ) {
                var row = document.createElement( "tr" );
                var instructionsCell = document.createElement( "td" );
                instructionsCell.style.textAlign = 'left';

                var icon = document.createElement("i");


                // <i class="fa fa-subway" aria-hidden="true"></i>
                // <i class="fa fa-train" aria-hidden="true"></i>
                //'<i class="fa fa-street-view" aria-hidden="true"></i>';
                if(chunks[ stepIndex ]["street"] != null){
                    icon.classList.add("fa-li", "fa", "fa-blind");
                    row.appendChild(icon);
                    instructionsCell.innerHTML += chunks[ stepIndex ].street.text.text;
                }
                else if (chunks[ stepIndex ]["stop"] != null) {
                    icon.classList.add("fa-li", "fa", "fa-bus");
                    row.appendChild(icon);
                    instructionsCell.innerHTML += chunks[ stepIndex ].stop.text.text;
                }
                else if (chunks[ stepIndex ]["service"] != null) {
                    icon.classList.add("fa-li", "fa", "fa-info-circle");
                    row.appendChild(icon);
                    instructionsCell.innerHTML += chunks[ stepIndex ].service.text.text;
                }
                // put cell in row, and add it to table
                row.appendChild( instructionsCell );
                table.appendChild( row );

                // go next instruction
                stepIndex++;
            }
        }
        return wrapper;
    },

    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    socketNotificationReceived: function ( notification, payload ) {
        switch ( notification ) {
            case "JOURNEYS":
                this.allJourneys = payload.allJourneys;
                this.roadMode = payload.roadMode;

                this.maxDepartureHour = payload.maxDepartureHour;
                this.minArrivalHour = payload.minArrivalHour;

                this.LastUpdate = payload.lastUpdate;
                this.loaded = payload.loaded;
                this.updateDom( );
                break;
            case "UPDATE":
                this.config.lastUpdate = payload.lastUpdate;
                this.updateDom( );
                break;
        }
    }
} );


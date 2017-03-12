/* Magic Mirror
 * Module: MMM-Toulouse-Transports
 *
 * script from Telomere31 based on:
 * da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
 * (itself based on:
 *    a Script from  Georg Peters (https://lane6.de)
 *    band a Script from Benjamin Angst http://www.beny.ch
 *
 * MIT Licensed.
 */

const NodeHelper = require( "node_helper" );
const unirest = require( 'unirest' );

module.exports = NodeHelper.create( {
    start: function ( ) {
        this.started = false;
    },

    // inherited from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    socketNotificationReceived: function ( notification, payload ) {
        const self = this;
        if ( notification === 'SET_CONFIG' && this.started == false ) {
            this.config = payload;
            if ( this.config.debug ) {
                console.log( ' *** config set in node_helper: ' );
                console.log( payload );
            }
            this.started = true;
            self.scheduleUpdate( this.config.initialLoadDelay );
        };
    },

    /* scheduleUpdate()
     * Schedule next update.
     * argument delay number - Millis econds before next update. If empty, this.config.updateInterval is used.
     */
    scheduleUpdate: function ( delay ) {
        var nextLoad = this.config.updateInterval;
        if ( typeof delay !== "undefined" && delay >= 0 ) {
            nextLoad = delay;
        }
        var self = this;
        clearTimeout( this.updateTimer );
        this.updateTimer = setTimeout( function ( ) {
            self.updateTimetable( );
        }, nextLoad );
    },

    /* updateTimetable(transports)
     * Calls processTrains on succesfull response.
     */
    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    updateTimetable: function ( ) {
        this.sendSocketNotification( "UPDATE", { lastUpdate: new Date( ) } );

        // Toulouse transportation system API
        var url = this.config.apiBase + '&maxTransferNumber='+ this.config.maxTransferNumber+'&departurePlace=' + this.config.departurePlace + '&arrivalPlace=' + this.config.arrivalPlace + '&displayResultTable' + '&displayWording=1' + '&key=' + this.config.apiKey;
        /*var url = this.config.apiBase + '&departurePlace='+this.config.departurePlace + '&departurePlaceXY='+this.config.departurePlaceXY + '&arrivalPlace=' +this.config.arrivalPlace +'&arrivalPlaceXY='+this.config.arrivalPlaceXY + '²&displayResultTable' + '&displayWording=1' +'&key='+this.config.apiKey;*/

        var self = this;
        var retry = true;

        if ( this.config.debug ) { console.log( ' *** fetching: ' + url ); }

        unirest.get( url )
            .headers( {
                'Accept': 'text/html,application/xhtml+xml,application/xml;charset=utf-8'
            } )
            .end( function ( response ) {
                if ( response && response.body ) {
                    self.processJourneys( response.body );
                } else {
                    if ( self.config.debug ) {
                        if ( response ) {
                            console.log( ' *** partial response received' );
                            console.log( response );
                        } else {
                            console.log( ' *** no response received' );
                        }
                    }
                }
                if ( retry ) {
                    self.scheduleUpdate( ( self.loaded ) ? -1 : this.config.retryDelay );
                }
            } );
        //}
    },

    // inherited and adapted from
    // da4throux  (https://github.com/da4throux/MMM-Paris-RATP-PG)
    processJourneys: function ( data ) {
        if ( this.config.debug ) {
            /*console.log("Processing - the received data: " + JSON.stringify(data));*/
            console.log("Processing - the received journeys: " + JSON.stringify(data.routePlannerResult.journeys));
        }
        this.payload = {};
        this.payload.allJourneys = data.routePlannerResult.journeys;

        this.payload.maxDepartureHour = data.routePlannerResult.query.timeBounds.maxDepartureHour;
        this.payload.minArrivalHour = data.routePlannerResult.query.timeBounds.minArrivalHour;

        this.payload.roadMode = data.routePlannerResult.query.roadMode;

        this.payload.lastUpdate = new Date( );
        this.payload.loaded = true;
        this.sendSocketNotification( "JOURNEYS", this.payload );
    }

} );


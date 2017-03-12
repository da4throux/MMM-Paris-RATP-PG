# MMM-Paris-RATP-PG

###MagicMirror MichMich module to display next buses and RERs for a configured list of stations/ destinations
###forked from da4throux/MMM-Paris-RATP-PG see more detailed information on gerog90 [blog](https://lane6.de).

# Presentation
A module to display the different buses and rers related to a list of station/destination, in order to avoid waiting to much for them when leaving home.

# Screenshot
![screenshot](https://github.com/da4throux/MMM-Paris-RATP-PG/blob/master/MMM-Paris-RATP-PG.png)

# API

It is based on the open REST API from Pierre Grimaud https://github.com/pgrimaud/horaires-ratp-api, which does not require any configuration / registration. Immediate use.

# Install

1. Clone repository into `../modules/` inside your MagicMirror folder.
2. Run `npm install` inside `../modules/MMM-Paris-RATP-PG/` folder
3. Add the module to the MagicMirror config
```
		{
	        module: 'MMM-Paris-RATP-PG',
	        position: 'bottom_right',
	        header: 'Connections',
	        config: {
	        }
    	},
```

# specific configuration
* [name]: [default value], //information
* maximumEntries: 2, //if the APIs sends several results for the incoming transport how many should be displayed
* updateInterval: 60000, //time in ms between pulling request for new times (update request)
* converToWaitingTime: true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
* maxLeterrsForDestination: 22, //will limit the length of the destination string
* concatenateArrivals: true, //if for a transport there is the same destination and several times, they will be displayed on one line
* showSecondsToNextUpdate: true, // display a countdown to the next update pull (should I wait for a refresh before going ?)
* showLastUpdateTime: false, //display the time when the last pulled occured (taste & color...)
* oldUpdateOpacity: 0.5, //when a displayed time age has reached a threshold their display turns darker (i.e. less reliable)
* oldThreshold: 0.1, //if (1+x) of the updateInterval has passed since the last refresh... then the oldUpdateOpacity is applied
* debug: false, //console.log more things to help debugging
* busStations: [] // the list of stations/directions to monitor (bus and RERs, probably works also for Subways)
* busStations is an array of objects with four properties:
  - type: 'bus', 'rers'
  - line: 28, 'B' -> typically the official name but you can check through: 
   . https://api-ratp.pierre-grimaud.fr/v2/bus/
   . https://api-ratp.pierre-grimaud.fr/v2/rers/
  - stations: the station id, look it up with the url, typically: https://api-ratp.pierre-grimaud.fr/v2/{type}/{line}
  - destination: the destination id (indicated in the same look up url)
  - 'label': optional: to rename the line differently if needed
```javascript
busStations: [{type: 'bus', line: 38, stations: 2758, destination: 183, label: 'bus vers le Nord'}, 
                  {type: 'rers', line: 'B', stations: 62, destination: 4}]
```
# v1.0

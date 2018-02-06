# MMM-Paris-RATP-PG

MagicMirror MichMich module to display transportation information for Paris (bus, metro, tramway, RER) and rain risk in the coming hour for a configured list of stations/ destinations.

Forked from MMM-HH-LocalTransport see more detailed information on georg90 [blog](https://lane6.de).

# Presentation
A module to display:
* the different buses, metros, rers & tramways, in order to avoid waiting too much for them when leaving home.
* general traffic information for lines of metros, rers & tramways
* rain in the coming hour (as per Meteo France)

# Screenshot
![screenshot](https://github.com/da4throux/MMM-Paris-RATP-PG/blob/history/MMM-Paris-RATP-PG%201.6.png)

# API

It is based on the open REST API from Pierre Grimaud https://github.com/pgrimaud/horaires-ratp-api, which does not require any configuration / registration.

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
Three different kind of objects are in the configuration:
* lines: an array that contains an object describing each line to be presented by the modules
* other elements are global to the module
##lines array
* each line has a type, and each type might have different parameters
### common to: bus, rers, metros, tramway
* type: mandatory, value in [bus, rers, metros, tramway]
* line: mandatory, typical value: 28 or 'A'... check exact value with: https://api-ratp.pierre-grimaud.fr/v3/lines/bus, https://api-ratp.pierre-grimaud.fr/v3/lines/rers, https://api-ratp.pierre-grimaud.fr/v3/lines/tramways, https://api-ratp.pierre-grimaud.fr/v3/lines/metros
* stations: mandatory: [name of the station] -> found with https://api-ratp.pierre-grimaud.fr/v3/stations/{type}/{line}
* destination: mandatory, either 'A' or 'R'
### Traffic
* line: mandatory, based on https://api-ratp.pierre-grimaud.fr/v3/traffic set the line as: [type, line], such as: ['metros', 6], ['rers', 'A']...
### Common in Transportation lines
* maximumEntries: optional, int, default = 2, //if the APIs sends several results for the incoming transport how many should be displayed
* converToWaitingTime: optional, boolean, default = true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
* maxLeterrsForDestination: optional, int, default = 22, //will limit the length of the destination string
* concatenateArrivals: optional, boolean, default = true, //if for a transport there is the same destination and several times, they will be displayed on one line
### Pluie
* type: mandatory: pluie
* place: mandatory: integer, example: 751140, take the id from the object returned by: http://www.meteofrance.com/mf3-rpc-portlet/rest/lieu/facet/pluie/search/input=75014 (change 75014 by your postal code)
* pluieAsText: optional, boolean, default = false, // show the weather in the coming hour as text and not icons
* iconSize: optional, example: 0.70, //set the em for the weather icon (each icon is 5 minutes: i.e. there's 12 icons for an hour)
### common in all lines
* label: Optional: to rename the object differently if needed
* updateInterval: optional, int, default: 60000, time in ms between pulling request for new times (update request)
* showUpdateAge: optional, boolean, default = true, //add a circled integer next to the line name showing the tenths digits of the number of seconds elapsed since update.
* firstCellColor: optional, color name, // typically first column of the line (superseed the line color): https://dataratp2.opendatasoft.com/explore/dataset/indices-et-couleurs-de-lignes-du-reseau-ferre-ratp/ or wikipedia can give you insights
* lineColor: optional, color name, //set the color of the line
## Global element
* debug: false, //console.log more things to help debugging
* conversion: object of key/ values to convert traffic message. Those message can be very long, and it might worth to convert them in a simpler text. by default:
  - conversion: {"Trafic normal sur l'ensemble de la ligne." : 'Traffic normal'}
  - don't hesitate to add more when there's works on a specific line or others...

Config Example:
```javascript
config: {
				conversion: { "Trafic normal sur l'ensemble de la ligne." : 'Traffic normal'},
				debug: false,
        lines: [
					{type: 'bus', line: 38, stations: 'observatoire+++port+royal', destination: 'A', firstCellColor: '#0055c8'},
          {type: 'bus', line: 91, stations: 'observatoire+++port+royal', destination: 'A', firstCellColor: '#dc9600'},
          {type: 'bus', line: 91, stations: 'observatoire+++port+royal', destination: 'R', firstCellColor: '#dc9600', lineColor: 'Brown'},
          {type: 'rers', line: 'B', stations: 'port+royal', destination: 'A', label: 'B', firstCellColor: '#7BA3DC'},
          {type: 'traffic', line: ['rers', 'B'], firstCellColor: 'Blue', lineColor: 'green'},
          {type: 'metros', line: '6', stations: 'raspail', destination: 'A', label: '6', firstCellColor: '#6ECA97'},
          {type: 'pluie', place: '751140', updateInterval: 1 * 5 * 60 * 1000, label: 'Paris', iconSize: 0.70},
        ],
			},
```
# v2.0

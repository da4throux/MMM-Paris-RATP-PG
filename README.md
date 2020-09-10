# MMM-Paris-RATP-PG

MagicMirror MichMich module to display transportation information for Paris (bus, metro, tramway, RER, autolib & velib) and rain risk in the coming hour for a configured list of stations/ destinations.

Forked from MMM-HH-LocalTransport see more detailed information on georg90 [blog](https://lane6.de).

# Presentation
A module to display:
* the different buses, metros, rers & tramways, in order to avoid waiting too much for them when leaving home.
* general traffic information for lines of metros, rers & tramways
* available autolib, utilib, and station spaces, charging slots
* available velib (bike, eBike and dock)
* rain in the coming hour (as per Meteo France)

# Screenshot -needs to be updated with eBike later-on
![screenshot](https://github.com/da4throux/MMM-Paris-RATP-PG/blob/master/MMM-Paris-RATP-PG%202.3.png)

# API

It is based on the open REST API from Pierre Grimaud https://github.com/pgrimaud/horaires-ratp-api, which does not require any configuration / registration.
It uses a non documented API from Meteo meteofrance for the rain within an hour prediction
It uses the Open Data from Paris City for Autolib, and Velib

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
Becareful, configuration changes will only be taken in account once the server side (not only the browser) is restarted.
Three different kind of objects are in the configuration:
* lines: an array that contains an object describing each line to be presented by the modules
* other elements are global to the module
##lines array
* each line has a type, and each type might have different parameters
### common to: buses, rers, metros, tramway
* type: mandatory, value in [buses, rers, metros, tramway]
* line: mandatory, typical value: 28 or 'A'... check exact value with: https://api-ratp.pierre-grimaud.fr/v4/lines/buses, https://api-ratp.pierre-grimaud.fr/v4/lines/rers, https://api-ratp.pierre-grimaud.fr/v4/lines/tramways, https://api-ratp.pierre-grimaud.fr/v4/lines/metros
* stations: mandatory: [name of the station] -> found with https://api-ratp.pierre-grimaud.fr/v4/stations/{type}/{line}
* destination: mandatory, either 'A' or 'R'
### rers only
As destinations do not reveal all the stops for an rer, this allow to filter on code (see https://rera-leblog.fr/les-codes-missions-des-rer-a-dechiffres/)
* mission1: optional, array of letters ['A', 'E'], default is absent = no filtering //keep only rers for which the first letter is present in the array
* mission2: optional, array of letters, default is absent = no filtering //keep only rers for which the second letter is present in the array
### Traffic
* type: mandatory: traffic
* line: mandatory, based on https://api-ratp.pierre-grimaud.fr/v4/traffic set the line as: [type, line], such as: ['metros', 6], ['rers', 'A']...
* hideTraffic: optional, array of string, if a traffic status belongs to the array, then the traffic is not shown (see the example for usage)
### Common in Transportation lines
* maximumEntries: optional, int, default = 2, //if the APIs sends several results for the incoming transport how many should be displayed
* converToWaitingTime: optional, boolean, default = true, // messages received from API can be 'hh:mm' in that case convert it in the waiting time 'x mn'
* maxLettersForDestination: optional, int, default = 22, //will limit the length of the destination string
* concatenateArrivals: optional, boolean, default = true, //if for a transport there is the same destination and several times, they will be displayed on one line
### autolib - I leave it for nostalgia, but no more autolib ... :(
* type: mandatory: autolib
* name: mandatory: public name of the station (check  https://opendata.paris.fr/explore/dataset/autolib-disponibilite-temps-reel/ )
* utilib: optional: boolean: if false: the utilib are aggregated with the bluecar, if true: all three type of cars are detailed
* backup: optional: public name of the station to backup. If that station (set in backup) is empty (no cars - utilib or not), then only this line is displayed. A use case would be: display this station status only if that other station (nearest to me) is empty. The station (set in backup) should be in the lines before (else there might be a delay in displaying the line).
### velib
* type: mandatory: velib
* stationId: mandatory: digits: please check the station number from the velib application, then you can check if it works out by putting it at the end of the URL: https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&refine.station_code= For example: Cassini - Denfer-Rochereau is shown as "14111", and therefore: https://opendata.paris.fr/api/records/1.0/search/?dataset=velib-disponibilite-en-temps-reel&refine.station_code=14111
* keepVelibHistory: optional: boolean: if true, keeps locally in the browser a day of data regarding the station (to be used if velibGraph is set to true later on)
* velibGraph: optional: boolean: shows a graph of velib count for the last day (give an idea of the trend), eBike in blue, total in white
### Pluie [not working as of sept 2020, needs investigation]
* type: mandatory: pluie
* place: mandatory: integer, example: 751140, take the id from the object returned by: http://www.meteofrance.com/mf3-rpc-portlet/rest/lieu/facet/pluie/search/input=75014 (change 75014 by your postal code)
* pluieAsText: optional, boolean, default = false, // show the weather in the coming hour as text and not icons
* iconSize: optional, example: 0.70, //set the em for the weather icon (each icon is 5 minutes: i.e. there's 12 icons for an hour)
### common in all lines
* common means: not shared value, but meaningful for all the lines
* label: optional: to rename the object differently if needed
* updateInterval: optional, int, default: 60000, time in ms between pulling request for new times (update request)
* showUpdateAge: optional, boolean, default = true, //add a circled integer such as ①② next to the line name showing the tenths digits of of seconds elapsed since update.
* firstCellColor: optional, color name, // typically first column of the line (superseed the line color): https://dataratp2.opendatasoft.com/explore/dataset/indices-et-couleurs-de-lignes-du-reseau-ferre-ratp/ or wikipedia can give you insights
* lineColor: optional, color name, //set the color of the line
* maxLetters: optional, number, default = 70, will limit the string length for traffic and messages
## Global element
* debug: false, //console.log more things to help debugging
* reorder: optional, boolean, default = false, //option to reorder the RERs schedule (sometimes they are not sent in coming order, but it seems rare)
## lineDefault
* lineDefault contains properties that will be common to all lines, but can be superseed at the line level also: so any property from the line, can be set here also, but the following ones, make more sense here also:
* conversion: object of key/ values to convert traffic message or destination. Those message can be very long (and limited through maxLetters also), and it might worth to convert them in a simpler text. by default:
  - conversion: {"Trafic normal sur l'ensemble de la ligne." : 'Traffic normal'}
  - don't hesitate to add more when there's works on a specific line or others...
* updateInterval: see above

Config Example:
```javascript
config: {
	debug: false,
	lineDefault: {
	  hideTraffic: [
	    "le trafic est interrompu entre Aulnay et Aeroport Charles de Gaulle 2 TGV de 23:00 à fin de service jusqu'au 16/03/18. Bus de remplacement à dispo. (travaux de modernisation)",
            "Trafic normal sur l'ensemble de la ligne.",
            "le trafic est interrompu entre Nanterre-Prefecture et Cergy/ Poissy de 21:30 à fin de service jusqu'au 16/02/18. Bus de remplacement à dispo. (travaux)",
	  ],
	  conversion: { "Trafic normal sur l'ensemble de la ligne." : 'Traffic normal'},
	  updateInterval: 1 * 2 * 60 * 1000,
	},
	lines: [
	  {type: 'buses', line: 38, stations: 'observatoire+++port+royal', destination: 'A', firstCellColor: '#0055c8'},
	  {type: 'buses', line: 91, stations: 'observatoire+++port+royal', destination: 'A', firstCellColor: '#dc9600'},
	  {type: 'buses', line: 91, stations: 'observatoire+++port+royal', destination: 'R', firstCellColor: '#dc9600', lineColor: 'Brown'},
	  {type: 'rers', line: 'B', stations: 'port+royal', destination: 'A', label: 'B', firstCellColor: '#7BA3DC'},
	  {type: 'traffic', line: ['rers', 'B'], firstCellColor: 'Blue', lineColor: 'green'},
	  {type: 'metros', line: '6', stations: 'raspail', destination: 'A', label: '6', firstCellColor: '#6ECA97'},
//	  {type: 'pluie', place: '751140', updateInterval: 1 * 5 * 60 * 1000, label: 'Paris', iconSize: 0.70}, //not working as of sept 2020
//	  {type: 'autolib', name: 'Paris/Henri%20Barbusse/66', label: 'Barbusse', lineColor: 'green'},
//	  {type: 'autolib', name: 'Paris/Michelet/6', label: 'Michelet', utilib: true, backup: 'Paris/Henri%20Barbusse/66'},
	  {type: 'velib', stationId: 14111, label: 'Cassini', velibGraph : false, keepVelibHistory: true},
	  {type: 'velib', stationId: 6018, label: 'Assas', velibGraph: true, keepVelibHistory: true},
        ],
},
```
# v2.7

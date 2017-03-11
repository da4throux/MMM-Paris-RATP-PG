# MMM-Toulouse-Transports
Attempt to make a Magic Mirror Module for Toulouse transportation system

## WARNING: License and intellectual property statement
Mainly inspired by https://github.com/da4throux/MMM-Paris-RATP-PG
No license defined yet, this should probably inherit da4throux's project license.
working on it for now.

In the future, i might close this and make it a branch of da4trhoux's main project.

However, due to the API being slightly different, many adaptation were made.

# Screenshot
(Taken at 01:00 (01:00 am), that explains the very long duration :))
![screenshot](https://github.com/Telomere31/MMM-Toulouse-Transports/blob/master/MMM-Toulouse-Transports-prototype.png)

## Configuration
Expected configuration is as follows:

```
config: {
    apikey: 'YOUR TOULOUSE TRANSPORTS API KEY',
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
}
```

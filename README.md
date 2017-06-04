# MMM-Toulouse-Transports
Attempt to make a Magic Mirror Module for Toulouse transportation system.
I'm new to Git, MMM, Javascript/Node, so this also a Sandbox for me.

The module depends exclusively on the TISSEO web API.
You'll need to ask them for an API key to use this module. Mail link coming soon.

### This branch is intended for display of bus stops schedules only

I'm thinking about makin the displays more minimalistic, but for now, I need to focus on Javascript/DOM syntax and mechanics.

## WARNING: License and intellectual property statement

Heavily inspired from https://github.com/da4throux/MMM-Paris-RATP-PG

No license defined yet, this should probably inherit da4throux's project license.
working on it for now.

However, due to the API being slightly different, many adaptation were made.

# Screenshot
![screenshot](https://github.com/Telomere31/MMM-Toulouse-Transports/blob/master/bus_schedules.png)

## Configuration
Expected configuration is as follows:

```
{
            module: 'MMM-Toulouse-Transports',
            position: 'top_right',
            
            header: 'Horaires de passage',
            config: {
                apiKey: 'YOUR API KEY HERE',
                // pour horaires
                stopSchedules: [
                    {
                        lineNumber: 22,
                        stopCode: 6601, // this is an exact stop code of Tisseo. You can find it on your favorite bus stop sign. or Get it on Tisseo travels webapp
                        maxEntries:3 // if you want the 2 next buses schedules
                    },
                    {
                        etc.
                    },
                    {
                        etc.
                    }
                ],
                debug: true, // if you have issues and want to help me fix them.
                updateInterval: 120000
            }
```

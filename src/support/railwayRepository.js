const axios = require('axios');

const axiosConfig = {
  headers: {
    Accept: 'application/json;charset=utf-8',
  },
};

/**
 * @param query Object with index and stationValue, destinationValue attributes (index is the index within stations array from config)
 * @returns Promise to first station/destination info matching provided query (label or UIC), or null if it does not exist
 */
const getStationInfo = function(query, config) {
  const { index, stationValue, destinationValue } = query;
  const { sncfApiUrl, debug } = config;
  const urls = [];
  
  // TODO extract format function
  urls.push(encodeURI(`${sncfApiUrl}search?q=${stationValue}&dataset=sncf-gares-et-arrets-transilien-ile-de-france&sort=libelle`));
  urls.push(encodeURI(`${sncfApiUrl}search?q=${destinationValue}&dataset=sncf-gares-et-arrets-transilien-ile-de-france&sort=libelle`));

  return new Promise((resolve, reject) => {
    axios.all(urls, axiosConfig)
      .then((responses) => {

        const [ stationResponse, destinationResponse ] = responses;

        if (debug) {
          console.log(stationResponse.data);
          console.log(destinationResponse.data);
        }

        if (stationResponse && stationResponse.data && stationResponse.data.records.length) {
          
          if (debug) console.log(`** Station info found for '${query}'`);

          resolve({
            index,
            stationValue: stationResponse.data.records[0].fields,
            destinationValue: destinationResponse.data.records[0].fields,
          });
        } 
        
        if (debug) console.log(`** No station info found for '${query}'`);

        resolve(null);
      },
      (error) => {
        console.error(`** Error invoking API for '${query}'`);
        console.error(error);

        reject(error);
      });
  });
};

/**
 * 
 * 
 * @param {Object[]} queries 
 * @param {any} config
 * @returns Promise to all first station info matching provided query (label or UIC), or null if it does not exist
 */
function getAllStationInfo(queries, config) {
  return Promise.all(queries.map(query => getStationInfo(query, config)));
}

module.exports = {
  getStationInfo,
  getAllStationInfo,
};

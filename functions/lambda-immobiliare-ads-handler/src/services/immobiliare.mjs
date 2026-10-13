import xml2js from 'xml2js';
import axios from 'axios';
import { extractImmobiliareAdsId } from '../helper/generateXml.mjs';
const authorizationToken = Buffer.from(process.env[`IMMOBILIARE_AUTHORIZATION`]).toString( "base64" )
const instance = axios.create({
  baseURL: 'http://feed.immobiliare.it/ws/import/immobiliare/',
  timeout: 15000,
  headers: {
    'Accept': 'text/xml',
    'Content-Type': 'text/xml',
    'X-IMMO-SOURCE': 'homepanda-ws',
    'Authorization': `Basic ${authorizationToken}`
  },
});

export async function storeAds(dataXml) {
 try {
    const response = await instance.put('/property', dataXml, { 
      responseType : 'text'      
     });
    const jsonResponse = await xml2js.parseStringPromise(response.data, { mergeAttrs: true })
    return jsonResponse;
  } catch (e) {
    console.log(e);
    if (e.response) {
      const jsonErrorResponse = await xml2js.parseStringPromise(e.response.data, { mergeAttrs: true })
      console.error(jsonErrorResponse);
      throw new Error(JSON.stringify(jsonErrorResponse));      
    } 
    throw e;
  } 
}

export async function deleteAds(property) {
  try {
    const propertyId = extractImmobiliareAdsId(property);
    const response = await instance.delete(`/property/${propertyId}`);
    const jsonResponse = await xml2js.parseStringPromise(response.data, { mergeAttrs: true })
    return jsonResponse;
  } catch (e) {
    if (e.response) {
      const jsonErrorResponse = await xml2js.parseStringPromise(e.response.data, { mergeAttrs: true })
      throw new Error(JSON.stringify(jsonErrorResponse));  
    }
    
    throw e;
  }
}
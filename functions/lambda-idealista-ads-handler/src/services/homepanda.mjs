import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.HOMEPANDA_PROPERTY_SERVICE_URL,
  timeout: 15000
});

export function successPayload (propertyId, actionId, payload) {  
  return {    
    status: (actionId) ? 'OK': 'SUCCESS',
    actionId: actionId,
    response: payload
  }
}

export function errorPayload (propertyId, actionId, payload) {  
  return {
    status: (actionId) ? 'KO' : 'ERROR',
    actionId: actionId,    
    response: payload
  }
}

export async function webhookAction(url, payload) {
  try {    
		const response = await axios.post(url, payload);
    return response; 
  } catch (e) {
    console.log(e.response.data);
    throw e;
  }
}
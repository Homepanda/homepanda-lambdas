 import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.HOMEPANDA_PROPERTY_SERVICE_URL,
  timeout: 15000
});

function successActionPayload (actionId, payload) {
  return {
    status: 'OK',
    actionId: actionId,
    response: payload
  }
}

function errorActionPayload (actionId, payload) {
  return {
    status: 'KO',
    actionId: actionId,
    response: payload
  }
}

export function successPayload (actionId, payload) {
  if (actionId) {
    return successActionPayload(actionId, payload);
  }
  return {
    status: 'SUCCESS',    
    response: payload
  }
}

export function errorPayload (actionId, payload) {
  if (actionId) {
    return errorActionPayload(actionId, payload);
  }
  return {
    status: 'ERROR',    
    response: payload
  }
}

export async function saveAction (payload) {
  try {
		const response = await instance.post('/webhook/portal/wikicasa', payload);
    return response; 
  } catch (e) {
    console.log(e.response.data);
    throw e;
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
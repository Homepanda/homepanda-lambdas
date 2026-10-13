import axios from 'axios';
const instance = axios.create({
  baseURL: process.env.HOMEPANDA_PROPERTY_SERVICE_URL,
  timeout: 15000
});

export function successActionPayload(actionId, payload) {
  return {
    status: 'OK',
    actionId: actionId,
    response: payload
  }
}

export function errorActionPayload(actionId, payload) {
  return {
    status: 'KO',
    actionId: actionId,
    response: payload
  }
}

export async function updateAction(payload) {
  try {
    const response = await instance.post('/webhook/portal/immobiliare', payload);
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

export async function hydrateImageCache(photoUrls) {
  const requestPromises = [];
  for (let index = 0; index < photoUrls.length; index++) {    
    requestPromises.push(axios.get(photoUrls[index]));
  }
  try {
    await Promise.all(requestPromises);
  } catch (error) {
    console.log(error);
  }
}
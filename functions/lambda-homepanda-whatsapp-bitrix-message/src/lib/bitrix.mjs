import { getSecret } from "./secretManager.mjs";

const BITRIX_URL = process.env.BITRIX_URL;
const BITRIX_CLIENT_ID = process.env.BITRIX_CLIENT_ID;
const BITRIX_CLIENT_SECRET = process.env.BITRIX_CLIENT_SECRET;

async function makeRequest(method, url, body = undefined, headers = { 'Content-Type': 'application/json' }) {
  try {
    const response = await fetch(url, { method, headers, body });
    const responseData = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        const authData = await getSecret();
        const newAuthData = await refreshToken(authData.refresh_token);
        await updateSecret(newAuthData);
        body.auth = newAuthData.access_token;
        return await makeRequest(method, url, body, headers);
      }
      throw new Error(`Errore HTTP! Status: ${response.status}`);
    }

    return responseData;
  } catch (error) {
    console.error(`Errore durante la chiamata ${method}: `, error);
    throw error;
  }
}

export async function newToken(appId) {
  const url = new URL('https://oauth.bitrix.info/oauth/token/');
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: BITRIX_CLIENT_ID,
    client_secret: BITRIX_CLIENT_SECRET,
    code: appId,
  });
  const response = await makeRequest('POST', url.toString(), params.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
  return response;
}

export async function refreshToken(refreshId) {
  const url = new URL('https://oauth.bitrix.info/oauth/token/');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: BITRIX_CLIENT_ID,
    client_secret: BITRIX_CLIENT_SECRET,
    refresh_token: refreshId,
  });

  const response = await makeRequest('POST', url.toString(), params.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
  return response;
}

export async function connectorActivate(connectorName, connectorLine, connectorStatus) {
  const authData = await getSecret();
  const data = {
    auth: authData.access_token,
    CONNECTOR: connectorName,
    LINE: connectorLine,
    ACTIVE: connectorStatus
  }
  console.log(authData, data);
  const response = await makeRequest('POST', `${BITRIX_URL}/rest/imconnector.activate`, JSON.stringify(data));
  return response;
}

export async function setConnector(connectorName, connectorLine, connectorData) {
  const authData = await getSecret();
  const data = {
    auth: authData.access_token,
    CONNECTOR: connectorName,
    LINE: connectorLine,
    DATA: connectorData
  }
  const response = await makeRequest('POST', `${BITRIX_URL}/rest/imconnector.connector.data.set`, JSON.stringify(data));
  return response;
}

export async function setDeliveryStatus(connectorName, connectorLine, messages) {
  const authData = await getSecret();
  const data = {
    auth: authData.access_token,
    CONNECTOR: connectorName,
    LINE: connectorLine,
    MESSAGES: messages
  }
  const response = await makeRequest('POST', `${BITRIX_URL}/rest/bitrix.imconnector.send.status.delivery`, JSON.stringify(data));
  return response;
}

export async function retrieveFile(botId, fileId) {
  const authData = await getSecret();
  const data = { botId, fileId, auth: authData.access_token }
  const bitrixResponse = await makeRequest('POST', `${BITRIX_URL}/rest/imbot.v2.File.download`, JSON.stringify(data));
  const bitrixData = await bitrixResponse.json();
  const fileResponse = await fetch(bitrixData.result.downloadUrl);
  if (!fileResponse.ok) {
    throw new Error(`Impossibile scaricare il file da Bitrix: ${fileResponse.statusText}`);
  }

  return fileResponse;
}
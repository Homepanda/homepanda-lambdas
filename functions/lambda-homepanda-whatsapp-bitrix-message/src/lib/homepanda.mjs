const HOMEPANDA_WHATSAPP_URL = process.env.HOMEPANDA_WHATSAPP_URL;

export class HttpError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
        
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}
async function makeRequest(method, url, body = undefined, headers = { 'Content-Type': 'application/json' }) {
	try {
		const response = await fetch(url, { method, headers, body });
		if (!response.ok) {      
      let errorBody;            
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new HttpError(
        `Richiesta fallita con status ${response.status}`, 
        response.status, 
        errorBody
      );
    }
    const responseData = await response.json();
		return responseData;
	} catch (error) {
		console.error(`Errore durante la chiamata ${method}: `, error);
		throw error;
	}
}

/**
  * Conversation Example 
  * {
  *   conversationId: "01a0e8db-74d1-75d8-a175-dcaaa89f4540",
  *   waPhoneNumberId: "1285755457961340",
  *   toPhone: "+393207835392", 
  *   chatId: "630641",
  *   entityType: "LEAD",
  *   entityId: "84255"
  * }
 */
export async function findConversationByChatId(chatId) {
	const response = await makeRequest('GET', `${HOMEPANDA_WHATSAPP_URL}/bitrix/chats/${chatId}`);
  return response;
}
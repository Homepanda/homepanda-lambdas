import { errorPayload, successPayload, webhookAction } from "./handler/homepanda.mjs";
import { generatePayload } from "./handler/payload.mjs";
import { createAd, deleteAd, updateAd } from "./handler/wikicasa.mjs";

export const handler = async (event) => {

  const data = JSON.parse(event.Records[0].body);
  const payload = data.payload;
  let homepandaPayloadCallback;
  switch (data.action) {
    case 'CREATE':
      try {
        const propertyPayload = generatePayload(payload.property);
        const response = await createAd(propertyPayload, payload.property.provider);
        homepandaPayloadCallback = successPayload(
          payload?.actionId,
          JSON.stringify(response)
        );
      } catch (error) {
        homepandaPayloadCallback = errorPayload(
          payload?.actionId,
          error.message
        );
      } finally {
        try {
          await webhookAction(data.webhook_callback, homepandaPayloadCallback);
        } catch (error) {
          console.error(error);
        }
      }
      break;
    case 'UPDATE':
      try {
        const propertyPayload = generatePayload(payload.property);
        const response = await updateAd(propertyPayload, payload.property.property_id);
        homepandaPayloadCallback = successPayload(
          payload?.actionId,
          JSON.stringify(response)
        );
      } catch (error) {
        homepandaPayloadCallback = errorPayload(
          payload?.actionId,
          error.message
        );
      } finally {
        try {
          await webhookAction(data.webhook_callback, homepandaPayloadCallback);
        } catch (error) {
          console.error(error);
        }
      }
      break;
    case 'DELETE':
      try {
        const propertyPayload = generatePayload(payload.property);
        propertyPayload.published = false;
        const response = await updateAd(propertyPayload, payload.property.property_id);
        homepandaPayloadCallback = successPayload(
          payload?.actionId,
          JSON.stringify(response)
        );
      } catch (error) {
        homepandaPayloadCallback = errorPayload(
          payload?.actionId,
          error.message
        );
      } finally {
        try {
          await webhookAction(data.webhook_callback, homepandaPayloadCallback);
          break;
        } catch (error) {
          console.error(error);
        }
      }
      break;
    default:
      throw new Error('Undefined Action');
  }

  return homepandaPayloadCallback;
};

import { createAd, uploadAdImages, updateAd, deactivateAd } from './services/idealista.mjs';
import { generatePayload, generateImagesPayload, extractAdsId } from './services/payload.mjs';
import { successPayload, errorPayload, webhookAction } from './services/homepanda.mjs';

export const handler = async (event) => {

  const data = JSON.parse(event.Records[0].body);
  const payload = data.payload;
  let homepandaPayloadCallback;
  switch (data.action) {
    case 'CREATE':
      try {
        const propertyPayload = generatePayload(payload.property);
        const propertyImagesPayload = generateImagesPayload(payload.property);
        const response = await createAd(propertyPayload, payload.property.provider);
        await uploadAdImages(propertyImagesPayload, response.propertyId);
        homepandaPayloadCallback = successPayload(payload.property.property_id, payload?.actionId, JSON.stringify(response));
      } catch (error) {
        homepandaPayloadCallback = errorPayload(payload.property.property_id, payload?.actionId, error.message);
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
        const propertyId = extractAdsId(payload.property);
        const propertyPayload = generatePayload(payload.property);
        const propertyImagesPayload = generateImagesPayload(payload.property);
        const response = await updateAd(propertyPayload, propertyId, payload.property.provider);
        await uploadAdImages(propertyImagesPayload, response.propertyId);
        homepandaPayloadCallback = successPayload(payload.property.property_id, payload?.actionId, JSON.stringify(response));
      } catch (error) {
        homepandaPayloadCallback = errorPayload(payload.property.property_id, payload?.actionId, error.message);
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
        const propertyId = extractAdsId(payload.property);
        const response = await deactivateAd(propertyId, payload.property.provider);
        homepandaPayloadCallback = successPayload(payload.property.property_id, payload?.actionId, JSON.stringify(response));
      } catch (error) {
        homepandaPayloadCallback = errorPayload(payload.property.property_id, payload?.actionId, error.message);
      } finally {
        try {
          await webhookAction(data.webhook_callback, homepandaPayloadCallback);
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

import { generateImageUrl, generateXml } from './helper/generateXml.mjs';
import { storeAds, deleteAds } from './services/immobiliare.mjs';
import { successActionPayload, errorActionPayload, updateAction, webhookAction, hydrateImageCache } from './services/homepanda.mjs';

export const handler = async(event) => {
  
  const data = JSON.parse(event.Records[0].body);
  const payload = data.payload;
  let homepandaPayloadCallback;
  switch (data.action) {
    case 'CREATE':
    case 'UPDATE':
      try {
        console.log(payload.property);
        const propertyXml = generateXml(payload.property);
        console.log(propertyXml);
        const propertyPhotoUrls = payload.property.photos.map(photo => {
          return generateImageUrl(payload.property.provider, photo.photo_thumb, (photo.photo_order === 0), photo.is_ai || false)
        });
        await hydrateImageCache(propertyPhotoUrls);
        const immobiliare = await storeAds(propertyXml);
        homepandaPayloadCallback = successActionPayload(payload.actionId, JSON.stringify(immobiliare));
      } catch (error) {
        homepandaPayloadCallback = errorActionPayload(payload.actionId, error.message);
      } finally {
        if (payload.hasOwnProperty('webhook_callback')) {
          try {
            await webhookAction(payload.webhook_callback, homepandaPayloadCallback);
            break;
          } catch (error) {
            console.error(error);            
          }
        }
        await updateAction(homepandaPayloadCallback);
      }
      break;
    case 'DELETE':
      try {
        const propertyXml = generateXml(payload.property, 'archive');
        const immobiliare = await storeAds(propertyXml);
        homepandaPayloadCallback = successActionPayload(payload.actionId, JSON.stringify(immobiliare));
      } catch (error) {        
        homepandaPayloadCallback = errorActionPayload(payload.actionId,error.message);
      } finally {
        if (payload.hasOwnProperty('webhook_callback')) {
          try {
            await webhookAction(payload.webhook_callback, homepandaPayloadCallback);
            break;
          } catch (error) {
            console.error(error);            
          }
        }
        await updateAction(homepandaPayloadCallback);
      }  
      break;  
    default:
      throw new Error('Undefined Action');      
  }
  
  return homepandaPayloadCallback;
};

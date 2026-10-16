import Immobiliare from './services/immobiliare.mjs';
import { sendBuyerLead, sendEvaluationLead, sendSaleLead } from './services/homepanda.mjs';

export const handler = async (event) => {

  const providers = {
    homepanda: Immobiliare.factoryFromJson(JSON.parse(process.env.PROVIDER_IMMOBILIARE_HP)),
    fondocasa: Immobiliare.factoryFromJson(JSON.parse(process.env.PROVIDER_IMMOBILIARE_FC)),
    relab: Immobiliare.factoryFromJson(JSON.parse(process.env.PROVIDER_IMMOBILIARE_RLB)),
  }
  if (event.Records.length) {
    const saleLeads = [];
    const messageLeads = [];
    const evaluationLeads = [];
    for (var i = 0; i < event.Records.length; i++) {
      console.log('Message body', event.Records[i].body);
      const data = JSON.parse(event.Records[i].body);
      const queue = event.Records[i].eventSourceARN.replace(/arn\:aws\:sqs\:eu\-central-1\:247981707334\:/g, '');
      switch (queue) {
        case 'ImmobiliareLeads':
          if (providers.homepanda.isLogged() === false) {
            try {              
              await providers.homepanda.login();              
            } catch (error) {
              console.error('Homepanda', error);
              continue;
            }
          }          
          await providers.homepanda.retrieveLeadEvaluation(data);
          await providers.homepanda.retrieveLeadSale(data);
          break;
        case 'ImmobiliareFondoCasaLeads':
          if (providers.fondocasa.isLogged() === false) {
            try {
              await providers.fondocasa.login();
            } catch (error) {
              console.error('Fondocasa', error);
              continue;
            }
          }
          await providers.fondocasa.retrieveLeadEvaluation(data);
          await providers.fondocasa.retrieveLeadSale(data);
          break;
        case 'RelabImmobiliareLeads':
          if (providers.relab.isLogged() === false) {
            try {
              await providers.relab.login();
            } catch (error) {
              console.error('Relab', error);
              continue;
            }
          }
          await providers.relab.retrieveLeadEvaluation(data);
          await providers.relab.retrieveLeadSale(data);          
          break;
        case 'ImmobiliareNewMessage':
          if (providers.homepanda.isLogged() === false) {
            try {
              await providers.homepanda.login();
            } catch (error) {
              console.error('Homepanda', error);
              continue;
            }
          }
          await providers.homepanda.retrieveMessage(data);
          break;
        case 'RelabImmobiliareNewMessage':
          if (providers.relab.isLogged() === false) {
            try {
              await providers.relab.login();
            } catch (error) {
              console.error('Relab', error);
              continue;
            }
          }
          await providers.relab.retrieveMessage(data);
          break;
        default:
          console.log(`No queue handled: ${queue};`);
          break;
      }
    }
    for (const providerName in providers) {
      const provider = providers[providerName];
      if (provider.isLogged()) {
        await provider.logout();
      }
      if (provider.getLeadEvaluation().length) {
        evaluationLeads.push(...provider.getLeadEvaluation());
      }
      if (provider.getSaleLeads().length) {
        saleLeads.push(...provider.getSaleLeads());
      }
      if (provider.getMessageLeads().length) {
        messageLeads.push(...provider.getMessageLeads());
      }
    }
    console.log(`Find ${evaluationLeads.length} evaluate lead`);
    for (let index = 0; index < evaluationLeads.length; index++) {
      const item = evaluationLeads[index];
      try {
        await sendEvaluationLead(item);
      } catch (error) {
        console.error(error);
      }
    }
    console.log(`Find ${saleLeads.length} sales lead`);
    for (let index = 0; index < saleLeads.length; index++) {
      const item = saleLeads[index];
      try {
        await sendSaleLead(item);
      } catch (error) {
        console.error(error);
      }
    }
    console.log(`Find ${messageLeads.length} message lead`);
    for (let index = 0; index < messageLeads.length; index++) {
      const item = messageLeads[index];
      try {
        await sendBuyerLead(item);
      } catch (error) {
        console.error(error);
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
};


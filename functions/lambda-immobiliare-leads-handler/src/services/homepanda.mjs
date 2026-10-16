import axios from 'axios';
const client = axios.create({
  baseURL: 'https://api.homepanda.it',
  timeout: 15000
});

export async function sendEvaluationLead(immobiliareLead) {
  const lead = {
    contact: {
      name: setDefault(immobiliareLead.user, 'name', 'Homepanda'),
      surname: setDefault(immobiliareLead.user, 'lastname', 'Placeholder'),
      phone: immobiliareLead.user.phone.replace(/\s|\+39/g, ''),
      email: immobiliareLead.user.email.toLowerCase(),
      privacy_1: 1,
      privacy_2: 0,
      privacy_3: 0,
      privacy_4: 0,
    },
    type: 'seller',
    source: 'Immobiliare.it - Valutazioni',
    source_id: immobiliareLead.id,
    evaluate: {
      typology: immobiliareLead.typology,
      rooms: immobiliareLead.rooms.replace(/(?:( \d{2,4}))|[^\d]/g, '') || 1,
      baths: immobiliareLead.bathrooms || 0,
      mq: immobiliareLead.surface.replace(/(?:( \d{2,4}))|[^\d]/g, ''),
      condition: immobiliareLead.propertyStatus || "Buono/Abitabile",
      floor: mapFloor(immobiliareLead.floor),
      box: 'Assente',
      elevator: (immobiliareLead.elevator === 'Si'),
      cellar: 0,
      category: 'Residenziale',
      note: immobiliareLead.notes.join('<br>')
    },
    location: {
      lat: immobiliareLead.geographyInformation.latitude,
      lng: immobiliareLead.geographyInformation.longitude,
      city: immobiliareLead.geographyInformation.city.name,
      address: `${immobiliareLead.geographyInformation.address}, ${immobiliareLead.geographyInformation.city.name}`
    },
    url: `https://www.immobiliare.it/acquisizione/valutazioni?utm_source=immobiliare&utm_campaign=${immobiliareLead.geographyInformation?.macroZone?.name?.replace(/[0-9]+| \-+ /g, '')?.replace(/, /g, '_')?.replace(/\s/g, '-')}`
  };

  const response = await client.post('/v2/lead/evaluate', lead);
  console.log(`Lead evaluate insert response : ${response.data} `);
}

export async function sendSaleLead(immobiliareLead) {
  const lead = {
    contact: {
      name: setDefault(immobiliareLead.contactInformation, 'firstname', 'Homepanda'),
      surname: setDefault(immobiliareLead.contactInformation, 'lastname', 'Placeholder'),
      phone: immobiliareLead.contactInformation.phone.replace(/\s|\+39/g, ''),
      email: immobiliareLead.contactInformation.email.toLowerCase(),
      privacy_1: 1,
      privacy_2: 0,
      privacy_3: 0,
      privacy_4: 0,
    },
    type: 'seller',
    source: 'Immobiliare.it - Valutazioni',
    source_id: immobiliareLead.id,
    evaluate: {
      typology: immobiliareLead.propertyInfo.typology,
      rooms: immobiliareLead.propertyInfo.rooms.replace(/(?:( \d{2,4}))|[^\d]/g, '') || 1,
      baths: immobiliareLead.propertyInfo.baths.replace(/(?:( \d{2,4}))|[^\d]/g, '') || 0,
      mq: immobiliareLead.propertyInfo.surface.replace(/(?:( \d{2,4}))|[^\d]/g, ''),
      condition: immobiliareLead.propertyInfo.propertyCondition || "Buono/Abitabile",
      floor: mapFloor(immobiliareLead.propertyInfo.floor),
      box: 'Assente',
      elevator: (immobiliareLead.propertyInfo.elevator === 'Si'),
      cellar: 0,
      category: 'Residenziale',
      note: [
        ...[
          `Prezzo minimo : ${immobiliareLead.prices?.priceMin || 0}`,
          `Prezzo medio: ${immobiliareLead.prices?.priceAvg || 0}`,
          `Prezzo massimo: ${immobiliareLead.prices?.priceMax || 0}`,
        ], ...immobiliareLead.notes]
        .join('<br>'),
    },
    location: {
      lat: immobiliareLead.geographyInformation.latitude,
      lng: immobiliareLead.geographyInformation.longitude,
      city: immobiliareLead.geographyInformation.city.name,
      address: `${immobiliareLead.geographyInformation.address}, ${immobiliareLead.geographyInformation.city.name}`
    },
    url: `https://www.immobiliare.it/acquisizione/valutazioni?utm_source=immobiliare&utm_campaign=${(immobiliareLead.geographyInformation.macroZone) ? immobiliareLead.geographyInformation.macroZone.name.replace(/[0-9]+| \-+ /g, '').replace(/, /g, '_').replace(/\s/g, '-') : ''}`
  };
  const response = await client.post('/v2/lead/evaluate', lead);
  console.log(`Lead evaluate insert response : ${response.data} `);
}

export async function sendBuyerLead(immobiliareLead) {
  const queueMessage = immobiliareLead.messageQueue;
  const customer = immobiliareLead.customer;
  let phone = immobiliareLead.messageQueue.phone;
  if (customer.hasOwnProperty('phone')) {
    phone = customer.phone.replace(/\s/g, '')
  }
  const lead = {
    'contact': {
      'name': queueMessage.name,
      'surname': queueMessage.surname,
      'phone': phone,
      'email': customer?.email?.toLowerCase(),
      'privacy_1': 1,
      'privacy_2': 0,
      'privacy_3': 0,
      'privacy_4': 0,
    },
    'type': 'buyer',
    'ad_id': immobiliareLead.subject.code,
    'source': 'Immobiliare.it',
    'url': queueMessage.url,
    'note': immobiliareLead.lead.text || queueMessage.note,
  };
  const response = await client.post('/v2/lead', lead);
  console.log(`Lead buyer insert response : ${response.data} `);
}

function mapFloor(floor) {
  switch (floor) {
    case 'Terra':
      return 'Pianoterra';
    case 'Primo':
      return '1 piano';
    case 'Secondo':
      return '2 piano';
    case 'Terzo':
      return '3 piano';
    case 'Quarto':
      return '4 piano';
    case 'Quinto':
      return '5 piano';
    default:
      return floor;
  }
}

function setDefault(data, key, def) {
  if (!data[key]) {
    return def;
  }
  if (data[key].length > 3) {
    return data[key]
  }

  return def;
}
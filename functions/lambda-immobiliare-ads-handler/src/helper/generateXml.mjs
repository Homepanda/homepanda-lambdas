import xmlbuilder from 'xmlbuilder';
import { DateTime } from 'luxon';
import findIstatCode from './findIstatCode.mjs';

function translateBuildingType(builderTypeId) {
  switch (builderTypeId) {
    case 1:
      return 14;
    case 2:
      return 15;
    case 3:
      return 16;
    case 4:
      return 42;
    case 5:
      return 47;
    case 6:
      return 254;
    case 7:
      return 28;
    case 8:
      return 23;
    case 9:
      return 26;
    case 10:
      return 17;
    case 11:
      return 19;
    case 12:
      return 14;
    case 13:
      return 265;
    case 14:
      return 77;
    case 15:
      return 227;
    case 16:
      return 70;
    case 17:
      return 249;
    case 18:
      return 67;
    case 19:
      return 65;
    case 20:
      return 246;
    case 21:
      return 73;
    case 22:
      return 81;
    case 23:
      return 268;
    case 24:
      return 187;
    case 25:
      return 269;
    case 26:
      return 21;
    case 27:
      return 23;
    case 28:
      return 24;
    case 29:
      return 25;
    case 30:
      return 27;
    case 31:
      return 30;
    case 34:
      return 194;
    case 35:
      return 195;
    case 36:
      return 236;
    case 37:
    case 38:
    case 39:
      return 268;
    case 40:
      return 262;
    case 42:
      return 83;
    default:
      return 14;
  }
}

function translateBuildingStatusType(buildingStatusTypeId) {
  switch (buildingStatusTypeId) {
    case 1:
      return 'nuovo';
    case 2:
      return 'ottimo';
    case 3:
      return 'buono';
    case 4:
      return 'da ristrutturare';
    default:
      return 'buono';
  }
}

function translateBuildingPropertyType(buildingPropertyTypeId) {
  switch (buildingPropertyTypeId) {
    case 1:
      return 'di lusso';
    case 2:
      return 'signorile';
    case 3:
      return 'medio';
    case 4:
      return 'economico';
    default:
      return 'medio';
  }
}
function translateKitckenType(kitckenTypeId) {
  switch (kitckenTypeId) {
    case 1:
      return 'Abitabile';
    case 2:
      return 'Angolo cottura';
    case 3:
      return 'Cucinotto';
    case 4:
      return 'A vista';
    case 5:
      return 'Semi abitabile';
    default:
      return 'Abitabile';
  }
}
function translateFloorType(floorType) {
  switch (floorType.floor_id) {
    case 1:
      return {
        type: 'Interrato',
        value: 'Interrato(-1)'
      };
    case 2:
      return {
        type: 'Interrato',
        value: -1
      };
    case 3:
      return {
        type: 'Seminterrato',
        value: -1
      };
    case 4:
      return {
        type: 'PianoTerra',
        value: 0,
      };
    case 5:
      return {
        type: 'Ammezzato',
        value: 'Ammezzato',
      };
    case 6:
      return {
        type: 'Rialzato',
        value: 1,
      };
    case 30: {
      return {
        type: 'Interrato',
        value: 'Interrato(-1)'
      };
    };
    case 31: {
      return {
        type: 'Interrato',
        value: 'Interrato(-2)'
      };
    };
    case 32: {
      return {
        type: 'Interrato',
        value: 'Interrato(-3)'
      };
    };
    case 33: {
      return {
        type: 'Interrato',
        value: 'Interrato(-4)'
      };
    };
    case 34: {
      return {
        type: 'Interrato',
        value: 'Interrato(-5)'
      };
    };
    case 29: {
      return {
        type: 'Interrato',
        value: 20
      };
    };
    default:
      return {
        type: 'Intermedio',
        value: floorType.floor_name,
      };
  }
}
function translateBoxType(boxTypeId) {
  switch (boxTypeId) {
    case 1:
      return {
        type: 'Box',
        value: 1
      };
    case 2:
      return {
        type: 'Box',
        value: 2
      };
    default:
      return {
        type: 'No',
        value: 0
      };
  }
}
function translateHeatingSupplyType(heatingSupplyTypeId) {
  switch (heatingSupplyTypeId) {
    case 5:
      return 'Gas';
    case 6:
      return 'Pellet';
    case 7:
      return 'Legna';
    case 8:
      return 'Solare';
    case 9:
      return 'Fotovoltaico';
    case 10:
      return 'Elettrica';
    default:
      return null;
  }
}
function translateHeatingTypology(heatingTypologyId) {
  switch (heatingTypologyId) {
    case 1:
      return 'A radiatori'
    case 2:
      return 'A pavimento'
    case 3:
      return 'Ad aria'
    case 4:
      return 'A stufa'
    default:
      return null;
  }
}
function translateFreeSide(freeSideId) {
  switch (freeSideId) {
    case 2:
      return 'due, paralleli';
    case 3:
      return 'due, ad angolo';
    case 4:
      return 'tre';
    case 5:
      return 'quattro';
    default:
      return 'uno';
  }
}
function translatefixturesType(fixturesTypeId) {
  switch (fixturesTypeId) {
    case 1:
      return 'glass/wood';
    case 2:
      return 'glass/metal';
    case 3:
      return 'glass/pvc';
    case 4:
      return 'double glass/wood';
    case 5:
      return 'double glass/metal';
    case 6:
      return 'double glass/pvc';
    case 7:
      return 'triple glass/wood';
    case 8:
      return 'triple glass/metal';
    case 9:
      return 'triple glass/metal';
    default:
      return 'nd';
  }
}
function translateAirConditioning(airConditioningId) {
  switch (airConditioningId) {
    case 1:
      return 'Autonomo';
    case 2:
      return 'Assente';
    case 3:
      return 'Predisposizione impianto';
    default:
      return 'nd';
  }
}
function translateConciergeType(conciergeType) {
  switch (conciergeType) {
    case 1:
      return true;
    case 2:
      return 'half-day';
    case 3:
      return false;
  }
}
function translateAirConditioningEffect(airConditioningTypeId) {
  switch (airConditioningTypeId) {
    case 1:
      return 'Freddo/Caldo';
    case 2:
      return 'Freddo';
    case 3:
      return 'Caldo';
  }
}
function translateRentContract(rentalTypeId) {
  switch (rentalTypeId) {
    case 1:
      return '4+4';
    case 2:
    case 3:
      return 'Libero';
    case 4:
      return '6+6';
    case 5:
      return '9+9';
    case 6:
      return 'Concordato';
    case 7:
      return '3+2';
    case 8:
      return 'Studenti';
    case 9:
      return 'Transitorio';
  }
}
function translateEnergyClass(energyClassName) {
  if (!energyClassName) {
    return 'NC';
  }
  switch (energyClassName) {
    case 'Non classificabile':
      return 'NC';
    default:
      return energyClassName;
  }
}

function translateOfficeName(city) {
  let officeName = 'Agenzia Homepanda';
  return officeName;
}
export function extractImmobiliareAdsId(property) {
  if (property.links && property.links.length) {
    const adsLink = property.links.filter(item => {
      return (item.portal === 'IMMOBILIARE')
    });
    if (adsLink.length) {
      return adsLink[0].link_path.replace(/[^\d]/g, '');
    }
  }

  throw new Error('Immobiliare id ads not found');
}

export function generateImageUrl(provider, thumbId, isMain = false, isAi = false) {
  return (isMain)
    ? `https://thumb.homepanda.it/property/${provider}/1680x0/${isAi ? 'ai/' : ''}main/${thumbId}`
    : `https://thumb.homepanda.it/property/${provider}/1680x0/${isAi ? 'ai/' : ''}${thumbId}`;
}

export function generateXml(propertyData, operation = 'write') {
  const data = propertyData;
  const instatCode = findIstatCode(data.city.city_name);

  /* let tagProvider = data.provider;
  switch (data.provider.split('_')[0]) {
    case 'RLB':
      tagProvider = 'RLB';
      break;
  } */
  const xml = xmlbuilder.create('property', { version: '1.0', encoding: 'UTF-8' }).att({ operation: operation });
  xml.ele('unique-id', data.property_id);
  xml.ele('published-on', DateTime.fromSQL(data.publish_date).toFormat("yyyy-LL-dd'T'00:00:00"));
  xml.ele('date-updated', DateTime.now().toFormat("yyyy-LL-dd'T'HH:mm:ss"));
  const agent = xml.ele('agent');
  agent.ele('office-name', translateOfficeName(data.city.city_name))
  agent.ele('email', data.emailProvider);
  xml.ele('location')
    .ele('country-code', 'IT').up()
    .ele('sub-administrative-area', data.province.province_name).up()
    .ele('city', data.city.city_name).att({ code: instatCode.istat }).up()
    .ele('locality').att({ map: 'exact' })
    .ele('thoroughfare').att({ display: 'yes' }).dat(data.address.replace(/[\d]+/, '').trim()).up()
    .ele('street-number', data.address.replace(/[^\d]+/, '').trim()).up()
    .ele('latitude', data.latitude).up()
    .ele('longitude', data.longitude).up();
  if (data.photos) {
    const pictures = xml.ele('pictures');
    const picturesLength = (data.photos.length < 100) ? data.photos.length : 100;
    for (let i = 0; i < picturesLength; i++) {
      let picture = data.photos[i];
      pictures.ele('picture', picture.photo_label)
        .att('position', picture.photo_order + 1)
        .att('url', generateImageUrl(data.provider, picture.photo_thumb, (picture.photo_order === 0), picture.is_ai || false));
    }
  }
  xml.ele('reference-code', data.property_id)
  xml.ele('publish')
    .ele('portal').att('id', 'immobiliare.it').att('status', true)
    .ele('visibilities')
    .ele('visibility', 'premium').att('op', 'active')
  xml.ele('transactions')
    .ele('transaction')
    .att('type', `${(data.contract.contract_id === 1) ? 'S' : 'R'}`)
    .att('ownership', data.property_typology.property_typology_name.toLowerCase())
    .att('on-redeem', (data.rent_ransom) ? true : false)
    .ele('price', data.price.price).att('currency', 'EUR').att('reserved', false).up().up()
  xml.ele('building').att('IDType', translateBuildingType(data.typology.typology_id))
    .ele('status', translateBuildingStatusType(data.conservative_state?.conservative_state_id || 0)).up()
    .ele('class', translateBuildingPropertyType(data.property_type?.property_type_id || 0));
  const features = xml.ele('features');
  const roomsDetails = features.ele('rooms-detail');
  roomsDetails.ele('amount-bedrooms', data.bedrooms)
  roomsDetails.ele('amount-other-rooms', data.rooms)
  if (data.kitchen_type) {
    roomsDetails.ele('kitchen', translateKitckenType(data.kitchen_type.kitchen_type_id)).up().up()
  }
  features.ele('sizes').att('unit', 'm2')
    .ele('size').att('main', true)
    .ele('type', 'Abitazione').up()
    .ele('floor', translateFloorType(data.floor).value).att('type', translateFloorType(data.floor).type).up()
    .ele('surface', data.surface).up()
    .ele('weight', 100).up().up().up()
    .ele('descriptions')
    .ele('description').att('language', 'it')
    .ele('title', data.title).up()
    .ele('content', data.description.replace(/\n/g, '')).up().up().up();
  const energyClass = features.ele('energy-class').att('scale', ([6, 7].includes(data.energy_class.energy_class_id)) ? 1 : 2).att('value', translateEnergyClass(data.energy_class.energy_class_name));
  energyClass.ele('energy-performance', (data.energy_consumption) ? data.energy_consumption : 3.51).att('type', 'nren').att('unit', 'kWh/m2anno');
  const extrafeatures = xml.ele('extra-features')
  extrafeatures.ele('bathrooms', data.baths)
  if (data.box) {
    extrafeatures.ele('garage', translateBoxType(data.box.box_id).value).att('type', translateBoxType(data.box.box_id).type);
  }
  let freeConditions = false;
  if (data.current_state) {
    if (data.current_state.current_state_id === 1) {
      freeConditions = true;
    }
  }
  extrafeatures.ele('free-conditions').att('free', freeConditions);
  if (data.construction_year) {
    extrafeatures.ele('build-year', DateTime.fromSQL(data.construction_year).toFormat("yyyy"));
  }

  const ambience = extrafeatures.ele('ambience')
  if (data.heating_type) {
    const heating = ambience.ele('heating').att('type', data.heating_type.heating_type_name);
    if (data.heating_supply_type) {
      heating.ele('source', translateHeatingSupplyType(data.heating_supply_type.heating_supply_type_id))
      if (data.heating_typology) {
        heating.ele('system', translateHeatingTypology(data.heating_typology.heating_typology_id))
      }
    }
  }
  if (data.air_conditioning) {
    ambience
      .ele('air-conditioning')
      .att('type', translateAirConditioning(data.air_conditioning.air_conditioning_id))
      .att('present', (data.air_conditioning.air_conditioning_id === 1) ? true : false)
      .ele('effect', (data.air_conditioning_type) ? translateAirConditioningEffect(data.air_conditioning_type.air_conditioning_type_id) : null)
      .up().up()
  }
  extrafeatures.ele('garden', (data.garden === 1) ? (data?.garden_type === 'public' ? 'Comune' : 'Privato') : 'Nessuno')
  extrafeatures.ele('terrace', (data.terrace == 1) ? true : false)
  extrafeatures.ele('balcony', (data.balconies == 1) ? true : false)
  extrafeatures.ele('elevator', (data.elevator == 1) ? true : false)
  extrafeatures.ele('for-revenue', (data.property_income === 1) ? true : false)
  if (data.floor_tot) {
    extrafeatures.ele('num-floors', data.floor_tot)
  }
  extrafeatures.ele('additional-costs', (data.expense_apartment) ? (data.expense_apartment + data.expense_other) : 0).att('currency', 'EUR');
  extrafeatures.ele('additional-heating-costs', (data.expense_heating) ? (data.expense_heating * 12) : 0).att('currency', 'EUR');
  extrafeatures.ele('floor', translateFloorType(data.floor).value).att('type', translateFloorType(data.floor).type);
  if (data.interior_decoration) {
    extrafeatures.ele('furniture', data.interior_decoration.interior_decoration_name);
  }
  if (data.contract.contract_id === 2) {
    extrafeatures.ele('rent-contract', translateRentContract(data.rental_type.rental_type_id));
    extrafeatures.ele('costs').ele('deposit', Math.floor(data.rental_deposit)).att('currency', 'EUR').up().up();
  }
  const extended = xml.ele('extended')
  extended.ele('amount-terrace', (data.terrace != null) ? data.terrace : 0);
  extended.ele('amount-balcony', (data.balconies != null) ? data.balconies : 0);
  extended.ele('security-door', (data.security_door != null) ? Boolean(data.security_door) : false);
  extended.ele('tub', (data.hydromassage != null) ? Boolean(data.hydromassage) : false);
  extended.ele('security-alarm', (data.alarm_system != null) ? Boolean(data.alarm_system) : false);
  extended.ele('concierge', (data.concierge == 1) ? translateConciergeType(data.concierge_type.concierge_id) : false);
  extended.ele('optical-fiber', (data.fiber != null) ? Boolean(data.fiber) : false);
  extended.ele('video-intercom', (data.videophone != null) ? Boolean(data.videophone) : false);
  extended.ele('free-side', translateFreeSide(data?.free_sides?.free_sides_id || 0));
  extended.ele('electric-gate', (data.electric_gate != null) ? Boolean(data.electric_gate) : false);
  extended.ele('basement', (data.cellar != null) ? Boolean(data.cellar) : false);
  extended.ele('penthouse', (data.mansard != null) ? Boolean(data.mansard) : false);
  extended.ele('fireplace', (data.fire_place != null) ? Boolean(data.fire_place) : false);
  extended.ele('external-frames', translatefixturesType((data.fixtures_type != null) ? data.fixtures_type.fixtures_type_id : 0));
  extended.ele('tv', 'centralized');
  extended.ele('swimming-pool', (data.swimming_pool != null) ? Boolean(data.swimming_pool) : false);
  extended.ele('tennis', (data.tennis_court != null) ? Boolean(data.tennis_court) : false);
  extended.ele('disabled-people-access', false);
  extended.ele('amount-cupboard', 0);
  extended.ele('sharable', false);
  extended.ele('tavern', (data.tavern != null) ? Boolean(data.tavern) : false);
  if (data.parking_places) {
    extended.ele('amount-car-parking', data.parking_places);
  }
  if (data.exposition) {
    switch (data.exposition.exposition_id) {
      case 1:
        extended.ele('inner-exposition', true);
        break;
      case 2:
        extended.ele('outer-exposition', true);
        break;
      case 3:
        extended.ele('inner-exposition', true);
        extended.ele('outer-exposition', true);
        break;
    }
  }
  if (data.media) {
    const blueprints = xml.ele('blueprints');
    const img360s = xml.ele('raw-360s');
    for (let i = 0; i < data.media.length; i++) {
      const media = data.media[i];
      if (media.media_type === 'VIRTUAL_TOUR') {
        img360s.ele('raw-360', '360')
          .att('position', i + 1)
          .att('url', `https://cdn.homepanda.it/${data.property_id}/media/virtual_tour/${media.media_path}`);
      }
      if (media.media_type === 'PLANIMETRY') {
        blueprints.ele('blueprint', 'Planimetria')
          .att('position', i + 1)
          .att('url', `https://cdn.homepanda.it/${data.property_id}/media/planimetry/${media.media_path}`);
      }
    }
  }

  return xml.end();
}
import { DateTime } from 'luxon';

function translateSaleType(propertyTypologyId) {
	switch (propertyTypologyId) {
		case 1:
      return 3;
		case 2:
      return 2;
		case 3:
      return 4;
		case 4:
			return 5;
		case 5:
			return 0;
		case 6:
			return 6;
		default:
			return 3;
	}
}

function translateCategory(categoryId) {
	switch (categoryId) {
		case 1:
      return 1;
		case 2:
      return 2;
		case 4:
			return 3;		
		default:
			return 1;	
	}
}

function translateTypology(typologyId) {
  switch (typologyId) {    
    case 1:
			return 1;
		case 2:
			return 4;
		case 3:
			return 151;
		case 4:
			return 7;
		case 5:
			return 177;
		case 6:
			return 164;
		case 7:
			return 137;
		case 8:
			return 153;
		case 9:
			return 3;
		case 10:
			return 19;
		case 11:
			return 20;
		case 12:
			return 222;
		case 13:
			return 14;
		case 14:	
			return 174;
		case 15:
			return 191;
		case 16:
			return 12;
		case 17:
			return 13;
		case 18:
			return 9;
		case 19:
			return 8;		
		case 20:
			return 175;
		case 21:
			return 189;
		case 22:
			return 192;
		case 23:
			return 187;
		case 24:	
			return 16;
		case 25:	
			return 17;
		case 26:
			return 5;
		case 27:
			return 153;
		case 28:
			return 154;
		case 29:
			return 157;
		case 30:
			return 161;
		case 31:
			return 132;
		case 33:
			return 144;
		case 34:
			return 126;
		case 35:
			return 125;
		case 36:
			return 127;
		case 37:
			return 9;
		case 38:
			return 9;
		case 39:
			return 9;
		case 40:
			return 17;
		case 42:
			return 15;			
  }
}

function translateEnergyClass(energyClassId) {
	switch (energyClassId) {
		case 1:
			return 12;
		case 2:
			return 1;
		case 3:
			return 2;
		case 4:
			return 3;
		case 5:
			return 4;
		case 6:	
		case 7:	
		case 8:
			return 5;
		case 9:
			return 6;
		case 10:
			return 7;
		case 11:
			return 8;
		case 12:
			return 9;
		case 13:
			return 10;				
	}
}

function translateBoxType(boxId) {
	switch (boxId) {
		case 1:			
			return 1;
		case 2:
			return 2;
		case 3:	
		default:
			return 0;
	}
}

function translateAirConditioning(airConditioning) {
	switch (airConditioning.air_conditioning_id) {
		case 1:
			return 3;
		case 2:
			return 0;		
		case 3:
			return 2;
	}
}

function generateImagesPayload(propertyData) {
	const images = [];
	if (propertyData.photos) {		
		const picturesLength = (propertyData.photos.length < 200) ? propertyData.photos.length : 200;
		for(let i = 0; i < picturesLength; i++) {
				let picture = propertyData.photos[i];
				const isAi = picture.is_ai || false;
				images.push({
					imageType: { imageTypeId : 1 },
					position: (picture.photo_order + 1),
					filename: (picture.photo_order === 0) 
						? `https://thumb.homepanda.it/property/${propertyData.provider || 'HP'}/1024x0/${isAi ? 'ai/' : ''}main/${picture.photo_thumb}` 
						: `https://thumb.homepanda.it/property/${propertyData.provider || 'HP'}/1024x0/${isAi ? 'ai/' : ''}${picture.photo_thumb}`
				});
		}
	}
	if (propertyData.media) {
		for(let i = 0; i < propertyData.media.length; i++) {
			const media = propertyData.media[i];			
			if (media.media_type === 'PLANIMETRY') {
				images.push({
					imageType: { imageTypeId : 2 },
					position: Number((i + 1)),
					filename: `https://cdn.homepanda.it/${propertyData.property_id}/media/planimetry/${media.media_path}`
				});
			}
		}		
	}
	
	return images;
}

function translateCadastralCategory(categoryRegistryId) {
	switch (categoryRegistryId) {
		case 12:
			return 20;
		case 13:
			return 21;	
		case 14:
			return 22;
		case 15:
			return 23;
		case 16:
			return 24;
		case 17:
			return 25;
		case 18:
			return 26;				
		default:
			return categoryRegistryId;
	}
}

function translateInteriorDecoration(interiorDecorationId) {
	switch (interiorDecorationId) {		
		case 3:
			return 0;
		case 4:
			return 3;		
		default:
			return interiorDecorationId;
	}
}

function translateConservativeState(ConservativeStateId) {
	switch (ConservativeStateId) {
		case 1:
			return 5;
		case 2:
			return 4;
		case 3:
			return 3;
		case 4:
			return 2;
	}
}

function translateHeatingType(heatingTypeId) {
	switch (heatingTypeId) {
		case 1:
			return 1;
		case 2:
			return 3;
		case 3:
			return 0;		
	}
}

function translateHeatingTypeDeprecated(heatingTypeId) {
	switch (heatingTypeId) {
		case 1:
			return 1;
		case 2:
			return 2;
		case 3:
			return undefined;		
	}
}

function translateHeatingSourceType(heatingSourceTypeId) {
	switch (heatingSourceTypeId) {
		case 1:
			return 13;
		case 2:
			return 12;
		case 3:
			return 10;
		case 4:
			return 255;
		default:
			return 0;			
	}
}

function translateKitchenType(KitchenTypeId) {
	switch (KitchenTypeId) {
		case 1:
			return 4;
		case 2:
			return 1;	
		case 3:
			return 5;
		case 4:
			return 2;
	}
}

function translateFixturesType(FixturesTypeId) {
	switch (FixturesTypeId) {
		case 1:
			return 5;
		case 2:
			return 6;	
		case 3:
			return 4;
		case 4:
			return 8;
		case 5:
			return 9;
		case 6:
			return 7;			
	}
}

function translatePropertyType(PropertyTypeId) {
	switch (PropertyTypeId) {
		case 1:
			return 6;
		case 2:
			return 3;	
		case 3:
			return 7;
		case 4:
			return 0;			
	}
}

export function extractAdsId(property) {
	if (property.links && property.links.length) {
		const adsLink = property.links.filter( item => {
			return (item.portal === 'WIKICASA')
		});
		if (adsLink.length) {
			return adsLink[0].link_path.replace(/[^\d]/g, '');
		}  
	}
    
  throw new Error('Wikicasa id ads not found');
}

export function generatePayload (propertyData) {
	const data = propertyData;	
	const payload = {
		published: true,
		reStatus: 1,
		externalId: String(data.property_id),
		reference: String(data.property_id),
		agentId: 28396,
		sale: (data.contract.contract_id === 1) ? true : false,
		rent: (data.contract.contract_id === 2) ? true : false,
		occupationStateType: (data.current_state) 
		? (data.current_state.current_state_id == 1) ? 1 : 0
		: undefined,
		reservedPrice: false,
		description: data.description,
		macroTypologyId: translateCategory(data.category.category_id),
		typology: { typologyId: translateTypology(data.typology.typology_id) },
		exclusive: true,
		address: {
			street: data.address,			
			latitude: data.latitude,
			longitude: data.longitude,
			floor: data.floor.floor_name
		},
		energyClassType2015: {
			energyClassTypeId: translateEnergyClass(data.energy_class.energy_class_id)
		},
		realEstateImages: generateImagesPayload(data),
		metadata: {	
			publishAddressNumber: true,
			publishAddress: true,
			publishMap: true,
		},
		rooms: (data.rooms + data.bedrooms),
		bathrooms: data.baths,  	
  		sqM: data.surface,
		boxType: { boxTypeID : (data.box) ? translateBoxType(data.box) : 0 },
		priceBox: (data.price_box) ? data.price_box.price : undefined,
		carSpot: data.parking_places || undefined,
		hasBalconies: (data.balconies !== null) || false,
		balconies: (data.balconies !== null) ? data.balconies : 0,
		hasTerraces: (data.terrace !== null) || false,
		terraces: (data.terrace !== null) ? data.terrace : 0,
		reception: (data.concierge),
		cellar: (data.cellar),
		gardenPrivate: (data.garden != 0 && data?.garden_type !== 'public') || false,
		gardenPrivateSqM: (data.garden_mq !== null) ? data.garden_mq : undefined,
		gardenPublic: (data.garden != 0 && data?.garden_type !== 'private') || false,
		airConditioning: (data.air_conditioning) ? (translateAirConditioning(data.air_conditioning) !== 2) : false,
		airConditioningType: { airConditioningTypeID: (data.air_conditioning) ? translateAirConditioning(data.air_conditioning) : 255 },	
		buildingFloors: data.floor_tot || undefined,
		antitheft: data.alarm_system || undefined,
		lift: data.elevator,
		cadastralCategory: (data.category_registry) ? { id : translateCadastralCategory(data.category_registry.category_registry_id) } : undefined,
		buildingYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
		furnished: (data.interior_decoration) ? Boolean(translateInteriorDecoration(data.interior_decoration.interior_decoration_id)) : false,
		furnishedType: (data.interior_decoration) ? { furnishedTypeID : translateInteriorDecoration(data.interior_decoration.interior_decoration_id) } : undefined,
		heatingExpenses: data.expense_heating || undefined,
		annualExpenses: (data.expense_apartment) ? data.expense_apartment * 12 : undefined,
		conditionType: (data.conservative_state) ? { conditionTypeId: translateConservativeState(data.conservative_state.conservative_state_id) } : undefined,
		heatingType: (data.heating_type && data.heating_type.heating_type_id != 3) ? { heatingTypeId : translateHeatingTypeDeprecated(data.heating_type.heating_type_id) } : undefined,
		heatingSystemType: (data.heating_type) ? { heatingSystemTypeID: translateHeatingType(data.heating_type.heating_type_id) } : undefined,
		heatingSourceType: (data.heating_supply_type) ? { heatingSourceTypeID: translateHeatingSourceType(data.heating_supply_type.heating_supply_type_id) } : undefined,
		kitchenType: (data.kitchen_type) ? { kitchenTypeId: translateKitchenType(data.kitchen_type.kitchen_type_id) } : undefined,
		
	}
	if (payload.sale) {
		payload.saleType = {
			saleTypeID: translateSaleType(data.property_typology.property_typology_id)
		}
		payload.bareOwnership = (data.property_typology.property_typology_id === 2) ? true : false;
		payload.auction = false;
		payload.priceSale = data.price.price
	}
	if (payload.rent) {
		payload.rentType = {
			rentTypeID: 0
		}
		payload.shortRent = false;
		payload.priceRent = data.price.price;
	}
	if(data.category.category_id === 1) {
		payload.detailsResidential = {
			opticFiber: (data.fiber),
			electricGate: (data.electric_gate),
			hydromassage: (data.hydromassage),
			securityDoor: (data.security_door),
			externalFixturesTypeID: (data.fixtures_type) ? translateFixturesType(data.fixtures_type.fixtures_type_id)  : undefined,
			buildingTypeID: (data.property_type) ? translatePropertyType(data.property_type.property_type_id)  : undefined,
		}
	}
	if(data.category.category_id === 2) {
		payload.detailsBusiness = {
			opticFiber: (data.fiber),
			electricGate: (data.electric_gate),
			hydromassage: (data.hydromassage),
			securityDoor: (data.security_door),
			externalFixturesTypeID: (data.fixtures_type) ? translateFixturesType(data.fixtures_type.fixtures_type_id)  : undefined,
			buildingTypeID: (data.property_type) ? translatePropertyType(data.property_type.property_type_id) : undefined,
		}
	}
	return payload;
}
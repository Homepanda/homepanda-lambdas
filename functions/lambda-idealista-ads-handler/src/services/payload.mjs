import { DateTime } from 'luxon';
import findCap from "./findCap.mjs";

function translateType(typologyId) {
	switch (typologyId) {
		case 7:
		case 31:
		case 33:
			return 'countryhouse';
		case 4:
		case 6:
			return 'garage';
		case 11:
			return 'building';
		case 8:
		case 9:
		case 12:
		case 26:
		case 27:
		case 28:
		case 29:
			return 'house';
		case 19:
			return 'office';
		case 13:
		case 14:
		case 15:
		case 16:
		case 17:
		case 18:
		case 20:
		case 21:
		case 22:
		case 23:
		case 37:
		case 38:
		case 39:
		case 42:
			return 'commercial';
		case 24:
		case 25:
			return 'land';
		case 34:
		case 35:
		case 36:
			return 'room'
		default:
			return 'flat';
	}
}

function translateConservationType(buildingConservationId) {
	switch (buildingConservationId) {
		case 1:
			return 'new_development_finished';
		case 2:
			return 'fullyReformed';
		case 3:
			return 'good';
		case 4:
			return 'toRestore';
		default:
			return 'good';
	}
}

function translateHeatingType(heatingType, heatingSupplyType) {
	if (heatingType && heatingType?.heating_type_id == 3) {
		return 'no_heating';
	}
	if (heatingType?.heating_type_id == 1) {
		return 'individual_other';
	}
	if (heatingType?.heating_type_id == 2) {
		return 'central_other';
	}
}

function translateFloor(floorType) {
	if (!floorType) {
		return 'bj';
	}
	switch (floorType.floor_name) {
		case 'Interrato':
			return '-2';
		case 'Scantinato':
			return '-1';
		case 'Seminterrato':
			return 'ss';
		case 'Piano Terra':
			return 'bj';
		case 'Piano Ammezzato':
		case 'Piano Rialzato':
			return 'en';
		default:
			return floorType.floor_name;
	}
}

function translateEnergyCertificateLaw(energyClassId) {
	switch (energyClassId) {
		case 6:
		case 7:
			return 'dl-192_2005';
		default:
			return 'legge-90_2013';
	}
}

function getFeaturesByType(type, data) {
	let features = {};
	switch (type) {
		case 'countryhouse':
			features = {
				type: 'countryhouse',
				areaConstructed: data.surface,
				balcony: (data.balconies > 0) ? true : false,
				bathroomNumber: data.baths,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				conditionedAir: (data.air_conditioning)
					? (data.air_conditioning.air_conditioning_id === 1) ? true : false
					: false,
				conservation: translateConservationType(data.conservative_state.conservative_state_id),
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				floorsBuilding: data.floor_tot || undefined,
				garden: Boolean(data.garden),
				gardenType: (data.garden !== 0 ? (data?.garden_type === 'public' ? 'community' : 'private') : undefined),
				rooms: (Number(data.rooms) + Number(data.bedrooms)),
				storage: Boolean(data.cellar),
				terrace: (data.terrace > 0) ? true : false,
				heatingType: translateHeatingType(data.heating_type, data.heating_supply_type),
				priceCommunity: data.expense_apartment || undefined,
				parkingAvailable: (data.box?.box_id != 3) ? true : false,
				parkingPrice: (data.price_box) ? Number(data.price_box.price) : undefined,
			};
			if (data.box?.box_id != 3) {
				features.parkingSpaceCapacity = (data.box?.box_id == 2) ? "double" : "single";
			}
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			break;
		case 'garage':
			features = {
				areaConstructed: data.surface,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				garageCapacity: (data.box.box_id == 1) ? 'car_sedan' : (data.box.box_id == 2) ? 'two_cars_and_more' : 'unknown',
				securityAlarm: (data.alarm_system) ? true : false,
				liftAvailable: Boolean(data.elevator),
				parkingType: (data.parking_places > 0) ? 'parking_space' : 'depot',
				priceCommunity: data.expense_apartment || undefined,
				currentOccupation: (data.current_state)
					? (data.current_state.current_state_id == 1) ? 'free' : 'not_free'
					: 'free',
			};
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			if ((data.contract.contract_id === 2)) {
				delete features.currentOccupation;
			}
			break;
		case 'building':
			features = {
				areaConstructed: data.surface,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				classificationOther: true,
				conservation: translateConservationType(data.conservative_state.conservative_state_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				floorsBuilding: data.floor_tot || 1,
				liftNumber: (data.elevator) ? 1 : 0,
				parkingSpacesNumber: data.parking_places || 0,
				garden: Boolean(data.garden),
				gardenType: (data.garden !== 0 ? (data?.garden_type === 'public' ? 'community' : 'private') : undefined),
				propertyTenants: (data.contract.contract_id === 1) ? false : undefined
			};
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			break;
		case 'office':
			features = {
				areaConstructed: data.surface,
				securitySystem: (data.alarm_system) ? true : false,
				bathroomNumber: data.baths || undefined,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				conditionedAirType: (data.air_conditioning)
					? (data.air_conditioning.air_conditioning_id === 1)
						? 'cold' : (data.air_conditioning.air_conditioning_id === 3)
							? 'preInstallation' : 'notAvailable'
					: 'notAvailable',
				conservation: translateConservationType(data.conservative_state.conservative_state_id),
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				liftNumber: (data.elevator) ? 1 : 0,
				officeBuilding: false,
				parkingSpacesNumber: data.parking_places || 0,
				roomsSplitted: 'unknown',
				securityDoor: Boolean(data.security_door),
				storage: Boolean(data.cellar),
				priceCommunity: data.expense_apartment || undefined,
				currentOccupation: (data.current_state)
					? (data.current_state.current_state_id == 1) ? 'free' : 'not_free'
					: 'free',
			};

			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			if (data.contract.contract_id === 2) {
				delete features.currentOccupation;
				features.areaTradableMinimum = features.areaConstructed;
			}

			break;
		case 'house':
			let typology;
			switch (data.typology.typology_id) {
				case 9:
					typology = 'terraced';
					break;
				case 26:
					typology = 'independent';
					break;
				default:
					typology = 'villa'
					break;
			}
			features = {
				type: typology,
				areaConstructed: data.surface,
				balcony: (data.balconies > 0) ? true : false,
				bathroomNumber: data.baths,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				conditionedAir: (data.air_conditioning)
					? (data.air_conditioning.air_conditioning_id === 1) ? true : false
					: false,
				conservation: translateConservationType(data.conservative_state.conservative_state_id),
				currentOccupation: (data.current_state && data.contract.contract_id === 1)
					? (data.current_state.current_state_id == 1) ? 'free' : 'not_free'
					: 'free',
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				floorsBuilding: data.floor_tot || undefined,
				garden: Boolean(data.garden),
				gardenType: (data.garden !== 0 ? (data?.garden_type === 'public' ? 'community' : 'private') : undefined),
				rooms: (Number(data.rooms) + Number(data.bedrooms)),
				storage: Boolean(data.cellar),
				terrace: (data.terrace > 0) ? true : false,
				heatingType: translateHeatingType(data.heating_type, data.heating_supply_type),
				priceCommunity: data.expense_apartment || undefined,
				outdoorParkingSpaceAvailable: (data.parking_places) ? true : false,
				outdoorParkingSpaceNumber: data.parking_places || undefined,
				parkingAvailable: (data.box?.box_id != 3) ? true : false,
				parkingPrice: (data.price_box) ? Number(data.price_box.price) : undefined,
			};
			if (features.outdoorParkingSpaceAvailable) {
				features.outdoorParkingSpaceType = "uncovered";
				if (data.parking_places_type) {
					if (data.parking_places_type.parking_places_type_id == 1) {
						features.outdoorParkingSpaceType = "covered";
					}
				}
			}
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			if (data.contract.contract_id === 2) {
				delete features.currentOccupation;
			}
			break;
		case 'commercial':
			features = {
				type: 'retail',
				areaConstructed: data.surface,
				bathroomNumber: data.baths || undefined,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				conservation: translateConservationType(data.conservative_state?.conservative_state_id),
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				heating: (data.heating_type)
					? (data.heating_type?.heating_type_id != 3) ? true : false
					: undefined,
				rooms: (Number(data.rooms) + Number(data.bedrooms)),
				location: 'unknown',
				priceCommunity: data.expense_apartment || undefined,
				currentOccupation: (data.current_state && data.contract.contract_id === 1)
					? (data.current_state.current_state_id == 1) ? 'free' : 'not_free'
					: 'free',
				parkingAvailable: (data.box?.box_id != 3) ? true : false,
				parkingSpaceCapacity: (data.box)
					? (data.box === 1) ? 'single' : (data.box === 2) ? 'dobuble' : undefined
					: undefined,
				outdoorParkingSpaceAvailable: (data.parking_places) ? true : false,
				outdoorParkingSpaceNumber: data.parking_places || undefined
			};
			if (features.outdoorParkingSpaceAvailable) {
				features.outdoorParkingSpaceType = "uncovered";
				if (data.parking_places_type) {
					if (data.parking_places_type.parking_places_type_id == 1) {
						features.outdoorParkingSpaceType = "covered";
					}
				}
			}
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			if (data.contract.contract_id === 2) {
				delete features.currentOccupation;
			}
			if (data.typology.typology_id === 42) {
				features['commercialMainActivity'] = 'hotel';
			}
			break;
		case 'land':
			features = {
				type: (data.typology.typology_id === 24) ? 'countrybuildable' : 'countrynonbuildable',
				areaPlot: data.surface,
				roadAccess: true,
				accessType: 'unknown',
				classificationOther: true,
			}
			if (features.type === 'countrynonbuildable') {
				delete features.classificationOther;
			}
			break;
		case 'room':
			features = {
				type: 'shared_flat',
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				areaConstructed: data.surface,
				tenantNumber: Number(data.bedrooms),
				rooms: (Number(data.rooms) + Number(data.bedrooms)),
				bathroomNumber: data.baths,
				smokingAllowed: false,
				couplesAllowed: false,
				liftAvailable: Boolean(data.elevator),
				bedType: 'single',
				minimalStay: 1,
				availableFrom: DateTime.now().toFormat('yyyy-LL'),
				occupiedNow: false,
				petsAllowed: false,
			}
			break;
		default:
			features = {
				areaConstructed: data.surface,
				balcony: (data.balconies > 0) ? true : false,
				bathroomNumber: data.baths,
				builtYear: Number(DateTime.fromSQL(data.construction_year).toFormat("yyyy")) || undefined,
				conditionedAir: (data.air_conditioning)
					? (data.air_conditioning.air_conditioning_id === 1) ? true : false
					: false,
				depositMonths: (data.contract.contract_id === 2) ? (data.rental_deposit) ? Math.round((Number(data.rental_deposit) / Number(data.price.price))) : 1 : undefined,
				conservation: translateConservationType(data.conservative_state.conservative_state_id),
				energyCertificateLaw: translateEnergyCertificateLaw(data.energy_class?.energy_class_id),
				energyCertificateRating: (data.energy_class)
					? (data.energy_class.energy_class_id !== 1) ? data.energy_class.energy_class_name : 'unknown'
					: 'unknown',
				isInTopFloor: (data.typology.typology_id === 2 || data.typology.typology_id === 3) ? true : false,
				garden: Boolean(data.garden),
				gardenType: (data.garden !== 0 ? (data?.garden_type === 'public' ? 'community' : 'private') : undefined),
				liftAvailable: Boolean(data.elevator),
				parkingAvailable: (data.box?.box_id != 3) ? true : false,
				parkingIncludedInPrice: (data.box?.box_id != 3) ? (data.price_box) ? false : true : undefined,
				parkingPrice: (data.price_box) ? Number(data.price_box.price) : undefined,
				penthouse: (data.typology.typology_id === 2 || data.typology.typology_id === 3) ? true : false,
				rooms: (Number(data.rooms) + Number(data.bedrooms)),
				storage: Boolean(data.cellar),
				terrace: (data.terrace > 0) ? true : false,
				heatingType: translateHeatingType(data.heating_type, data.heating_supply_type),
				priceCommunity: data.expense_apartment || undefined,
				currentOccupation: (data.current_state && data.contract.contract_id === 1)
					? (data.current_state.current_state_id == 1) ? 'free' : 'not_free'
					: 'free',
				parkingSpaceCapacity: (data.box)
					? (data.box === 1) ? 'single' : (data.box === 2) ? 'dobuble' : undefined
					: undefined,
				outdoorParkingSpaceAvailable: (data.parking_places) ? true : false,
				outdoorParkingSpaceNumber: data.parking_places || undefined,

			};
			if (data.property_typology?.property_typology_id === 2) {
				features.currentOccupation = "bare_ownership";
			}
			if (features.outdoorParkingSpaceAvailable) {
				features.outdoorParkingSpaceType = "uncovered";
				if (data.parking_places_type) {
					if (data.parking_places_type.parking_places_type_id == 1) {
						features.outdoorParkingSpaceType = "covered";
					}
				}
			}
			if (data.box?.box_id != 3) {
				features.parkingSpaceCapacity = (data.box?.box_id == 2) ? "double" : "single";
			}
			if (data.contract.contract_id === 2) {
				delete features.currentOccupation;
			}
			break;
	}
	return JSON.parse(JSON.stringify(features));
}

function getAdditionalLink(provider) {
	if (provider === 'H&P' || provider === 'HP') {
		return 'https://www.homepanda.it';
	}
	if (/^RLB.*/.test(provider)) {
		return 'https://www.relabitalia.com';
	}
}

export function extractAdsId(property) {
	if (property.links && property.links.length) {
		const adsLink = property.links.filter(item => {
			return (item.portal === 'IDEALISTA')
		});
		if (adsLink.length) {
			return adsLink[0].link_path.replace(/[^\d]/g, '');
		}
	}

	throw new Error(JSON.stringify({ 'error': 'Idealista id ads not found' }));
}

export function generatePayload(data) {
	try {
		const capCode = findCap(data.city.city_name);
		const payload = {
			type: translateType(data.typology.typology_id),
			address: {
				visibility: 'full',
				streetName: data.address,
				postalCode: capCode.cap.substring(1),
				country: 'Italy',
				town: data.city.city_name,
				precision: 'exact',
				latitude: data.latitude,
				longitude: data.longitude,
				floor: translateFloor(data.floor)
			},
			reference: String(data.property_id),
			contactId: getContactId(data.provider),
			features: getFeaturesByType(
				translateType(data.typology.typology_id),
				data
			),
			operation: {
				price: Number(data.price.price),
				type: (data.contract.contract_id === 1) ? 'sale' : 'rent'
			},
			descriptions: [
				{
					language: 'it',
					text: (data.description.length > 4000) ? data.description.substring(0, 4000) : data.description
				}
			],
			scope: 'idealista',
			additionalLink: getAdditionalLink(data.provider)
		}

		return payload;
	} catch (error) {
		throw new Error(JSON.stringify({ 'error': error.message }));
	}
}

export function generateImagesPayload(propertyData) {
	const images = {
		data: [],
		provider: propertyData.provider
	};
	const propertyImages = propertyData.photos;
	const propertyMedia = propertyData.media;
	if (propertyImages.length) {
		const picturesLength = (propertyImages.length < 200) ? propertyImages.length : 200;
		for (let i = 0; i < picturesLength; i++) {
			let picture = propertyImages[i];
			const isAi = picture.is_ai || false;
			images.data.push({
				label: 'unknown',
				url: (picture.photo_order === 0)
					? `https://thumb.homepanda.it/property/${propertyData.provider || 'HP'}/1024x0/${isAi ? 'ai/' : ''}main/${picture.photo_thumb}`
					: `https://thumb.homepanda.it/property/${propertyData.provider || 'HP'}/1024x0/${isAi ? 'ai/' : ''}${picture.photo_thumb}`,
				aiGenerated: isAi
			});
		}
	}
	if (propertyMedia.length) {
		for (let i = 0; i < propertyMedia.length; i++) {
			const media = propertyMedia[i];
			if (media.media_type === 'PLANIMETRY') {
				images.data.push({
					label: 'appraisalplan',
					url: `https://cdn.homepanda.it/${propertyData.property_id}/media/planimetry/${media.media_path}`
				});
			}
		}
	}

	return images;
}

export function generateVirtualTourPayload(propertyData) {
	const virtualTour = {
		data: [],
		provider: propertyData.provider
	};
	const propertyMedia = propertyData.media;
	if (propertyMedia.length) {
		for (let i = 0; i < propertyMedia.length; i++) {
			const media = propertyMedia[i];
			if (media.media_type === 'VIRTUAL_TOUR') {
				virtualTour.data.push({
					url: `https://cdn.homepanda.it/${propertyData.property_id}/media/virtual_tour/${media.media_path}`
				});
			}
		}
	}

	return virtualTour;
}

export function getContactId(provider) {
	if (provider === 'H&P') {
		provider = 'HP';
	}
	if (/^RLB.*/.test(provider)) {
		provider = 'RLB';
	}
	let contactId = process.env[`IDEALISTA_CONTACT_ID_${provider}`];
	if (!contactId) {
		throw new Error(`Contact id not found for provider ${provider}`);
	}
	return Number(contactId);
}
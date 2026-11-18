
import * as cheerio from 'cheerio';
import { parse } from 'csv-parse/sync';
import { DateTime } from "luxon";
export class Immobiliare
{
    constructor(client) {
        this.client = client;
    }
    async login(username, password) {
        try {
            const response = await this.client.post(
                'https://gestionale.immobiliare.it/login_check',
                {
                    _csrf_token : this.#getCsrfToken(), 
                    username : username, 
                    password : password,
                },
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            );
            if (/\'agencyId\'\: \'(\d+)\'/g.test(response.data)) {
                return true;
            }
            if (/Credenziali non valide/g.test(response.data)) {
                throw "Immobiliare not sign in";
            }            
            throw "Immobiliare not sign in";
        } catch (error) {
            throw error;
        }
    }

    async #getCsrfToken() {
        try {
            const response = await this.client.get('https://gestionale.immobiliare.it/signin/');
            let $ = cheerio.load(response.data, null, false);
            const csrfToken = $("input[name=_csrf_token]").val();
            $ = null;
            return csrfToken;
        } catch (error) {        
            throw error;
        }
    }

    async downloadData() {
        try {
            const date = DateTime.now().toISODate();
            let csvParsed = parse(
                await this.#downloadDataRequest(),
                {
                    columns: true,
                    skip_empty_lines: true,
                    relax_column_count_more: true,
                    delimiter: ';',
                    trim: true,
                    escape: '"'
                }
            );
            const returnData = [];	
    
            for (let i=1; i<csvParsed.length;i++) {
                let row = csvParsed[i];            
                if (row['stato immobile'] == 'Archiviato') {
                    continue;
                }
                returnData.push({
                    id: row.codice, 
                    favorite : row.salvati,
                    visit : row.visite,
                    quality: row.indice_qualita,
                    date
                });
            }

            const listings = csvParsed
                .filter(row => row['stato immobile'] != 'Archiviato')
                .map(row => ({ propertyId: row.id, adId: row.codice }));

            return { ads: returnData, listings };
        } catch (error) {
            console.error('Error downloading or parsing the ads CSV', error);
            throw error;
        }
    }

    async #downloadDataRequest()
    {
        try {            
            const response = await this.client.get('https://gestionale.immobiliare.it/v2/annunci-portale/csv');
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}
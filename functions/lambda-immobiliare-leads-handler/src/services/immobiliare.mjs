import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import { Cookie, CookieJar } from 'tough-cookie';

export default class Immobiliare {

  #client;
  #cookies = new CookieJar();
  #logged = false;
  #saleLeads = [];
  #messageLeads = [];
  #evaluationLeads = [];

  constructor(provider, cookieKey, cookieValue, username, password) {
    this._provider = provider;
    this._username = username;
    this._password = password;
    this._cookieKey = cookieKey;
    this._cookieValue = cookieValue;
    this.#client = wrapper(axios.create({
      baseURL: 'https://gestionale.immobiliare.it',
      timeout: 15000,
      withCredentials: true,
      jar: this.#cookies,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
      }
    }));
  }

  static factoryFromJson(data) {
    return new Immobiliare(
      data.provider,
      data.cookieKey,
      data.cookieValue,
      data.username,
      data.password
    );
  }

  getProvider() {
    return this._provider;
  }

  async #getCsrfToken(params) {
    let response = await this.#client.get('/signin', { responseType: 'text', jar: this.#cookies });
    const $ = cheerio.load(response.data);
    return $("input[name=_csrf_token]").val();
  }

  async login(username, password) {
    const SesCookie = new Cookie({
      key: this._cookieKey,
      value: this._cookieValue,
      domain: 'gestionale.immobiliare.it',
      httpOnly: true
    });
    this.#cookies.setCookieSync(SesCookie, 'https://gestionale.immobiliare.it');
    let response = await this.#client.post('/login_check', {
      _csrf_token: await this.#getCsrfToken(),
      username: this._username,
      password: this._password,
    },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
        },
        responseType: 'text',
        jar: this.#cookies,
      }
    );
    if (/\'agencyId\'\: \'(\d+)\'/g.test(response.data)) {
      this.#logged = true;
      return true;
    }
    if (/Credenziali non valide/g.test(response.data)) {
      throw "Immobiliare not sign in - wrong credential";
    }
    throw new Error("Immobiliare not sign in");
  }

  async logout() {
    await this.#client.get('/logout', { jar: this.#cookies });
    this.#logged = false;
  }

  async retrieveLeadEvaluation(leadInfo) {
    let page = 0;
    let leadsFind;
    do {
      page += 1;
      try {
        const response = await this.#client.get(`/fapi/inbox/leads?leadType=sellerLead&sort=-lastActivity&page=${page}&results=30`, { jar: this.#cookies });
        leadsFind = response.data.list.filter((item) => {
          return (item.customer.mail.toLowerCase() === leadInfo.email.toLowerCase());
        });
        if (leadsFind.length) {
          break;
        }
      } catch (error) {
        console.error(error);
        continue;
      }
    } while (page < 15);

    if (leadsFind.length) {
      for (let index = 0; index < leadsFind.length; index++) {
        let lead = {};
        const leadFind = leadsFind[index];
        if (leadFind.externalRef) {
          const responseDetail = await this.#client.get(`/fapi/inbox/leads/timeline/seller/${leadFind.externalRef}`, { jar: this.#cookies });
          const [latitude, longitude] = new URL(responseDetail.data.search.map.url).searchParams.get('markers').split('|').pop().split(',').map(Number);
          let fullName = leadFind.customer.name;
          lead = {
            id: leadFind.externalRef,
            user: {
              name: fullName.split(' ').slice(0, 1).join(''),
              lastname: fullName.split(' ').slice(1).join(' '),
              phone: leadFind.customer.phone,
              email: leadFind.customer.mail,
            },
            typology: responseDetail.data.search.filters.find(i => i.key === 'typology')?.content || 'Appartamento',
            rooms: responseDetail.data.search.filters.find(i => i.key === 'rooms')?.content || '1 Locale',
            baths: responseDetail.data.search.filters.find(i => i.key === 'bathrooms')?.content || 1,
            surface: responseDetail.data.search.filters.find(i => i.key === 'surface')?.content || '25 m²',
            condition: responseDetail.data.search.filters.find(i => i.key === 'state')?.content || 'Buono/Abitabile',
            floor: responseDetail.data.search.filters.find(i => i.key === 'floor')?.content || 'Piano Terra',
            elevator: 'No',
            geographyInformation: {
              latitude,
              longitude,
              city: { name: leadFind.subject.location || nseDetail.data.search.map.title },
              address: responseDetail.data.search.map.title,
              macroZone: {
                name: responseDetail.data.search.map.zones[0]
              }
            },
            notes: responseDetail.data.additionalInformation.map(i => `${i.label}: ${i.value}`)
          };
          this.#evaluationLeads.push(lead);
        }
      }
    }
  }
  async retrieveLeadSale(leadInfo) {
    let page = 0;
    let leadsFind;
    do {
      page += 1;
      try {
        const response = await this.#client.get(`/fapi/inbox/leads?leadType=appraisal&sort=-lastActivity&page=${page}&results=30`, { jar: this.#cookies });
        leadsFind = response.data.list.filter((item) => {
          return (item.customer.mail.toLowerCase() === leadInfo.email.toLowerCase());
        });
        if (leadsFind.length) {
          break;
        }
      } catch (error) {
        console.error(error);
        continue;
      }
    } while (page < 15);
    if (leadsFind.length) {
      for (let index = 0; index < leadsFind.length; index++) {
        let lead = {};
        const leadFind = leadsFind[index];
        if (leadFind.externalRef) {
          const responseDetail = await this.#client.get(`/fapi/inbox/leads/timeline/appraisal/${leadFind.externalRef}`, { jar: this.#cookies });
          const [latitude, longitude] = new URL(responseDetail.data.search.map.url).searchParams.get('markers').split('|').pop().split(',').map(Number);
          let fullName = leadFind.customer.name
          lead = {
            id: leadFind.externalRef,
            contactInformation: {
              firstname: fullName.split(' ').slice(0, 1).join(''),
              lastname: fullName.split(' ').slice(1).join(''),
              phone: leadFind.customer.phone,
              email: leadFind.customer.mail,
            },
            propertyInfo: {
              typology: responseDetail.data.search.filters.find(i => i.key === 'typology')?.content || 'Appartamento',
              rooms: responseDetail.data.search.filters.find(i => i.key === 'rooms')?.content || '1 Locale',
              baths: responseDetail.data.search.filters.find(i => i.key === 'bathrooms')?.content || 1,
              surface: responseDetail.data.search.filters.find(i => i.key === 'surface')?.content || '25 m²',
              propertyCondition: responseDetail.data.search.filters.find(i => i.key === 'state')?.content || 'Buono/Abitabile',
              floor: responseDetail.data.search.filters.find(i => i.key === 'floor')?.content || 'Piano Terra',
              elevator: responseDetail.data.search.filters.find(i => i.key === 'elevator')?.content || 'No',
            },
            geographyInformation: {
              latitude,
              longitude,
              city: { name: leadFind.subject.location || nseDetail.data.search.map.title },
              address: responseDetail.data.search.map.title,
              macroZone: {
                name: responseDetail.data.search.map.zones[0]
              }
            },
            notes: responseDetail.data.additionalInformation.map(i => `${i.label}: ${i.value}`),
            prices: responseDetail.data.prices,
          };
          this.#saleLeads.push(lead);
        }
      }
    }
  }

  async retrieveMessage(messageInfo) {
    try {
      if (!messageInfo.email) {
        console.log(`Email not found in message`);
        return null;
      }
      let page = 0;      
      do {
        page += 1;
        try {
          const response = await this.#client.get(`/fapi/inbox/leads`, {
            headers: {
              'Accept': '*/*',
              'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'content-language': 'it-IT',
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
            },
            jar: this.#cookies,
            params: {
              sort: '-lastActivity',
              leadType: 'message',
              page,
              results: 30
            }
          });
          contactFind = response.data.list.filter((item) => {
            return (item.customer.mail.toLowerCase() === messageInfo.email.toLowerCase());
          });
          if (contactFind.length) {
            for (let index = 0; index < contactFind.length; index++) {
              contactFind[index].messageQueue = messageInfo;
              messagesId.push(contactFind[index].id);
            }
            this.#messageLeads.push(...contactFind);
            break;
          }

        } catch (error) {
          console.error(error);
        }
      } while (page < 31);

      for (let i = 0; i < messagesId.length; i++) {
        const messageId = messagesId[i];
        await this.#client.patch(`/fapi/inbox/leads/status`, { leads: [{ ids: [messageId], leadType: "message" }], status: "handled" }, { jar: this.#cookies });
      }
      return contactFind;
    } catch (error) {
      console.error(error);
    }
  }

  isLogged() {
    return this.#logged;
  }

  getLeadEvaluation() {
    return this.#evaluationLeads;
  }

  getSaleLeads() {
    return this.#saleLeads;
  }

  getMessageLeads() {
    return this.#messageLeads;
  }
}
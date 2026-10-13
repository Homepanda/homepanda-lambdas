import fs from'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

function normalizeString(string) {
  return string.toLowerCase().replace(/\s/g, '');
}

export default function(city) {
  const normalizedCity = normalizeString(city);
  let result = parse(
    fs.readFileSync(
      path.resolve(process.cwd(), './helper/comuni.csv'),
      'utf-8'
    ),
    {
      delimiter: ',',
      trim: true,
      skip_empty_lines: true,
      from_line: 2,
      on_record: (record, {lines}) => {        
        if (normalizedCity.includes(normalizeString(record[0]))) {
          return {
            city : record[0],
            istat : record[1],
          };
        }
        return null
      }
    });

    if (result.length > 1) {
      result = result.filter(item => {
        return (normalizedCity === normalizeString(item.city))
      })
    }

    if (result.length) {
      return result[0];
    }

    throw new Error('No istat code found');
}
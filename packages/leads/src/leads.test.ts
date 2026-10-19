import { describe, expect, it } from 'vitest';
import { classifyName, nameScore, normaliseName, ownerIsAgent, readInbiz, tokenSetRatio, type Dictionary } from './index.ts';

const dict: Dictionary = {
  trades: { food: ['taqueria', 'pizza', 'food truck'], beauty: ['barber', 'nails'], trades: ['roofing'], auto: ['auto'], repair_retail: ['tienda', 'repair'] },
  exclusions: ['bar', 'liquor', 'loan'],
  noise: ['logistics', 'real estate', 'transport'],
  franchises: ['great clips', 'mcdonalds'],
};

describe('normaliseName', () => {
  it('drops legal suffixes, punctuation and case', () => {
    expect(normaliseName('JOE’S PIZZA & GRILL, L.L.C.')).toBe('joes pizza and grill');
    expect(normaliseName('Smith Roofing Inc')).toBe('smith roofing');
  });
});

describe('tokenSetRatio', () => {
  it('is 1 when one name holds all the words of the other', () => {
    expect(tokenSetRatio('Smith Roofing LLC', 'Smith Roofing & Gutters')).toBe(1);
  });
  it('is low for unrelated names', () => {
    expect(tokenSetRatio('Smith Roofing LLC', 'Bluebird Bakery')).toBeLessThan(0.5);
  });
  it('tolerates a small spelling difference', () => {
    expect(tokenSetRatio('Taqueria El Guero', 'Taqueria El Güero')).toBeGreaterThanOrEqual(0.8);
  });
});

describe('classifyName', () => {
  it('finds a trade word and its group, with plurals', () => {
    expect(classifyName('LA TIENDA DE MARIA LLC', dict)).toEqual({ trade: 'tienda', group: 'repair_retail', drop: null });
    expect(classifyName('Glam Nails Studio', dict).group).toBe('beauty');
    expect(classifyName('Two Barbers LLC', dict).trade).toBe('barber');
  });
  it('matches two word phrases', () => {
    expect(classifyName('Rosa Food Truck LLC', dict).trade).toBe('food truck');
  });
  it('drops excluded words as whole words only', () => {
    expect(classifyName('Corner Bar and Pizza LLC', dict).drop).toBe('excluded: bar');
    expect(classifyName('Fresh Cut Barber LLC', dict).drop).toBeNull();
  });
  it('drops noise, with longer forms of a noise word', () => {
    expect(classifyName('Fast Auto Transportation LLC', dict).drop).toBe('noise: transport');
    expect(classifyName('Hoosier Real Estate Roofing', dict).drop).toBe('noise: real estate');
  });
  it('drops franchises', () => {
    expect(classifyName("Great Clips of Fishers", dict).drop).toBe('franchise: great clips');
    expect(classifyName("McDonald's of Marion", dict).drop).toBe('franchise: mcdonalds');
  });
  it('says when there is no trade word', () => {
    expect(classifyName('Shree Hari 108 LLC', dict)).toEqual({ trade: null, group: null, drop: 'no trade word' });
  });
});

describe('ownerIsAgent', () => {
  it('is false for a formation service and true for a person', () => {
    expect(ownerIsAgent('Registered Agents Inc.')).toBe(false);
    expect(ownerIsAgent('NORTHWEST REGISTERED AGENT SERVICE, INC.')).toBe(false);
    expect(ownerIsAgent('United States Corporation Agents, Inc.')).toBe(false);
    expect(ownerIsAgent('Entity Protect Business Services')).toBe(false);
    expect(ownerIsAgent('Maria Lopez')).toBe(true);
    expect(ownerIsAgent('')).toBe(false);
  });
});

describe('nameScore', () => {
  const today = new Date('2026-10-19T12:00:00Z');
  it('adds the five signals', () => {
    expect(nameScore({ trade: 'pizza', group: 'food', ownerIsAgent: true, city: 'Marion', created: '2026-09-20' }, today)).toBe(6);
    expect(nameScore({ trade: 'auto', group: 'auto', ownerIsAgent: false, city: '', created: '2026-09-01' }, today)).toBe(2);
  });
});

describe('readInbiz', () => {
  it('reads cp1252 rows and a row with one stray field', () => {
    const header = ['Original_control_number', 'Corporation_type', 'Creation_date', 'Inactive_date', 'Expiration_date', 'Original_incorporation_date', 'Original_incorporation_state', 'Filing_act', 'Corporation_Name', 'Corporation_address_1', 'Corporation_address_2', 'Corporation_city', 'Corporation_state', 'Corporation_zip_code', 'Corporation_zip_ext', 'Agent_name', 'Agent_address_1', 'Agent_address_2', 'Agent_city_1', 'Agent_state_1', 'Agent_zip_code', 'Agent_zip_ext', 'Corporation_type_desc', 'Filing_Act_Desc'];
    const row = ['1', '7', '09/12/2026 00:00:00', '', '', '', '', '7', 'CAF\xc9 LUNA LLC', '1 MAIN ST', '', 'Muncie', 'IN', '47305', '', 'Ana Luna', '', '', '', '', '', '', 'Domestic Limited Liability Company', 'Indiana Code'];
    const odd = [...row.slice(0, 21), '1304', '', 'Domestic Limited Liability Company', 'Indiana Code'];
    odd[8] = 'ODD LLC';
    const text = [header, row, odd].map((r) => r.join('\t')).join('\r\n');
    const rows = readInbiz(Buffer.from(text, 'latin1'));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('CAFÉ LUNA LLC');
    expect(rows[0]!.created).toBe('2026-09-12');
    expect(rows[1]!.typeDesc).toBe('Domestic Limited Liability Company');
  });
});

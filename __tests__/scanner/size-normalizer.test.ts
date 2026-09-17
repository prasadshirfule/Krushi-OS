import assert from 'node:assert';
import { normalizeProductSize, isFormulationConcentration } from '../../lib/scanner/size-normalizer';

console.log('--- Testing Product Size Normalizer (Phase 1.1) ---');

// 1. Test standard agricultural pack sizes
const s1 = normalizeProductSize('60 g');
assert.deepStrictEqual(s1, { sizeValue: 60, sizeUnit: 'g', packSize: '60 g' });

const s2 = normalizeProductSize('1 KG');
assert.deepStrictEqual(s2, { sizeValue: 1, sizeUnit: 'kg', packSize: '1 kg' });

const s3 = normalizeProductSize('500 ML');
assert.deepStrictEqual(s3, { sizeValue: 500, sizeUnit: 'ml', packSize: '500 ml' });

const s4 = normalizeProductSize('20 L');
assert.deepStrictEqual(s4, { sizeValue: 20, sizeUnit: 'L', packSize: '20 L' });

const s5 = normalizeProductSize('1000 tablets');
assert.deepStrictEqual(s5, { sizeValue: 1000, sizeUnit: 'tablets', packSize: '1000 tablets' });

const s6 = normalizeProductSize('1 pack');
assert.deepStrictEqual(s6, { sizeValue: 1, sizeUnit: 'pack', packSize: '1 pack' });

const s7 = normalizeProductSize('Net Content: 60 g');
assert.deepStrictEqual(s7, { sizeValue: 60, sizeUnit: 'g', packSize: '60 g' });

console.log('✓ Test 1: Agricultural Pack Sizes Normalized Correctly');

// 2. Test formulation concentrations MUST NOT be interpreted as pack sizes
assert.strictEqual(isFormulationConcentration('5% w/w'), true);
assert.strictEqual(isFormulationConcentration('40% WG'), true);
assert.strictEqual(isFormulationConcentration('10% EC'), true);
assert.strictEqual(isFormulationConcentration('250 g/L'), true);

assert.strictEqual(normalizeProductSize('5% w/w'), null, '5% w/w must return null pack size');
assert.strictEqual(normalizeProductSize('40% WG'), null, '40% WG must return null pack size');
assert.strictEqual(normalizeProductSize('10% EC'), null, '10% EC must return null pack size');
assert.strictEqual(normalizeProductSize('250 g/L'), null, '250 g/L must return null pack size');

console.log('✓ Test 2: Formulation Concentrations Strictly Ignored from Pack Size');

console.log('All Product Size Normalizer tests passed successfully!\n');

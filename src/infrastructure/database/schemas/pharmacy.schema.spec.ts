import { Pharmacy, PharmacySchema } from './pharmacy.schema';

describe('PharmacySchema', () => {
  it('should be defined', () => {
    expect(PharmacySchema).toBeDefined();
  });

  it('should have the correct metadata for defaults', () => {
    const sourceTypePath: any = PharmacySchema.path('source_type');
    const isOnDutyPath: any = PharmacySchema.path('isOnDuty');
    const isPermanentlyOnDutyPath: any = PharmacySchema.path('isPermanentlyOnDuty');

    expect(sourceTypePath.options.default).toBe('MANUAL');
    expect(isOnDutyPath.options.default).toBe(false);
    expect(isPermanentlyOnDutyPath.options.default).toBe(false);
  });

  it('should have the TTL index configured', () => {
    const indexes = PharmacySchema.indexes();
    const ttlIndex = indexes.find(idx => idx[0].dutyUntil === 1);
    
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex![1].expireAfterSeconds).toBe(60 * 60 * 24 * 15);
  });

  it('should allow setting properties on the class', () => {
    const pharmacy = new Pharmacy();
    pharmacy.name = 'Test Pharmacy';
    pharmacy.location = { type: 'Point', coordinates: [1, 2] };
    
    expect(pharmacy.name).toBe('Test Pharmacy');
    expect(pharmacy.location.type).toBe('Point');
  });
});

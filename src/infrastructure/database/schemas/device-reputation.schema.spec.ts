import { DeviceReputation, DeviceReputationSchema } from './device-reputation.schema';

describe('DeviceReputationSchema', () => {
  it('should be defined', () => {
    expect(DeviceReputationSchema).toBeDefined();
  });

  it('should have the expected properties', () => {
    const deviceReputation = new DeviceReputation();
    deviceReputation.deviceId = 'test-device';
    deviceReputation.trustScore = 5;
    deviceReputation.associatedIps = ['127.0.0.1'];
    deviceReputation.successfulReports = 1;
    deviceReputation.failedReports = 0;

    expect(deviceReputation.deviceId).toBe('test-device');
    expect(deviceReputation.trustScore).toBe(5);
    expect(deviceReputation.associatedIps).toContain('127.0.0.1');
  });
});

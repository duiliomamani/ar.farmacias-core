export class SubmitPharmacyReportCommand {
  constructor(
    public readonly pharmacyId: string,
    public readonly lat: number,
    public readonly lng: number,
    public readonly deviceId: string,
    public readonly isOnDuty: boolean,
    public readonly imageUrl?: string,
    public readonly userId?: string,
  ) {}
}

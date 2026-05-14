export class GetPharmaciesByDateQuery {
  constructor(
    public readonly date: Date,
    public readonly city?: string,
  ) {}
}

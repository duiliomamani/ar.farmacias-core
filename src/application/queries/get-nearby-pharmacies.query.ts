export class GetNearbyPharmaciesQuery {
  constructor(
    public readonly lat: number,
    public readonly lng: number,
    public readonly radius: number,
    public readonly date?: Date,
  ) {}
}

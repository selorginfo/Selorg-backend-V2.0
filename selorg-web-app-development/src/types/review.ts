export interface Review {
  name: string;
  body: string;
  stars: number;
  ago: string;
}

export interface ReviewSummary {
  count: number;
  average: number;
  distribution: { stars: number; pct: number }[];
  reviews: Review[];
}

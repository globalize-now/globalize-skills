export type Review = {
  id: string
  author: string
  rating: number
  quote: string
}

export const reviews: Review[] = [
  { id: 'r1', author: 'Marta', rating: 5, quote: 'The best beans I have ever had delivered.' },
  { id: 'r2', author: 'Jānis', rating: 4, quote: 'Great variety, and skipping a month is easy.' },
]

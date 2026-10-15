export type Plan = {
  id: string
  name: string
  description: string
  bagsPerMonth: number
  priceEur: number
}

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'One single-origin roast, picked by our head roaster.',
    bagsPerMonth: 1,
    priceEur: 14.5,
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Two contrasting roasts so you can taste the difference.',
    bagsPerMonth: 2,
    priceEur: 26,
  },
  {
    id: 'cafe',
    name: 'Café',
    description: 'Five bags for households that never run out.',
    bagsPerMonth: 5,
    priceEur: 59.9,
  },
]

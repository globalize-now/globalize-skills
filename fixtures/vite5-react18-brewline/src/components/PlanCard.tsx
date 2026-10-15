import type { Plan } from '../data/plans'

type Props = {
  plan: Plan
  selected: boolean
  onSelect: (id: string) => void
}

export function PlanCard({ plan, selected, onSelect }: Props) {
  return (
    <article className={selected ? 'plan plan--selected' : 'plan'}>
      <h3>{plan.name}</h3>
      <p>{plan.description}</p>
      <p className="plan__bags">
        {plan.bagsPerMonth} {plan.bagsPerMonth === 1 ? 'bag' : 'bags'} per month
      </p>
      <p className="plan__price">{'€' + plan.priceEur.toFixed(2)} / month</p>
      <button
        type="button"
        title={`Choose the ${plan.name} plan`}
        aria-label={`Select ${plan.name}`}
        onClick={() => onSelect(plan.id)}
      >
        {selected ? 'Selected' : 'Choose plan'}
      </button>
    </article>
  )
}

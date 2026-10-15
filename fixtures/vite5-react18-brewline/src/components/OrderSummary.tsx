import type { Plan } from '../data/plans'

type Props = {
  plan: Plan
  nextDelivery: Date
  subscribers: number
}

export function OrderSummary({ plan, nextDelivery, subscribers }: Props) {
  const yearly = plan.priceEur * 12

  return (
    <aside className="summary">
      <h2>Your order</h2>
      <p>
        Your next delivery ships on{' '}
        <strong>{nextDelivery.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</strong>.
      </p>
      <p>That is €{yearly.toFixed(2)} per year.</p>
      <p>Join {subscribers.toLocaleString()} coffee lovers already brewing with us.</p>
      <label>
        Email
        <input type="email" placeholder="you@example.com" aria-label="Email address" />
      </label>
    </aside>
  )
}

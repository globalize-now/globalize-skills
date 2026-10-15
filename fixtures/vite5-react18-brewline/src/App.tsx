import { useState } from 'react'
import { plans } from './data/plans'
import { PlanCard } from './components/PlanCard'
import { OrderSummary } from './components/OrderSummary'
import { Reviews } from './components/Reviews'

const NEXT_DELIVERY = new Date(2026, 10, 3)

export default function App() {
  const [selectedId, setSelectedId] = useState(plans[1].id)
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0]

  return (
    <main>
      <header>
        <img src="/logo.svg" alt="Brewline logo" width={48} height={48} />
        <h1>Fresh coffee, delivered monthly</h1>
        <p>Pick a plan. Pause or cancel any time.</p>
      </header>
      <section>
        <h2>Choose your plan</h2>
        <div className="plans">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} selected={plan.id === selectedId} onSelect={setSelectedId} />
          ))}
        </div>
      </section>
      <OrderSummary plan={selected} nextDelivery={NEXT_DELIVERY} subscribers={12480} />
      <Reviews />
    </main>
  )
}

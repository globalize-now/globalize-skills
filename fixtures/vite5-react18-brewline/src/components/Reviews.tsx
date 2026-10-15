import { reviews } from '../data/reviews'

export function Reviews() {
  return (
    <section>
      <h2>What subscribers say</h2>
      <ul>
        {reviews.map((review) => (
          <li key={review.id}>
            <blockquote>{review.quote}</blockquote>
            <p>
              — {review.author}, <span title={`Rated ${review.rating} out of 5`}>{'★'.repeat(review.rating)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

import { products, categories } from '../data/products'

export function ProductList() {
  return (
    <section>
      <h2>Featured products</h2>
      <ul>
        {categories.map((c) => (
          <li key={c.id}>{c.label}</li>
        ))}
      </ul>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <button>Add to cart</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

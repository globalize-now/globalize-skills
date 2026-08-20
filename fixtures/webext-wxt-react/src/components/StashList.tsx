interface Stash {
  id: string
  name: string
  tabCount: number
}

export function StashList({ stashes }: { stashes: Stash[] }) {
  return (
    <ul aria-label="Saved stashes">
      {stashes.map((stash) => (
        <li key={stash.id}>
          <span>{stash.name}</span>
          <span>{stash.tabCount} tabs</span>
          <button title="Reopen every tab in this stash">Restore</button>
          <button aria-label="Delete this stash">Delete</button>
        </li>
      ))}
    </ul>
  )
}

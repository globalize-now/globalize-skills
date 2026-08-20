import { useEffect, useState } from 'react'
import { StashList } from '@/components/StashList'

interface Stash {
  id: string
  name: string
  tabCount: number
}

export default function App() {
  const [stashes, setStashes] = useState<Stash[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    chrome.storage.local.get('stashes').then((r) => setStashes(r.stashes ?? []))
  }, [])

  async function stashCurrentWindow() {
    setBusy(true)
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const next: Stash = {
      id: crypto.randomUUID(),
      name: 'Untitled stash',
      tabCount: tabs.length,
    }
    const updated = [next, ...stashes]
    await chrome.storage.local.set({ stashes: updated })
    setStashes(updated)
    setBusy(false)
  }

  return (
    <main className="popup">
      <header>
        <h1>Tab Stasher</h1>
        <p>Save the tabs you are done with, reopen them when you need them.</p>
      </header>

      <button onClick={stashCurrentWindow} disabled={busy} title="Stash every tab in this window">
        {busy ? 'Stashing…' : 'Stash this window'}
      </button>

      {stashes.length === 0 ? (
        <p className="empty">Nothing stashed yet</p>
      ) : (
        <StashList stashes={stashes} />
      )}

      <footer>
        <a href="/options.html">Open settings</a>
      </footer>
    </main>
  )
}

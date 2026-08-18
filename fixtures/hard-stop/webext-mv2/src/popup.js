document.getElementById('auto').addEventListener('change', function (e) {
  chrome.storage.sync.set({ auto: e.target.checked })
})

chrome.storage.sync.get('auto', function (r) {
  document.getElementById('auto').checked = Boolean(r.auto)
})

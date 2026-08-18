chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'clean-link',
    title: 'Copy clean link',
    contexts: ['link'],
  })
})

chrome.contextMenus.onClicked.addListener(function (info) {
  if (info.menuItemId !== 'clean-link') return
  var url = new URL(info.linkUrl)
  ;['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(function (p) {
    url.searchParams.delete(p)
  })
  chrome.storage.local.set({ lastCleaned: url.toString() })
})

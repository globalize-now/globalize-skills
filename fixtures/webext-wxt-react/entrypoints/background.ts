export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason !== 'install') return

    chrome.contextMenus.create({
      id: 'stash-this-tab',
      title: 'Stash this tab',
      contexts: ['page'],
    })

    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon/48.png',
      title: 'Tab Stasher is ready',
      message: 'Click the toolbar icon to stash the tabs in this window.',
    })
  })

  chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId !== 'stash-this-tab') return
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icon/48.png',
      title: 'Tab stashed',
      message: 'You can reopen it from the popup.',
    })
  })
})

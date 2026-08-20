import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    manifest_version: 3,
    name: 'Tab Stasher',
    description: 'Save and reopen groups of browser tabs',
    permissions: ['storage', 'tabs'],
    action: {
      default_title: 'Stash the current window',
    },
  },
})

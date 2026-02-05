/**
 * Providers that do not support the StackOne file picker (e.g. Google Docs, Google Sheets).
 * For these, we show a message instead of the Add Files button on agent setup/edit.
 */
const PROVIDERS_WITHOUT_FILE_PICKER = ['googledocs', 'googlesheets']

export function supportsFilePicker(provider: string): boolean {
  if (!provider) return false
  return !PROVIDERS_WITHOUT_FILE_PICKER.includes(provider.trim().toLowerCase())
}

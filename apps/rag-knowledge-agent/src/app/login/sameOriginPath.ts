const PLACEHOLDER_ORIGIN = 'http://same-origin.invalid'

// Browsers read a leading "//" or "/\" as another host, also once dot segments resolve ("/.//x").
const PROTOCOL_RELATIVE = /^\/[/\\]/

export const sameOriginPath = (value: string | null): string | null => {
  if (!value || !value.startsWith('/') || PROTOCOL_RELATIVE.test(value)) return null
  if (!URL.canParse(value, PLACEHOLDER_ORIGIN)) return null
  const url = new URL(value, PLACEHOLDER_ORIGIN)
  if (url.origin !== PLACEHOLDER_ORIGIN || PROTOCOL_RELATIVE.test(url.pathname)) return null
  return url.pathname + url.search + url.hash
}

/** Names and categories. */
export const catOf = (x: { cat?: string }) => x.cat ?? 'Other'

// item names and image file names are matched ignoring case, extension and punctuation
export const nkey = (s: string) => s.toLowerCase().replace(/\.(png|jpe?g|webp|gif|bmp|avif)$/i, '').replace(/[^a-z0-9]+/g, ' ').trim()

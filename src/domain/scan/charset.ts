// Jeu de caractères d'une réponse : celui de Content-Type, sinon la balise <meta> du début
// d'un document HTML, sinon UTF-8. Le corps n'est jamais décodé en UTF-8 par défaut s'il
// déclare autre chose.
export function declaredCharset(contentTypeHeader: string, head: string) {
  const header = /;\s*charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentTypeHeader)
  if (header) return header[1].toLowerCase()
  const meta =
    /<meta\b[^>]*?\bcharset\s*=\s*["']?([\w.:-]+)/i.exec(head) ??
    /<\?xml\b[^>]*?\bencoding\s*=\s*["']([\w.:-]+)/i.exec(head)
  return meta ? meta[1].toLowerCase() : "utf-8"
}

// null : jeu de caractères inconnu, la réponse est refusée plutôt que mal décodée.
export function decodeBody(bytes: Uint8Array, charset: string): string | null {
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return null
  }
}

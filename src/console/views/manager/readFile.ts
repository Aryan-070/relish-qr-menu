/**
 * Read a File into a base64 data URL via the FileReader API.
 *
 * Used by the menu item form to let staff upload a photo or short video and
 * persist it inline (UI-only demo — no upload server). Rejects when the file
 * exceeds `maxBytes` or the reader fails, so callers can surface a hint.
 *
 * @param file     The user-selected file.
 * @param maxBytes Maximum allowed size in bytes (default 2 MB).
 * @returns A promise resolving to a `data:` URL string.
 */
export function fileToDataUrl(file: File, maxBytes: number = 2_000_000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error('File too large'))
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const { result } = reader
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('Could not read file'))
      }
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Could not read file'))
    }

    reader.readAsDataURL(file)
  })
}

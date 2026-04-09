import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

export async function uploadRecipeFile(restaurantId, recipeId, file, type, onProgress) {
  const folder = type === 'video' ? 'videos' : 'photos'
  const ext = type === 'video' ? file.name.split('.').pop() : 'webp'
  const fileName = `${Date.now()}.${ext}`
  const path = `restaurants/${restaurantId}/recipes/${recipeId}/${folder}/${fileName}`

  const storageRef = ref(storage, path)

  const metadata = {
    contentType: file.type || 'image/webp',
    cacheControl: 'public, max-age=31536000',
  }

  const task = uploadBytesResumable(storageRef, file, metadata)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      task.cancel()
      reject(new Error('Timeout al subir archivo'))
    }, 120000)

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        if (onProgress) onProgress(pct)
      },
      (err) => {
        clearTimeout(timeout)
        reject(err)
      },
      async () => {
        clearTimeout(timeout)
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })
}

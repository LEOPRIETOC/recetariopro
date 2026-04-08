import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

export function uploadRecipeFile(restaurantId, recipeId, file, type, onProgress) {
  const folder = type === 'video' ? 'videos' : 'photos'
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const path = `restaurants/${restaurantId}/recipes/${recipeId}/${folder}/${safeName}`

  console.log('Iniciando upload a path:', path)
  console.log('Storage bucket:', storage.app.options.storageBucket)

  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file)

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      task.cancel()
      reject(new Error('Upload timeout: verificar reglas de Storage y bucket'))
    }, 30000)

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        console.log('Upload progress:', pct + '%')
        if (onProgress) onProgress(pct)
      },
      (err) => {
        clearTimeout(timeout)
        console.error('Upload error:', err.code, err.message)
        reject(err)
      },
      async () => {
        clearTimeout(timeout)
        try {
          const url = await getDownloadURL(task.snapshot.ref)
          console.log('Upload completado. URL:', url)
          resolve(url)
        } catch (err) {
          console.error('Error obteniendo URL:', err)
          reject(err)
        }
      }
    )
  })
}

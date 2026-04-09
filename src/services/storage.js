import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

export async function uploadRecipeFile(restaurantId, recipeId, file, type, onProgress) {
  const folder = type === 'video' ? 'videos' : 'photos'
  const ext = type === 'video' ? file.name.split('.').pop() : 'webp'
  const fileName = `${Date.now()}.${ext}`
  const path = `restaurants/${restaurantId}/recipes/${recipeId}/${folder}/${fileName}`

  console.log('Iniciando upload:', path)
  console.log('Bucket:', storage.app.options.storageBucket)
  console.log('File size:', file.size)

  try {
    const storageRef = ref(storage, path)

    const metadata = {
      contentType: file.type || 'image/webp',
      cacheControl: 'public, max-age=31536000',
    }

    if (onProgress) onProgress(10)

    const snapshot = await uploadBytes(storageRef, file, metadata)

    if (onProgress) onProgress(90)

    const url = await getDownloadURL(snapshot.ref)

    if (onProgress) onProgress(100)

    console.log('Upload exitoso:', url)
    return url

  } catch (err) {
    console.error('Error detallado:', {
      code: err.code,
      message: err.message,
      serverResponse: err.serverResponse,
    })
    throw err
  }
}

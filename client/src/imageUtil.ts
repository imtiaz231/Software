/* Shrinks big phone photos before uploading (faster on mobile data, less disk space).
   A 6 MB camera photo becomes roughly 300-600 KB and stays easy to read. Small JPEGs are left untouched. */
export async function prepareImage(file: File, maxSide = 1800, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/jpeg' && file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);                 // respects the photo's rotation
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }                                       // unknown format: let the server decide
}

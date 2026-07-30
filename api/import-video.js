const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function resolveDownloadUrl(url) {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) {
    return { downloadUrl: `https://drive.google.com/uc?export=download&id=${driveMatch[1]}&confirm=t` }
  }

  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/)
  if (driveOpenMatch) {
    return { downloadUrl: `https://drive.google.com/uc?export=download&id=${driveOpenMatch[1]}&confirm=t` }
  }

  if (url.includes('dropbox.com')) {
    return { downloadUrl: url.replace('?dl=0', '?dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com') }
  }

  if (url.includes('1drv.ms') || url.includes('onedrive.live.com') || url.includes('sharepoint.com')) {
    const u = new URL(url)
    u.searchParams.set('download', '1')
    return { downloadUrl: u.toString() }
  }

  return { downloadUrl: url }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, fileName, warehouse, brand, userId } = req.body

  if (!url || !fileName) return res.status(400).json({ error: 'url and fileName are required' })

  try {
    const { downloadUrl } = resolveDownloadUrl(url)

    const videoRes = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': 'download_warning=t',
      },
      redirect: 'follow',
    })

    if (!videoRes.ok) throw new Error(`Không thể tải video: HTTP ${videoRes.status}`)

    const contentType = videoRes.headers.get('content-type') ?? 'video/mp4'
    if (contentType.includes('text/html')) {
      throw new Error('URL không cho phép tải trực tiếp. Với Google Drive, hãy đổi quyền chia sẻ thành "Anyone with the link".')
    }

    const videoBuffer = await videoRes.arrayBuffer()
    if (videoBuffer.byteLength === 0) throw new Error('File tải về rỗng — kiểm tra quyền truy cập URL.')

    const storagePath = `${crypto.randomUUID()}/${fileName}`
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/videos/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': contentType.includes('video') ? contentType : 'video/mp4',
          'x-upsert': 'false',
        },
        body: videoBuffer,
      }
    )
    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}))
      throw new Error(err.message ?? `Storage upload failed: ${uploadRes.status}`)
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/videos/${storagePath}`

    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        name: fileName,
        warehouse,
        brand,
        file_path: publicUrl,
        file_size: videoBuffer.byteLength,
        status: 'pending',
        uploaded_by: userId || null,
      }),
    })
    if (!dbRes.ok) {
      const err = await dbRes.json().catch(() => ({}))
      throw new Error(err.message ?? 'DB insert failed')
    }
    const [video] = await dbRes.json()

    res.status(200).json({ id: video.id, name: video.name, file_path: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    res.status(500).json({ error: message })
  }
}

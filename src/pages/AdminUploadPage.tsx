import { useCallback, useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'
import { useAdminSession } from '../hooks/useAdminSession'
import type { Category } from '../types'

export default function AdminUploadPage() {
  const { isAdmin, isLoaded, loadingProfile, setStatus, status, supabase, userId } = useAdminSession()
  const [busy, setBusy] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadPremium, setUploadPremium] = useState(true)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])

  const loadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug')
      .order('name', { ascending: true })

    if (error) {
      setStatus(error.message)
      return
    }

    setCategories(data || [])
  }, [setStatus, supabase])

  useEffect(() => {
    if (!isLoaded || loadingProfile || !isAdmin) {
      return
    }

    void loadCategories()
  }, [isAdmin, isLoaded, loadCategories, loadingProfile])

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!isAdmin || !userId || !uploadFiles.length || !uploadCategory) {
      return
    }

    setBusy(true)
    setStatus(null)

    for (const [index, uploadFile] of uploadFiles.entries()) {
      const filePath = `${userId}/${Date.now()}-${index}-${uploadFile.name}`
      const { error: uploadError } = await supabase.storage
        .from('premium-content')
        .upload(filePath, uploadFile)

      if (uploadError) {
        setStatus(uploadError.message)
        setBusy(false)
        return
      }

      const title = uploadFiles.length === 1 ? uploadTitle : `${uploadTitle} ${index + 1}`

      const { error: insertError } = await supabase.from('content_items').insert({
        title,
        description: uploadDescription || null,
        type: uploadType,
        category_id: uploadCategory,
        file_path: filePath,
        file_url: filePath,
        is_premium: uploadPremium,
        created_by: userId,
      })

      if (insertError) {
        setStatus(insertError.message)
        setBusy(false)
        return
      }
    }

    setUploadTitle('')
    setUploadDescription('')
    setUploadFiles([])
    setUploadCategory('')
    setStatus(uploadFiles.length === 1 ? 'Content uploaded.' : `${uploadFiles.length} files uploaded.`)
    setBusy(false)
  }

  if (!isLoaded || loadingProfile) {
    return (
      <AdminShell title="Admin Upload" description="Loading upload tools..." status={status}>
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-300">
          Preparing upload tools...
        </div>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return (
      <AdminShell title="Admin Upload" description="This area is only available to admins." status={status}>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-100">
          You do not have permission to upload content here.
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title="Admin Upload"
      description="Upload new content from a dedicated admin page instead of keeping the upload form inside the dashboard."
      status={status}
    >
      <div className="rounded-2xl border-2 border-gray-700 bg-gray-800 p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-white">Upload Content</h2>
            <p className="text-sm text-gray-300">Images and videos are uploaded here in the separate admin area.</p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <input
            type="text"
            placeholder="Content title"
            value={uploadTitle}
            onChange={(event) => setUploadTitle(event.target.value)}
            required
            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <textarea
            placeholder="Description (optional)"
            value={uploadDescription}
            onChange={(event) => setUploadDescription(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <select
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value as 'image' | 'video')}
              className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>

            <select
              value={uploadCategory}
              onChange={(event) => setUploadCategory(event.target.value)}
              required
              className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={uploadPremium}
              onChange={(event) => setUploadPremium(event.target.checked)}
              className="h-5 w-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium text-gray-300">Mark as premium content</span>
          </label>

          <div className="rounded-lg border-2 border-dashed border-gray-600 p-6 text-center transition-colors hover:border-gray-500">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
              required
              className="block w-full cursor-pointer text-sm text-gray-400 file:mr-4 file:rounded-full file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-purple-700"
            />
            {uploadFiles.length > 0 && (
              <p className="mt-2 text-sm text-gray-300">
                Selected {uploadFiles.length} file{uploadFiles.length === 1 ? '' : 's'}: {uploadFiles.map((file) => file.name).join(', ')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full cursor-pointer rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Uploading...' : 'Upload Content'}
          </button>
        </form>
      </div>
    </AdminShell>
  )
}
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFiles, getPendingRequests, approveRequest, rejectRequest, getAllFiles, accessFile, deleteFile, createFolder, getFolders } from '../api'
import { useAuth } from '../AuthContext'

export default function AdminDashboard() {
    const [files, setFiles] = useState([])
    const [uploadMode, setUploadMode] = useState('files') // 'files' | 'folder'
    const [folderFiles, setFolderFiles] = useState([])
    const [requests, setRequests] = useState([])
    const [allFiles, setAllFiles] = useState([])
    const [folders, setFolders] = useState([])
    const [selectedFolderId, setSelectedFolderId] = useState('')
    const [newFolderName, setNewFolderName] = useState('')
    const [uploadResult, setUploadResult] = useState(null)
    const [duration, setDuration] = useState(86400000)
    const [msg, setMsg] = useState('')
    const [loading, setLoading] = useState(false)
    const [previewFile, setPreviewFile] = useState(null)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)
    const [activeFolder, setActiveFolder] = useState(null)
    const { logout, role } = useAuth()
    const navigate = useNavigate()

    const fetchRequests = async () => {
        const data = await getPendingRequests()
        setRequests(data.requests || [])
    }

    const fetchAllFiles = async (p = 1) => {
        const data = await getAllFiles(p, 20)
        setAllFiles(data.files || [])
        setPagination(data.pagination || null)
    }

    const fetchFolders = async () => {
        const data = await getFolders()
        setFolders(data.folders || [])
    }

    useEffect(() => {
        if (!role || role !== 'admin') { navigate('/'); return }
        fetchRequests()
        fetchAllFiles(1)
        fetchFolders()
    }, [role])

    const handlePageChange = (newPage) => {
        setPage(newPage)
        fetchAllFiles(newPage)
    }

    const handleUpload = async (e) => {
        e.preventDefault()
        const selectedFiles = uploadMode === 'folder' ? folderFiles : files
        if (selectedFiles.length === 0) return setMsg('Select at least one file')
        setLoading(true)
        setMsg('')
        const formData = new FormData()
        Array.from(selectedFiles).forEach(f => formData.append('files', f))
        // For folder upload, send relative paths so backend can auto-create folders
        if (uploadMode === 'folder') {
            const paths = Array.from(selectedFiles).map(f => f.webkitRelativePath)
            formData.append('relative_paths', JSON.stringify(paths))
        } else {
            if (selectedFolderId) formData.append('folder_id', selectedFolderId)
        }
        const data = await uploadFiles(formData)
        setLoading(false)
        setUploadResult(data.files || [])
        setMsg('Upload complete')
        fetchAllFiles(page)
        fetchFolders()
    }

    const handleCreateFolder = async (e) => {
        e.preventDefault()
        if (!newFolderName.trim()) return setMsg('Enter a folder name')
        const data = await createFolder(newFolderName.trim())
        if (data.error) return setMsg(data.error)
        setMsg(`Folder "${data.folder.folder_name}" created`)
        setNewFolderName('')
        fetchFolders()
    }

    const handleDelete = async (file_id, file_name) => {
        if (!window.confirm(`Delete "${file_name}"? This cannot be undone.`)) return
        const data = await deleteFile(file_id)
        setMsg(data.message || data.error)
        fetchAllFiles(page)
    }

    const handleApprove = async (request_id) => {
        const data = await approveRequest(request_id, Number(duration))
        setMsg(data.message || data.error)
        fetchRequests()
    }

    const handleReject = async (request_id) => {
        const data = await rejectRequest(request_id)
        setMsg(data.message || data.error)
        fetchRequests()
    }

    const handlePreview = async (file_id) => {
        const data = await accessFile(file_id)
        if (data.error) return setMsg(data.error)
        setPreviewFile(data.file)
        setMsg('')
    }

    const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
    const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url)

    const getFileIcon = (name) => {
        const ext = name.split('.').pop().toLowerCase()
        if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️'
        if (['mp4','webm','ogg'].includes(ext)) return '🎬'
        if (['mp3','wav'].includes(ext)) return '🎵'
        if (['pdf'].includes(ext)) return '📕'
        if (['doc','docx'].includes(ext)) return '📝'
        if (['xls','xlsx'].includes(ext)) return '📊'
        if (['ppt','pptx'].includes(ext)) return '📋'
        if (['zip'].includes(ext)) return '🗜️'
        if (['csv','txt'].includes(ext)) return '📄'
        return '📎'
    }

    const grouped = allFiles.reduce((acc, f) => {
        const key = f.folders?.folder_name || 'No Folder'
        if (!acc[key]) acc[key] = []
        acc[key].push(f)
        return acc
    }, {})

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h2>Admin Dashboard</h2>
                <button className="logout-btn" onClick={() => { logout(); navigate('/') }}>Logout</button>
            </div>

            {msg && <p className="msg">{msg}</p>}

            {/* Create Folder */}
            <div className="card">
                <h3>Create Folder</h3>
                <form onSubmit={handleCreateFolder}>
                    <input
                        type="text"
                        placeholder="Folder name e.g. Project Docs"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                    />
                    <button type="submit">Create Folder</button>
                </form>
                {folders.length > 0 && (
                    <div className="folder-list">
                        {folders.map(f => (
                            <span key={f.id} className="folder-tag">📁 {f.folder_name}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Upload Files */}
            <div className="card">
                <h3>Upload Files</h3>
                <div className="upload-tabs">
                    <button
                        className={`tab-btn ${uploadMode === 'files' ? 'active' : ''}`}
                        onClick={() => setUploadMode('files')}
                        type="button"
                    >📄 Files</button>
                    <button
                        className={`tab-btn ${uploadMode === 'folder' ? 'active' : ''}`}
                        onClick={() => setUploadMode('folder')}
                        type="button"
                    >📁 Folder</button>
                </div>
                <form onSubmit={handleUpload}>
                    {uploadMode === 'files' ? (
                        <>
                            <input type="file" multiple onChange={e => setFiles(e.target.files)} />
                            <select value={selectedFolderId} onChange={e => setSelectedFolderId(e.target.value)}>
                                <option value="">No Folder</option>
                                {folders.map(f => (
                                    <option key={f.id} value={f.id}>{f.folder_name}</option>
                                ))}
                            </select>
                        </>
                    ) : (
                        <>
                            <input
                                type="file"
                                webkitdirectory=""
                                directory=""
                                multiple
                                onChange={e => setFolderFiles(e.target.files)}
                            />
                            {folderFiles.length > 0 && (
                                <p className="folder-upload-info">
                                    📁 {folderFiles[0]?.webkitRelativePath.split('/')[0]} &mdash; {folderFiles.length} file(s) selected
                                </p>
                            )}
                        </>
                    )}
                    <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</button>
                </form>
                {uploadResult && (
                    <div className="upload-results">
                        {uploadResult.map((f, i) => (
                            <div key={i} className={`result-item ${f.error ? 'error-item' : 'success-item'}`}>
                                <span>{f.file_name}</span>
                                {f.error ? <span className="error"> ✗ {f.error}</span> : <span className="success"> ✓ Uploaded</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* All Files Browser */}
            <div className="card">
                <div className="card-header">
                    <h3>All Files {pagination && <span className="pagination-info">({pagination.total} total)</span>}</h3>
                    <div className="file-browser-controls">
                        <button className="refresh-btn" onClick={() => fetchAllFiles(page)}>↻ Refresh</button>
                    </div>
                </div>
                {allFiles.length === 0 ? (
                    <p className="empty">No files uploaded yet</p>
                ) : (
                    <div className="file-browser">
                        {/* Folder Sidebar */}
                        <div className="folder-sidebar">
                            <p className="sidebar-title">Folders</p>
                            <div
                                className={`sidebar-folder ${!activeFolder ? 'active' : ''}`}
                                onClick={() => setActiveFolder(null)}
                            >🗂 All Files</div>
                            {Object.keys(grouped).map(folder => (
                                <div
                                    key={folder}
                                    className={`sidebar-folder ${activeFolder === folder ? 'active' : ''}`}
                                    onClick={() => setActiveFolder(folder)}
                                >📁 {folder}</div>
                            ))}
                        </div>

                        {/* File List */}
                        <div className="file-browser-main">
                            <div className="file-list-header">
                                <span>Name</span>
                                <span>Actions</span>
                            </div>
                            {(activeFolder ? grouped[activeFolder] || [] : allFiles).map(f => (
                                <div key={f.id} className="file-row">
                                    <div className="file-row-name">
                                        <span className="file-type-icon">{getFileIcon(f.file_name)}</span>
                                        <div>
                                            <p className="file-row-title">{f.file_name}</p>
                                            <p className="file-row-folder">📁 {f.folders?.folder_name || 'No Folder'}</p>
                                        </div>
                                    </div>
                                    <div className="file-row-actions">
                                        <button className="icon-btn view" onClick={() => handlePreview(f.id)} title="Preview">👁</button>
                                        <a href={f.file_url} target="_blank" rel="noreferrer" className="icon-btn download" title="Download">⬇</a>
                                        <button className="icon-btn delete" onClick={() => handleDelete(f.id, f.file_name)} title="Delete">🗑</button>
                                    </div>
                                </div>
                            ))}

                            {pagination && pagination.totalPages > 1 && (
                                <div className="pagination">
                                    <button className="page-btn" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>← Prev</button>
                                    <span className="page-info">Page {page} of {pagination.totalPages}</span>
                                    <button className="page-btn" disabled={page === pagination.totalPages} onClick={() => handlePageChange(page + 1)}>Next →</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* File Preview */}
            {previewFile && (
                <div className="card">
                    <div className="card-header">
                        <h3>Preview: {previewFile.file_name}</h3>
                        <button className="refresh-btn" onClick={() => setPreviewFile(null)}>Close</button>
                    </div>
                    <div className="preview">
                        {isImage(previewFile.file_url) && <img src={previewFile.file_url} alt={previewFile.file_name} />}
                        {isVideo(previewFile.file_url) && <video controls src={previewFile.file_url} />}
                        {!isImage(previewFile.file_url) && !isVideo(previewFile.file_url) && (
                            <div className="file-link">
                                <p>Preview not available.</p>
                                <a href={previewFile.file_url} target="_blank" rel="noreferrer">Open File</a>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pending Requests */}
            <div className="card">
                <div className="card-header">
                    <h3>Pending Access Requests</h3>
                    <button className="refresh-btn" onClick={fetchRequests}>Refresh</button>
                </div>
                <div className="duration-select">
                    <label>Access Duration:</label>
                    <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
                        <option value={3600000}>1 Hour</option>
                        <option value={86400000}>1 Day</option>
                        <option value={604800000}>1 Week</option>
                    </select>
                </div>
                {requests.length === 0 ? (
                    <p className="empty">No pending requests</p>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>File</th>
                                <th>Requested At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(r => (
                                <tr key={r.id}>
                                    <td>{r.users?.email}</td>
                                    <td>{r.files?.file_name}</td>
                                    <td>{new Date(r.requested_at).toLocaleString()}</td>
                                    <td>
                                        <button className="approve-btn" onClick={() => handleApprove(r.id)}>Approve</button>
                                        <button className="reject-btn" onClick={() => handleReject(r.id)}>Reject</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

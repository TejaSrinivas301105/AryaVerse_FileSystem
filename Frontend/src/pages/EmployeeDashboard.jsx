import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestAccess, getMyFiles, accessFile, getAllFiles, uploadFiles, getFolders, createFolder } from '../api'
import { useAuth } from '../AuthContext'

export default function EmployeeDashboard() {
    const [fileId, setFileId] = useState('')
    const [myFiles, setMyFiles] = useState([])
    const [allFiles, setAllFiles] = useState([])
    const [msg, setMsg] = useState('')
    const [accessedFile, setAccessedFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)
    const [activeFolder, setActiveFolder] = useState(null)
    const [uploadFiles_, setUploadFiles_] = useState([])
    const [uploadFolderId, setUploadFolderId] = useState('')
    const [folders, setFolders] = useState([])
    const [uploading, setUploading] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [creatingFolder, setCreatingFolder] = useState(false)
    const { logout, role } = useAuth()
    const navigate = useNavigate()

    const fetchFolders = async () => {
        const data = await getFolders()
        setFolders(data.folders || [])
    }

    const fetchMyFiles = async () => {
        const data = await getMyFiles()
        setMyFiles(data.files || [])
    }

    const fetchAllFiles = async (p = 1) => {
        const data = await getAllFiles(p, 20)
        setAllFiles(data.files || [])
        setPagination(data.pagination || null)
    }

    const refreshAll = async () => {
        await Promise.all([fetchMyFiles(), fetchAllFiles(page), fetchFolders()])
    }

    useEffect(() => {
        if (!role || role !== 'employee') {
            navigate('/')
            return
        }
        refreshAll()
    }, [role])

    const handlePageChange = (newPage) => {
        setPage(newPage)
        fetchAllFiles(newPage)
    }

    const handleRequestAccess = async (e) => {
        e.preventDefault()
        if (!fileId.trim()) return setMsg('Enter a file ID')
        setLoading(true)
        setMsg('')
        const data = await requestAccess(fileId.trim())
        setLoading(false)
        setMsg(data.message || data.error)
        setFileId('')
    }

    const handleAccessFile = async (file_id) => {
        const data = await accessFile(file_id)
        if (data.error) return setMsg(data.error)
        setAccessedFile(data.file)
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

    // Build a set of accessible file IDs for quick lookup
    const accessibleIds = new Set(myFiles.map(item => item.files?.id))

    // Group all files by folder
    const grouped = allFiles.reduce((acc, f) => {
        const key = f.folders?.folder_name || 'No Folder'
        if (!acc[key]) acc[key] = []
        acc[key].push(f)
        return acc
    }, {})

    const handleUpload = async (e) => {
        e.preventDefault()
        if (!uploadFiles_ || uploadFiles_.length === 0) return setMsg('Select at least one file')
        setUploading(true)
        setMsg('')
        const formData = new FormData()
        Array.from(uploadFiles_).forEach(f => formData.append('files', f))
        if (uploadFolderId) formData.append('folder_id', uploadFolderId)
        const data = await uploadFiles(formData)
        setUploading(false)
        setMsg(data.message || data.error)
        setUploadFiles_([])
        setUploadFolderId('')
        e.target.reset()
        await refreshAll()
    }

    const handleCreateFolder = async (e) => {
        e.preventDefault()
        if (!newFolderName.trim()) return setMsg('Enter a folder name')
        setCreatingFolder(true)
        setMsg('')
        const data = await createFolder(newFolderName.trim())
        setCreatingFolder(false)
        setMsg(data.message || data.error)
        setNewFolderName('')
        await fetchFolders()
    }

    const handleLockedClick = (file_id) => {
        setFileId(file_id)
        setMsg(`File ID copied to request form. Click "Request Access" to submit.`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h2>Employee Dashboard</h2>
                <button className="logout-btn" onClick={() => { logout(); navigate('/') }}>Logout</button>
            </div>

            {msg && <p className="msg">{msg}</p>}

            {/* Create Folder Section */}
            <div className="card">
                <h3>Create Folder</h3>
                <form onSubmit={handleCreateFolder}>
                    <input
                        type="text"
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                    />
                    <button type="submit" disabled={creatingFolder}>{creatingFolder ? 'Creating...' : 'Create Folder'}</button>
                </form>
            </div>

            {/* Upload Section */}
            <div className="card">
                <h3>Upload Files</h3>
                <form onSubmit={handleUpload}>
                    <input
                        type="file"
                        multiple
                        onChange={e => setUploadFiles_(e.target.files)}
                    />
                    <select value={uploadFolderId} onChange={e => setUploadFolderId(e.target.value)}>
                        <option value="">No Folder</option>
                        {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.folder_name}</option>
                        ))}
                    </select>
                    <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
                </form>
            </div>

            {/* Request Access Section */}
            <div className="card">
                <h3>Request File Access</h3>
                <form onSubmit={handleRequestAccess}>
                    <input
                        type="text"
                        placeholder="Enter File ID"
                        value={fileId}
                        onChange={e => setFileId(e.target.value)}
                    />
                    <button type="submit" disabled={loading}>{loading ? 'Requesting...' : 'Request Access'}</button>
                </form>
            </div>

            {/* All Files Browser */}
            <div className="card">
                <div className="card-header">
                    <h3>All Files {pagination && <span className="pagination-info">({pagination.total} total)</span>}</h3>
                    <button className="refresh-btn" onClick={refreshAll}>↻ Refresh</button>
                </div>
                {allFiles.length === 0 ? (
                    <p className="empty">No files available</p>
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
                            {(activeFolder ? grouped[activeFolder] || [] : allFiles).map(f => {
                                const status = f.access_status // 'owner','granted','pending','rejected','none'
                                const hasAccess = status === 'owner' || status === 'granted'
                                return (
                                    <div key={f.id} className={`file-row ${hasAccess ? '' : 'locked'}`}>
                                        <div className="file-row-name">
                                            <span className="file-type-icon">{getFileIcon(f.file_name)}</span>
                                            <div>
                                                <p className="file-row-title">
                                                    {hasAccess ? '🔓' : '🔒'} {f.file_name}
                                                    {status === 'owner' && <span style={{fontSize:'11px',marginLeft:'6px',color:'#888'}}>(you uploaded)</span>}
                                                </p>
                                                <p className="file-row-folder">📁 {f.folders?.folder_name || 'No Folder'}</p>
                                            </div>
                                        </div>
                                        <div className="file-row-actions">
                                            {hasAccess ? (
                                                <>
                                                    <button className="icon-btn view" onClick={() => handleAccessFile(f.id)} title="Preview">👁</button>
                                                </>
                                            ) : status === 'pending' ? (
                                                <span className="icon-btn" style={{opacity:0.6}}>⏳ Pending</span>
                                            ) : (
                                                <button className="icon-btn request" onClick={() => handleLockedClick(f.id)} title="Request Access">🔑 Request</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

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

            {/* File Preview Section */}
            {accessedFile && (
                <div className="card">
                    <div className="card-header">
                        <h3>File Preview: {accessedFile.file_name}</h3>
                        <button className="refresh-btn" onClick={() => setAccessedFile(null)}>Close</button>
                    </div>
                    <div className="preview">
                        {isImage(accessedFile.file_url) && (
                            <img src={accessedFile.file_url} alt={accessedFile.file_name} />
                        )}
                        {isVideo(accessedFile.file_url) && (
                            <video controls src={accessedFile.file_url} />
                        )}
                        {!isImage(accessedFile.file_url) && !isVideo(accessedFile.file_url) && (
                            <div className="file-link">
                                <p>Preview not available for this file type.</p>
                                <a href={accessedFile.file_url} target="_blank" rel="noreferrer">Open File</a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

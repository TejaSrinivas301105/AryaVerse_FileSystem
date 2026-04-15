import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestAccess, getMyFiles, accessFile, getAllFiles } from '../api'
import { useAuth } from '../AuthContext'

export default function EmployeeDashboard() {
    const [fileId, setFileId] = useState('')
    const [myFiles, setMyFiles] = useState([])
    const [allFiles, setAllFiles] = useState([])
    const [msg, setMsg] = useState('')
    const [accessedFile, setAccessedFile] = useState(null)
    const [loading, setLoading] = useState(false)
    const { logout, role } = useAuth()
    const navigate = useNavigate()

    const fetchMyFiles = async () => {
        const data = await getMyFiles()
        setMyFiles(data.files || [])
    }

    const fetchAllFiles = async () => {
        const data = await getAllFiles()
        setAllFiles(data.files || [])
    }

    const refreshAll = async () => {
        await Promise.all([fetchMyFiles(), fetchAllFiles()])
    }

    useEffect(() => {
        if (!role || role !== 'employee') {
            navigate('/')
            return
        }
        refreshAll()
    }, [role])

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

    // Build a set of accessible file IDs for quick lookup
    const accessibleIds = new Set(myFiles.map(item => item.files?.id))

    // Group all files by folder
    const grouped = allFiles.reduce((acc, f) => {
        const key = f.folders?.folder_name || 'No Folder'
        if (!acc[key]) acc[key] = []
        acc[key].push(f)
        return acc
    }, {})

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
                    <h3>All Files</h3>
                    <button className="refresh-btn" onClick={refreshAll}>Refresh</button>
                </div>
                {allFiles.length === 0 ? (
                    <p className="empty">No files available</p>
                ) : (
                    Object.entries(grouped).map(([folder, folderFiles]) => (
                        <div key={folder} className="folder-group">
                            <p className="folder-label">📁 {folder}</p>
                            <div className="file-grid">
                                {folderFiles.map(f => {
                                    const hasAccess = accessibleIds.has(f.id)
                                    return (
                                        <div key={f.id} className={`file-card ${hasAccess ? '' : 'locked'}`}>
                                            <p className="file-name">
                                                {hasAccess ? '🔓' : '🔒'} {f.file_name}
                                            </p>
                                            {hasAccess ? (
                                                <div className="file-actions">
                                                    <button className="access-btn" onClick={() => handleAccessFile(f.id)}>View</button>
                                                    <a href={f.file_url} target="_blank" rel="noreferrer" className="download-btn">Download</a>
                                                </div>
                                            ) : (
                                                <div className="file-actions">
                                                    <button className="request-btn" onClick={() => handleLockedClick(f.id)}>
                                                        Request Access
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))
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

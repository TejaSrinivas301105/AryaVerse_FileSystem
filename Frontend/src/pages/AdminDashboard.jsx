import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFiles, getPendingRequests, approveRequest, rejectRequest, getAllFiles, accessFile } from '../api'
import { useAuth } from '../AuthContext'

export default function AdminDashboard() {
    const [files, setFiles] = useState([])
    const [folderId, setFolderId] = useState('')
    const [requests, setRequests] = useState([])
    const [allFiles, setAllFiles] = useState([])
    const [uploadResult, setUploadResult] = useState(null)
    const [duration, setDuration] = useState(86400000)
    const [msg, setMsg] = useState('')
    const [loading, setLoading] = useState(false)
    const [previewFile, setPreviewFile] = useState(null)
    const { logout, role } = useAuth()
    const navigate = useNavigate()

    const fetchRequests = async () => {
        const data = await getPendingRequests()
        setRequests(data.requests || [])
    }

    const fetchAllFiles = async () => {
        const data = await getAllFiles()
        setAllFiles(data.files || [])
    }

    useEffect(() => {
        if (!role || role !== 'admin') {
            navigate('/')
            return
        }
        fetchRequests()
        fetchAllFiles()
    }, [role])

    const handleUpload = async (e) => {
        e.preventDefault()
        if (files.length === 0) return setMsg('Select at least one file')
        setLoading(true)
        setMsg('')
        const formData = new FormData()
        Array.from(files).forEach(f => formData.append('files', f))
        if (folderId) formData.append('folder_id', folderId)
        const data = await uploadFiles(formData)
        setLoading(false)
        setUploadResult(data.files || [])
        setMsg('Upload complete')
        fetchAllFiles()
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

    // Group files by folder
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

            {/* Upload Section */}
            <div className="card">
                <h3>Upload Files</h3>
                <form onSubmit={handleUpload}>
                    <input type="file" multiple onChange={e => setFiles(e.target.files)} />
                    <input type="text" placeholder="Folder ID (optional)" value={folderId} onChange={e => setFolderId(e.target.value)} />
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
                    <h3>All Files</h3>
                    <button className="refresh-btn" onClick={fetchAllFiles}>Refresh</button>
                </div>
                {allFiles.length === 0 ? (
                    <p className="empty">No files uploaded yet</p>
                ) : (
                    Object.entries(grouped).map(([folder, folderFiles]) => (
                        <div key={folder} className="folder-group">
                            <p className="folder-label">📁 {folder}</p>
                            <div className="file-grid">
                                {folderFiles.map(f => (
                                    <div key={f.id} className="file-card">
                                        <p className="file-name">{f.file_name}</p>
                                        <p className="file-id">ID: {f.id}</p>
                                        <div className="file-actions">
                                            <button className="access-btn" onClick={() => handlePreview(f.id)}>View</button>
                                            <a href={f.file_url} target="_blank" rel="noreferrer" className="download-btn">Download</a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
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

            {/* Pending Requests Section */}
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

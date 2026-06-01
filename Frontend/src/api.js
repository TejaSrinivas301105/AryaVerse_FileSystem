const BASE = `${import.meta.env.VITE_API_URL}/api`

const token = () => localStorage.getItem('token')

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

const safeJson = async (res) => {
    const text = await res.text()
    try {
        return JSON.parse(text)
    } catch {
        return {
            error: text || `Request failed with status ${res.status}`
        }
    }
}

const handleResponse = async (res) => {
    if (res.status === 401) {
        localStorage.clear()
        window.location.href = '/'
        return { error: 'Session expired. Please login again.' }
    }
    return safeJson(res)
}

export const register = (email, password, role) =>
    fetch(`${BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, role }) }).then(handleResponse)

export const login = (email, password) =>
    fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then(handleResponse)

export const uploadFiles = (formData) =>
    fetch(`${BASE}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: formData }).then(handleResponse)

export const getPendingRequests = () =>
    fetch(`${BASE}/requests`, { headers: headers() }).then(handleResponse)

export const approveRequest = (request_id, duration_ms) =>
    fetch(`${BASE}/approve`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id, duration_ms }) }).then(handleResponse)

export const rejectRequest = (request_id) =>
    fetch(`${BASE}/reject`, { method: 'POST', headers: headers(), body: JSON.stringify({ request_id }) }).then(handleResponse)

export const requestAccess = (file_id) =>
    fetch(`${BASE}/request-access`, { method: 'POST', headers: headers(), body: JSON.stringify({ file_id }) }).then(handleResponse)

export const accessFile = (file_id) =>
    fetch(`${BASE}/access-file`, { method: 'POST', headers: headers(), body: JSON.stringify({ file_id }) }).then(handleResponse)

export const getAllFiles = (page = 1, limit = 20) =>
    fetch(`${BASE}/all-files?page=${page}&limit=${limit}`, { headers: headers() }).then(handleResponse)

export const getMyFiles = () =>
    fetch(`${BASE}/my-files`, { headers: headers() }).then(handleResponse)

export const deleteFile = (file_id) =>
    fetch(`${BASE}/file`, { method: 'DELETE', headers: headers(), body: JSON.stringify({ file_id }) }).then(handleResponse)

export const createFolder = (folder_name) =>
    fetch(`${BASE}/folder`, { method: 'POST', headers: headers(), body: JSON.stringify({ folder_name }) }).then(handleResponse)

export const getFolders = () =>
    fetch(`${BASE}/folders`, { headers: headers() }).then(handleResponse)

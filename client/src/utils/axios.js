import axios from 'axios'

const api = axios.create()

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('mt_token')
      localStorage.removeItem('mt_user')
      window.location.replace('/login')
      // Return a never-resolving promise so no error state is set in the calling component
      return new Promise(() => {})
    }
    return Promise.reject(error)
  }
)

export default api

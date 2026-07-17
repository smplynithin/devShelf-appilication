import React, { useState, useEffect } from 'react'
import axios from 'axios'
import SearchBar from './components/SearchBar'
import BookmarkCard from './components/BookmarkCard'
import SnippetCard from './components/SnippetCard'

// axios baseURL → all API calls go to /api/...
// Nginx routes /api/* → backend container
const api = axios.create({ baseURL: '/api' })

function App() {
  // ── State ────────────────────────────────────────────
  // useState = React's way to store data that changes
  // when state changes → component re-renders automatically

  const [activeTab, setActiveTab]     = useState('bookmarks') // which tab is active
  const [bookmarks, setBookmarks]     = useState([])           // list of bookmarks from API
  const [snippets, setSnippets]       = useState([])           // list of snippets from API
  const [query, setQuery]             = useState('')           // search input value
  const [loading, setLoading]         = useState(false)        // show loading state
  const [showForm, setShowForm]       = useState(false)        // show/hide add form

  // Bookmark form fields
  const [bTitle, setBTitle] = useState('')
  const [bUrl, setBUrl]     = useState('')
  const [bNotes, setBNotes] = useState('')
  const [bTags, setBTags]   = useState('')

  // Snippet form fields
  const [sTitle, setSTitle]   = useState('')
  const [sLang, setSLang]     = useState('python')
  const [sCode, setSCode]     = useState('')
  const [sTags, setSTags]     = useState('')

  // ── Data Fetching ─────────────────────────────────────
  // useEffect = run this code when component loads
  // or when a dependency changes
  // [] = run only once on first load
  useEffect(() => {
    fetchBookmarks()
    fetchSnippets()
  }, [])

  // When search query changes → search after 500ms pause
  // This is called "debouncing" — avoids API call on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchAll(query)
      } else {
        fetchBookmarks()
        fetchSnippets()
      }
    }, 500)
    // cleanup → cancel previous timer if user keeps typing
    return () => clearTimeout(timer)
  }, [query])

  const fetchBookmarks = async () => {
    try {
      const res = await api.get('/bookmarks/')
      setBookmarks(res.data)
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err)
    }
  }

  const fetchSnippets = async () => {
    try {
      const res = await api.get('/snippets/')
      setSnippets(res.data)
    } catch (err) {
      console.error('Failed to fetch snippets:', err)
    }
  }

  const searchAll = async (q) => {
    try {
      setLoading(true)
      const [bRes, sRes] = await Promise.all([
        api.get(`/bookmarks/search?q=${q}`),
        api.get(`/snippets/search?q=${q}`)
      ])
      setBookmarks(bRes.data)
      setSnippets(sRes.data)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Create Handlers ───────────────────────────────────
  const createBookmark = async (e) => {
    e.preventDefault() // prevent page reload on form submit
    try {
      await api.post('/bookmarks/', {
        title: bTitle,
        url:   bUrl,
        notes: bNotes,
        // split "docker,devops" → ["docker","devops"]
        tags:  bTags.split(',').map(t => t.trim()).filter(Boolean)
      })
      // reset form fields
      setBTitle(''); setBUrl(''); setBNotes(''); setBTags('')
      setShowForm(false)
      fetchBookmarks() // refresh list
    } catch (err) {
      console.error('Failed to create bookmark:', err)
    }
  }

  const createSnippet = async (e) => {
    e.preventDefault()
    try {
      await api.post('/snippets/', {
        title:    sTitle,
        language: sLang,
        code:     sCode,
        tags:     sTags.split(',').map(t => t.trim()).filter(Boolean)
      })
      setSTitle(''); setSLang('python'); setSCode(''); setSTags('')
      setShowForm(false)
      fetchSnippets()
    } catch (err) {
      console.error('Failed to create snippet:', err)
    }
  }

  // ── Delete Handlers ───────────────────────────────────
  const deleteBookmark = async (id) => {
    try {
      await api.delete(`/bookmarks/${id}`)
      // remove from state without refetching
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch (err) {
      console.error('Failed to delete bookmark:', err)
    }
  }

  const deleteSnippet = async (id) => {
    try {
      await api.delete(`/snippets/${id}`)
      setSnippets(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete snippet:', err)
    }
  }

  // ── Styles ────────────────────────────────────────────
  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    background: '#0f1117',
    border: '1px solid #2d3748',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '13px',
    marginBottom: '10px',
    outline: 'none'
  }

  const btnPrimary = {
    padding: '8px 20px',
    background: '#3182ce',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 16px' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0',
        borderBottom: '1px solid #2d3748'
      }}>
        <h1 style={{ fontSize: '22px', color: '#63b3ed', fontWeight: 700 }}>
          📚 DevShelf
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          style={btnPrimary}
        >
          {showForm ? '✕ Cancel' : '+ Add New'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          background: '#1a1f2e',
          border: '1px solid #2d3748',
          borderRadius: '8px',
          padding: '20px',
          margin: '16px 0'
        }}>
          {/* Tab switcher inside form */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {['bookmark', 'snippet'].map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t + 's')}
                style={{
                  ...btnPrimary,
                  background: activeTab === t + 's' ? '#3182ce' : '#2d3748'
                }}
              >
                {t === 'bookmark' ? '🔖 Bookmark' : '💻 Snippet'}
              </button>
            ))}
          </div>

          {/* Bookmark Form */}
          {activeTab === 'bookmarks' && (
            <form onSubmit={createBookmark}>
              <input style={inputStyle} placeholder="Title *" value={bTitle} onChange={e => setBTitle(e.target.value)} required />
              <input style={inputStyle} placeholder="URL *" value={bUrl} onChange={e => setBUrl(e.target.value)} required />
              <input style={inputStyle} placeholder="Notes (optional)" value={bNotes} onChange={e => setBNotes(e.target.value)} />
              <input style={inputStyle} placeholder="Tags (comma separated: docker,devops)" value={bTags} onChange={e => setBTags(e.target.value)} />
              <button type="submit" style={btnPrimary}>Save Bookmark</button>
            </form>
          )}

          {/* Snippet Form */}
          {activeTab === 'snippets' && (
            <form onSubmit={createSnippet}>
              <input style={inputStyle} placeholder="Title *" value={sTitle} onChange={e => setSTitle(e.target.value)} required />
              <select
                value={sLang}
                onChange={e => setSLang(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {['python','javascript','bash','yaml','sql','dockerfile','go','rust'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <textarea
                style={{ ...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'monospace' }}
                placeholder="Paste your code here *"
                value={sCode}
                onChange={e => setSCode(e.target.value)}
                required
              />
              <input style={inputStyle} placeholder="Tags (comma separated)" value={sTags} onChange={e => setSTags(e.target.value)} />
              <button type="submit" style={btnPrimary}>Save Snippet</button>
            </form>
          )}
        </div>
      )}

      {/* Search Bar */}
      <SearchBar query={query} setQuery={setQuery} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '16px 0 8px' }}>
        {['bookmarks', 'snippets'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? '#3182ce' : 'transparent',
              color: activeTab === tab ? '#fff' : '#718096',
              border: '1px solid',
              borderColor: activeTab === tab ? '#3182ce' : '#2d3748',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'bookmarks' ? `🔖 Bookmarks (${bookmarks.length})` : `💻 Snippets (${snippets.length})`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#718096' }}>
          Searching...
        </div>
      )}

      {/* Content */}
      <div style={{ paddingBottom: '40px' }}>
        {activeTab === 'bookmarks' && (
          bookmarks.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
                No bookmarks yet. Click + Add New to get started.
              </div>
            : bookmarks.map(b => (
                <BookmarkCard key={b.id} bookmark={b} onDelete={deleteBookmark} />
              ))
        )}
        {activeTab === 'snippets' && (
          snippets.length === 0
            ? <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568' }}>
                No snippets yet. Click + Add New to get started.
              </div>
            : snippets.map(s => (
                <SnippetCard key={s.id} snippet={s} onDelete={deleteSnippet} />
              ))
        )}
      </div>

    </div>
  )
}

export default App
import React from 'react'

// SearchBar receives two props from parent (App.jsx):
// query        → current search text (controlled input)
// setQuery     → function to update query when user types
function SearchBar({ query, setQuery }) {
  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid #2d3748'
    }}>
      <input
        type="text"
        placeholder="Search bookmarks and snippets..."
        value={query}
        // every keystroke → call setQuery with new value
        // this updates state in App.jsx → triggers re-render
        onChange={(e) => setQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: '#1a1f2e',
          border: '1px solid #2d3748',
          borderRadius: '8px',
          color: '#e2e8f0',
          fontSize: '14px',
          outline: 'none'
        }}
      />
    </div>
  )
}

export default SearchBar
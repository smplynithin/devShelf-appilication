import React from 'react'

function BookmarkCard({ bookmark, onDelete }) {
  return (
    <div style={{
      background: '#1a1f2e',
      border: '1px solid #2d3748',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <a        
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#63b3ed', textDecoration: 'none', fontWeight: 600, fontSize: '15px' }}
        >
          {bookmark.title}
        </a>
        <button
          onClick={() => onDelete(bookmark.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fc8181',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>
      <div style={{ color: '#718096', fontSize: '12px', marginTop: '4px' }}>
        {bookmark.url}
      </div>
      {bookmark.notes && (
        <div style={{ color: '#a0aec0', fontSize: '13px', marginTop: '8px' }}>
          {bookmark.notes}
        </div>
      )}
      {bookmark.tags && bookmark.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {bookmark.tags.map(tag => (
            <span key={tag} style={{
              background: '#2d3748',
              color: '#90cdf4',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px'
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default BookmarkCard
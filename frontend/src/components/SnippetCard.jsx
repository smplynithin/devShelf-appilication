import React from 'react'

function SnippetCard({ snippet, onDelete }) {
  return (
    <div style={{
      background: '#1a1f2e',
      border: '1px solid #2d3748',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px'
    }}>
      {/* Title and delete */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#e2e8f0' }}>
          {snippet.title}
        </span>
        <button
          onClick={() => onDelete(snippet.id)}
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

      {/* Language badge */}
      <div style={{ marginTop: '6px' }}>
        <span style={{
          background: '#2d4a22',
          color: '#68d391',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          {snippet.language}
        </span>
      </div>

      {/* Code block */}
      <pre style={{
        background: '#0f1117',
        border: '1px solid #2d3748',
        borderRadius: '6px',
        padding: '12px',
        marginTop: '10px',
        fontSize: '12px',
        color: '#e2e8f0',
        overflowX: 'auto',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {snippet.code}
      </pre>

      {/* Tags */}
      {snippet.tags && snippet.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
          {snippet.tags.map(tag => (
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

export default SnippetCard
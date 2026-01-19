import React, { useState, useEffect } from 'react';

interface DocumentationViewerProps {
  filePath: string;
  onClose: () => void;
}

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({ filePath, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [filePath]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the markdown file from public directory or as raw text
      const response = await fetch(`/${filePath}`);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.statusText}`);
      }
      const text = await response.text();
      setContent(text);
    } catch (err) {
      console.error('Error loading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // Simple markdown to HTML converter (basic support)
  const renderMarkdown = (markdown: string): string => {
    let html = markdown;

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="code-block"><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="doc-h3">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="doc-h2">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="doc-h1">$1</h1>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists
    html = html.replace(/^\- (.+)$/gim, '<li class="doc-li">$1</li>');
    html = html.replace(/(<li class="doc-li">.*<\/li>)/s, '<ul class="doc-ul">$1</ul>');

    // Checkboxes
    html = html.replace(/\[ \]/g, '<input type="checkbox" disabled class="doc-checkbox">');
    html = html.replace(/\[x\]/gi, '<input type="checkbox" checked disabled class="doc-checkbox">');

    // Paragraphs
    html = html.split('\n\n').map(para => {
      if (para.startsWith('<h') || para.startsWith('<pre') || para.startsWith('<ul') || para.startsWith('<li')) {
        return para;
      }
      if (para.trim() === '') return '';
      return `<p class="doc-p">${para.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  };

  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-bold text-white">
              {filePath.split('/').pop()?.replace('.md', '').toUpperCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Loading documentation...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && (
            <div
              className="doc-content prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </div>

      <style>{`
        .doc-content {
          color: #e5e7eb;
          line-height: 1.7;
        }

        .doc-h1 {
          font-size: 2rem;
          font-weight: bold;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #60a5fa;
          border-bottom: 2px solid #374151;
          padding-bottom: 0.5rem;
        }

        .doc-h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #93c5fd;
        }

        .doc-h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #bfdbfe;
        }

        .doc-p {
          margin-bottom: 1rem;
        }

        .code-block {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .code-block code {
          color: #e5e7eb;
        }

        .inline-code {
          background: #374151;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.875rem;
          color: #fbbf24;
        }

        .doc-link {
          color: #60a5fa;
          text-decoration: underline;
          transition: color 0.2s;
        }

        .doc-link:hover {
          color: #93c5fd;
        }

        .doc-ul {
          margin: 1rem 0;
          padding-left: 0;
          list-style: none;
        }

        .doc-li {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
          position: relative;
        }

        .doc-li::before {
          content: "•";
          color: #60a5fa;
          font-weight: bold;
          position: absolute;
          left: 0;
        }

        .doc-checkbox {
          margin-right: 0.5rem;
          cursor: not-allowed;
        }

        strong {
          color: #f3f4f6;
          font-weight: 600;
        }

        em {
          color: #d1d5db;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

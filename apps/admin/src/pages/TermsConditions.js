import React, { useState, useEffect } from 'react';
import { FiSave, FiEdit2, FiEye, FiClock, FiFileText } from 'react-icons/fi';

const TermsConditions = () => {
  const [termsData, setTermsData] = useState({
    content: '',
    lastUpdated: null,
    version: '1.0',
    isActive: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Removed hardcoded default terms content - should be loaded from database
  const defaultTermsContent = '';

  useEffect(() => {
    fetchTermsData();
  }, []);

  const fetchTermsData = async () => {
    try {
      setLoading(true);
      // Simulate API call - replace with actual API endpoint
      const response = await fetch('/api/admin/content/terms');
      if (response.ok) {
        const data = await response.json();
        setTermsData(data.data || {
          content: defaultTermsContent,
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          isActive: true
        });
      } else {
        // Set default terms if no data exists
        setTermsData({
          content: defaultTermsContent,
          lastUpdated: new Date().toISOString(),
          version: '1.0',
          isActive: true
        });
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
      setTermsData({
        content: defaultTermsContent,
        lastUpdated: new Date().toISOString(),
        version: '1.0',
        isActive: true
      });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEdit = () => {
    setEditContent(termsData.content);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditContent('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editContent.trim()) {
      showMessage('Terms content cannot be empty', 'error');
      return;
    }

    try {
      setSaving(true);
      
      const updatedTerms = {
        content: editContent,
        lastUpdated: new Date().toISOString(),
        version: incrementVersion(termsData.version),
        isActive: true
      };

      // Simulate API call - replace with actual API endpoint
      const response = await fetch('/api/admin/content/terms', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTerms),
      });

      if (response.ok) {
        setTermsData(updatedTerms);
        setIsEditing(false);
        setEditContent('');
        showMessage('Terms and Conditions updated successfully!');
      } else {
        showMessage('Failed to update Terms and Conditions', 'error');
      }
    } catch (error) {
      console.error('Error updating terms:', error);
      showMessage('Error updating Terms and Conditions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const incrementVersion = (currentVersion) => {
    const parts = currentVersion.split('.');
    const minor = parseInt(parts[1]) + 1;
    return `${parts[0]}.${minor}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMarkdown = (content) => {
    // Simple markdown rendering - replace with a proper markdown library if needed
    return content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiFileText size={16} className="text-gray-300" /> Loading Terms and Conditions...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiFileText size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">Terms and Conditions</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage the terms and conditions for your loan application</p>
          </div>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              <FiEye size={13} /> {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
            <button onClick={handleEdit} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
              <FiEdit2 size={13} /> Edit Terms
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`px-5 py-3 mb-5 rounded-xl text-sm border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-4 mb-5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FiClock size={12} />
          <span className="font-semibold">Last Updated:</span> {formatDate(termsData.lastUpdated)}
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">
          Version {termsData.version}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${termsData.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
          {termsData.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {isEditing ? (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Edit Terms and Conditions</p>
            <p className="text-xs text-gray-400 mb-4">Use Markdown formatting for better structure and readability</p>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
              placeholder="Enter terms and conditions content..." rows={18}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-y mb-4 font-mono" />
            <div className="flex items-center gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition">
                <FiSave size={13} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={handleCancel} disabled={saving}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition">
                Cancel
              </button>
            </div>
          </>
        ) : showPreview ? (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Preview</p>
            <div className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(termsData.content) }} />
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Raw Content</p>
            <pre className="text-xs text-gray-700 font-mono bg-gray-50 rounded-xl p-4 whitespace-pre-wrap overflow-x-auto">{termsData.content}</pre>
          </>
        )}
      </div>
    </div>
  );

};

export default TermsConditions;

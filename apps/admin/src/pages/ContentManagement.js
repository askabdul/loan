import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiX,
  FiSearch,
  FiRefreshCw,
  FiFileText,
  FiFilter,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";
import websocketService from "../services/websocket";

const ContentManagement = () => {
  const { hasActionPermission } = useAuth();
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [formData, setFormData] = useState({
    key: "",
    title: "",
    type: "faq",
    content: "",
    isActive: true,
    order: 1,
    metadata: {},
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchContents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getAllContent();
      setContents(data.contents || []);
    } catch (error) {
      console.error("Error fetching contents:", error);
      showMessage("error", "Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();

    // Set up WebSocket listeners for real-time content updates
    websocketService.on("content_created", (data) => {
      setContents((prev) => [data.content, ...prev]);
      showMessage("success", "New content created by another admin.");
    });

    websocketService.on("content_updated", (data) => {
      setContents((prev) =>
        prev.map((content) =>
          content._id === data.content._id ? data.content : content,
        ),
      );
      showMessage("info", "Content updated by another admin.");
    });

    websocketService.on("content_deleted", (data) => {
      setContents((prev) =>
        prev.filter((content) => content._id !== data.contentId),
      );
      showMessage("info", "Content deleted by another admin.");
    });

    return () => {
      websocketService.off("content_created");
      websocketService.off("content_updated");
      websocketService.off("content_deleted");
    };
  }, [fetchContents]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleCreateNew = () => {
    setEditingContent(null);
    setFormData({
      key: "",
      title: "",
      type: "faq",
      content: "",
      isActive: true,
      order: 1,
      metadata: {},
    });
    setShowModal(true);
  };

  const handleEdit = (content) => {
    setEditingContent(content);
    setFormData({
      key: content.key || "",
      title: content.title || "",
      type: content.type || "faq",
      content:
        typeof content.content === "string"
          ? content.content
          : JSON.stringify(content.content, null, 2),
      isActive: content.isActive !== undefined ? content.isActive : true,
      order: content.order || 1,
      metadata: content.metadata
        ? JSON.stringify(content.metadata, null, 2)
        : "{}",
    });
    setShowModal(true);
  };

  const handleDelete = async (contentId) => {
    if (window.confirm("Are you sure you want to delete this content?")) {
      try {
        await apiService.deleteContent(contentId);
        setContents((prev) =>
          prev.filter((content) => content._id !== contentId),
        );
        showMessage("success", "Content deleted successfully.");
      } catch (error) {
        console.error("Error deleting content:", error);
        showMessage("error", "Failed to delete content.");
      }
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      showMessage("error", "Title and content are required.");
      return;
    }

    if (!editingContent && !formData.key.trim()) {
      showMessage("error", "Key is required for new content.");
      return;
    }

    try {
      setSaving(true);

      // Prepare the data for API
      const contentData = {
        ...formData,
        content:
          formData.type === "faq" ||
          formData.type === "process_guide" ||
          formData.type === "contact_info"
            ? formData.content.startsWith("{")
              ? JSON.parse(formData.content)
              : formData.content
            : formData.content,
        metadata: formData.metadata ? JSON.parse(formData.metadata) : {},
      };

      if (editingContent) {
        // Update existing content
        const updatedContent = await apiService.updateContent(
          editingContent._id,
          contentData,
        );
        setContents((prev) =>
          prev.map((content) =>
            content._id === editingContent._id
              ? updatedContent.content
              : content,
          ),
        );
        showMessage("success", "Content updated successfully.");
      } else {
        // Create new content
        const newContent = await apiService.createContent(contentData);
        setContents((prev) => [newContent.content, ...prev]);
        showMessage("success", "Content created successfully.");
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving content:", error);
      showMessage(
        "error",
        error.response?.data?.message || "Failed to save content.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const filteredContents = contents.filter((content) => {
    const contentText =
      typeof content.content === "string"
        ? content.content
        : JSON.stringify(content.content);
    const matchesSearch =
      content.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contentText?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || content.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || content.isActive?.toString() === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (isActive) => {
    return isActive ? "success" : "secondary";
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "faq":
        return "info";
      case "process_guide":
        return "primary";
      case "contact_info":
        return "warning";
      case "terms":
        return "secondary";
      case "privacy":
        return "secondary";
      case "about":
        return "success";
      default:
        return "secondary";
    }
  };

  const getContentPlaceholder = (type) => {
    switch (type) {
      case "faq":
        return '{"answer": "Your FAQ answer here..."}';
      case "process_guide":
        return '{"description": "Step description", "step": 1}';
      case "contact_info":
        return '{"type": "phone", "value": "+1234567890", "displayText": "Call us"}';
      case "terms":
      case "privacy":
      case "about":
        return "Enter your content here...";
      default:
        return "Enter content...";
    }
  };

  const getContentHelp = (type) => {
    switch (type) {
      case "faq":
        return 'For FAQ: Use JSON format with "answer" field';
      case "process_guide":
        return 'For Process Guide: Use JSON with "description" and "step" fields';
      case "contact_info":
        return 'For Contact Info: Use JSON with "type", "value", and "displayText" fields';
      case "terms":
      case "privacy":
      case "about":
        return "For static content: Use plain text or HTML";
      default:
        return "Enter the content based on the selected type";
    }
  };

  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  const TYPE_BADGE = {
    faq: "bg-blue-50 text-blue-700 border-blue-200",
    process_guide: "bg-indigo-50 text-indigo-700 border-indigo-200",
    contact_info: "bg-amber-50 text-amber-700 border-amber-200",
    terms: "bg-gray-100 text-gray-600 border-gray-200",
    privacy: "bg-gray-100 text-gray-600 border-gray-200",
    about: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin" /> Loading content...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiFileText size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Content Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage app content, FAQs and guides
            </p>
          </div>
        </div>
        {hasActionPermission("createContent") && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
          >
            <FiPlus size={14} /> Create Content
          </button>
        )}
      </div>

      {/* Message banner */}
      {message.text && (
        <div
          className={`px-5 py-3 mb-5 rounded-xl text-sm border ${message.type === "error" ? "bg-red-50 text-red-700 border-red-200" : message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}
        >
          {message.text}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="faq">FAQ</option>
            <option value="process_guide">Process Guide</option>
            <option value="contact_info">Contact Info</option>
            <option value="terms">Terms & Conditions</option>
            <option value="privacy">Privacy Policy</option>
            <option value="about">About Us</option>
          </select>
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Content list */}
      {filteredContents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-8 py-16 text-center text-sm text-gray-400">
          No content found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContents.map((content) => (
            <div
              key={content._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-800 m-0">
                      {content.title}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${content.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                    >
                      {content.isActive ? "Active" : "Inactive"}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TYPE_BADGE[content.type] || "bg-gray-100 text-gray-500 border-gray-200"}`}
                    >
                      {content.type?.replace("_", " ").toUpperCase()}
                    </span>
                    {content.key && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-100 text-gray-500 border border-gray-200">
                        {content.key}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 m-0 line-clamp-2">
                    {typeof content.content === "string"
                      ? content.content.substring(0, 150)
                      : JSON.stringify(content.content).substring(0, 150)}
                    ...
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-gray-400">
                    <span>Order: {content.order || "—"}</span>
                    <span>
                      Created:{" "}
                      {new Date(content.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      Updated:{" "}
                      {new Date(content.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {hasActionPermission("editContent") && (
                    <button
                      onClick={() => handleEdit(content)}
                      title="Edit"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                    >
                      <FiEdit size={13} />
                    </button>
                  )}
                  {hasActionPermission("deleteContent") && (
                    <button
                      onClick={() => handleDelete(content._id)}
                      title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 250,
              right: 0,
              bottom: 0,
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={() => setShowModal(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "640px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  {editingContent ? "Edit Content" : "Create Content"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Key *
                    </label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => handleInputChange("key", e.target.value)}
                      placeholder="e.g., faq_how_to_apply"
                      disabled={!!editingContent}
                      className={inp}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Unique identifier (cannot change after creation)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        handleInputChange("type", e.target.value)
                      }
                      className={inp}
                    >
                      <option value="faq">FAQ</option>
                      <option value="process_guide">Process Guide</option>
                      <option value="contact_info">Contact Info</option>
                      <option value="terms">Terms & Conditions</option>
                      <option value="privacy">Privacy Policy</option>
                      <option value="about">About Us</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter content title"
                    className={inp}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) =>
                        handleInputChange(
                          "order",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      min="1"
                      className={inp}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Lower numbers appear first
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                      Status
                    </label>
                    <select
                      value={formData.isActive}
                      onChange={(e) =>
                        handleInputChange("isActive", e.target.value === "true")
                      }
                      className={inp}
                    >
                      <option value={true}>Active</option>
                      <option value={false}>Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      handleInputChange("content", e.target.value)
                    }
                    placeholder={getContentPlaceholder(formData.type)}
                    rows={8}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    {getContentHelp(formData.type)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                    Metadata (JSON)
                  </label>
                  <textarea
                    value={formData.metadata}
                    onChange={(e) =>
                      handleInputChange("metadata", e.target.value)
                    }
                    placeholder='{"icon": "📱", "color": "#007bff"}'
                    rows={3}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Optional additional metadata in JSON format
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : editingContent ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ContentManagement;

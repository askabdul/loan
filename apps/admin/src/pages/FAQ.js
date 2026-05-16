import React, { useState, useEffect } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiHelpCircle,
} from "react-icons/fi";
import apiService from "../services/api";

const FAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFaq, setNewFaq] = useState({
    question: "",
    answer: "",
    category: "general",
  });

  const categories = [
    { value: "general", label: "General" },
    { value: "loans", label: "Loans" },
    { value: "payments", label: "Payments" },
    { value: "account", label: "Account" },
    { value: "security", label: "Security" },
    { value: "technical", label: "Technical Support" },
  ];

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAllContent();
      const items = response?.data || [];
      const mappedFaqs = items
        .filter((item) => item.type === "faq")
        .map((item) => ({
          id: item.id,
          question: item.title || "",
          answer:
            item.content?.answer ||
            (typeof item.content === "string" ? item.content : ""),
          category: item.content?.category || "general",
          isActive: item.isActive !== false,
          order: item.sortOrder || item.order || 0,
          key: item.key,
        }))
        .sort((a, b) => a.order - b.order);

      setFaqs(mappedFaqs);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      showMessage("Error loading FAQs", "error");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(""), 3000);
  };

  const handleAddFaq = async () => {
    if (!newFaq.question.trim() || !newFaq.answer.trim()) {
      showMessage("Please fill in both question and answer", "error");
      return;
    }

    try {
      setSaving(true);
      const order = faqs.length + 1;
      await apiService.createContent({
        key: `faq_${Date.now()}`,
        type: "faq",
        title: newFaq.question,
        content: {
          answer: newFaq.answer,
          category: newFaq.category,
        },
        sortOrder: order,
        isActive: true,
      });

      setNewFaq({ question: "", answer: "", category: "general" });
      setShowAddForm(false);
      await fetchFAQs();
      showMessage("FAQ added successfully!");
    } catch (error) {
      console.error("Error adding FAQ:", error);
      showMessage("Error adding FAQ", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFaq = async (id, updatedFaq) => {
    try {
      setSaving(true);
      await apiService.updateContent(id, {
        title: updatedFaq.question,
        content: {
          answer: updatedFaq.answer,
          category: updatedFaq.category,
        },
        isActive: updatedFaq.isActive,
      });
      await fetchFAQs();
      setEditingId(null);
      showMessage("FAQ updated successfully!");
    } catch (error) {
      console.error("Error updating FAQ:", error);
      showMessage("Error updating FAQ", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async (id) => {
    try {
      setSaving(true);
      await apiService.deleteContent(id);
      setFaqs(faqs.filter((faq) => faq.id !== id));
      showMessage("FAQ deleted successfully!");
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      showMessage("Error deleting FAQ", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleFaqStatus = async (id, isActive) => {
    try {
      setSaving(true);
      const targetFaq = faqs.find((faq) => faq.id === id);
      await apiService.updateContent(id, {
        title: targetFaq?.question || "",
        content: {
          answer: targetFaq?.answer || "",
          category: targetFaq?.category || "general",
        },
        isActive: !isActive,
      });

      setFaqs(
        faqs.map((faq) =>
          faq.id === id ? { ...faq, isActive: !isActive } : faq,
        ),
      );
      showMessage(
        `FAQ ${!isActive ? "activated" : "deactivated"} successfully!`,
      );
    } catch (error) {
      console.error("Error updating FAQ status:", error);
      showMessage("Error updating FAQ status", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <FiHelpCircle size={16} className="text-gray-300" /> Loading FAQs...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiHelpCircle size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              FAQ Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage frequently asked questions for your loan application
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <FiPlus size={14} /> Add New FAQ
        </button>
      </div>

      {message && (
        <div
          className={`px-5 py-3 mb-5 rounded-xl text-sm border ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}
        >
          {message.text}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 mb-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            Add New FAQ
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Category
              </label>
              <select
                value={newFaq.category}
                onChange={(e) =>
                  setNewFaq({ ...newFaq, category: e.target.value })
                }
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                Question
              </label>
              <input
                type="text"
                value={newFaq.question}
                onChange={(e) =>
                  setNewFaq({ ...newFaq, question: e.target.value })
                }
                placeholder="Enter the question"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Answer
            </label>
            <textarea
              value={newFaq.answer}
              onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
              placeholder="Enter the answer"
              rows={3}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddFaq}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <FiSave size={13} /> {saving ? "Saving..." : "Save FAQ"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewFaq({ question: "", answer: "", category: "general" });
              }}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <FiX size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {categories.map((category) => {
          const categoryFaqs = faqs.filter(
            (faq) => faq.category === category.value,
          );
          if (categoryFaqs.length === 0) return null;
          return (
            <div
              key={category.value}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
            >
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                {category.label}
              </p>
              <div className="space-y-3">
                {categoryFaqs.map((faq) => (
                  <div
                    key={faq.id}
                    className={`border rounded-xl p-4 ${!faq.isActive ? "border-gray-100 bg-gray-50/50 opacity-60" : "border-gray-100"}`}
                  >
                    {editingId === faq.id ? (
                      <EditFaqForm
                        faq={faq}
                        categories={categories}
                        onSave={(updated) => handleUpdateFaq(faq.id, updated)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 mb-1">
                            {faq.question}
                          </p>
                          <p className="text-xs text-gray-500 m-0">
                            {faq.answer}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border mr-1 ${faq.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                          >
                            {faq.isActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            onClick={() => setEditingId(faq.id)}
                            disabled={saving}
                            title="Edit"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                          >
                            <FiEdit2 size={12} />
                          </button>
                          <button
                            onClick={() =>
                              toggleFaqStatus(faq.id, faq.isActive)
                            }
                            disabled={saving}
                            title={faq.isActive ? "Deactivate" : "Activate"}
                            className="px-2 py-1 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                          >
                            {faq.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDeleteFaq(faq.id)}
                            disabled={saving}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                          >
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {faqs.length === 0 && (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          No FAQs found. Click "Add New FAQ" to get started.
        </div>
      )}
    </div>
  );
};

const EditFaqForm = ({ faq, categories, onSave, onCancel, saving }) => {
  const [formData, setFormData] = React.useState({
    question: faq.question,
    answer: faq.answer,
    category: faq.category,
    isActive: faq.isActive !== false,
  });
  const inp =
    "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          Question
        </label>
        <input
          value={formData.question}
          onChange={(e) =>
            setFormData((p) => ({ ...p, question: e.target.value }))
          }
          className={inp}
          placeholder="Enter question"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">
          Answer
        </label>
        <textarea
          rows={3}
          value={formData.answer}
          onChange={(e) =>
            setFormData((p) => ({ ...p, answer: e.target.value }))
          }
          className={inp + " resize-none"}
          placeholder="Enter answer"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Category
          </label>
          <select
            value={formData.category}
            onChange={(e) =>
              setFormData((p) => ({ ...p, category: e.target.value }))
            }
            className={inp}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Status
          </label>
          <select
            value={formData.isActive ? "active" : "inactive"}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                isActive: e.target.value === "active",
              }))
            }
            className={inp}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(formData)}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
};

export default FAQ;

import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { toast } from "react-toastify";
import {
  FiSearch,
  FiFilter,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiX,
  FiUsers,
  FiAlertTriangle,
} from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import IdCardModal from "../components/IdCardModal";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8001/api";

const inputCls =
  "w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const labelCls =
  "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide";

const AdminFormFields = ({
  formData,
  handleInputChange,
  roles,
  errors,
  onSubmit,
  submitLabel,
  onCancel,
}) => (
  <form onSubmit={onSubmit} className="p-6 space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        {
          label: "First Name",
          name: "firstName",
          type: "text",
          required: true,
        },
        { label: "Last Name", name: "lastName", type: "text", required: true },
        { label: "Email", name: "email", type: "email", required: true },
        { label: "Username", name: "username", type: "text", required: true },
        {
          label: "Phone Number",
          name: "phoneNumber",
          type: "tel",
          required: true,
        },
        ...(submitLabel === "Create Admin"
          ? [
              {
                label: "Password",
                name: "password",
                type: "password",
                required: true,
              },
            ]
          : []),
        {
          label: "Designation",
          name: "designation",
          type: "text",
          required: true,
          placeholder: "e.g., Manager, Officer",
        },
        {
          label: "Date Joined",
          name: "dateJoined",
          type: "date",
          required: true,
        },
        {
          label: "Date of Expiry",
          name: "dateOfExpiry",
          type: "date",
          required: true,
        },
      ].map(({ label, name, type, required, placeholder }) => (
        <div key={name}>
          <label className={labelCls}>{label}</label>
          <input
            type={type}
            name={name}
            value={formData[name] || ""}
            onChange={handleInputChange}
            required={required}
            placeholder={placeholder}
            className={inputCls}
          />
          {errors[name] && (
            <p className="text-xs text-red-600 mt-1">{errors[name]}</p>
          )}
        </div>
      ))}
      <div>
        <label className={labelCls}>Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleInputChange}
          required
          className={inputCls}
        >
          <option value="">Select Role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.displayName}
            </option>
          ))}
        </select>
        {errors.role && (
          <p className="text-xs text-red-600 mt-1">{errors.role}</p>
        )}
      </div>
      <div>
        <label className={labelCls}>Profile Image (Optional)</label>
        <input
          type="file"
          name="profileImage"
          onChange={handleInputChange}
          accept="image/*"
          className={
            inputCls +
            " file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
          }
        />
      </div>
    </div>
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        name="isActive"
        id="isActive"
        checked={formData.isActive}
        onChange={handleInputChange}
        className="rounded"
      />
      <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
        Active
      </label>
    </div>
    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
      <button
        type="button"
        onClick={onCancel}
        className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition"
      >
        {submitLabel}
      </button>
    </div>
  </form>
);

const AdminManagement = () => {
  const { hasActionPermission, hasButtonAccess, hasTableAccess, isSuperAdmin } =
    useAuth();

  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const searchTimeoutRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    phoneNumber: "",
    password: "",
    role: "",
    designation: "",
    dateJoined: "",
    dateOfExpiry: "",
    profileImage: null,
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  const fetchAdmins = useCallback(
    async (page = currentPage) => {
      try {
        setLoading(true);
        const token = localStorage.getItem("adminToken");
        const queryParams = new URLSearchParams({
          page: page,
          limit: 10,
          ...(searchTerm && { search: searchTerm }),
          ...(filterRole && { role: filterRole }),
          ...(filterStatus && { status: filterStatus }),
        });

        const response = await fetch(
          `${API_BASE_URL}/admin-management/admins?${queryParams}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setAdmins(data.data.admins);
          setTotalPages(data.data.pagination.pages);
        } else {
          console.error("Failed to fetch admins");
        }
      } catch (error) {
        console.error("Error fetching admins:", error);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, searchTerm, filterRole, filterStatus],
  );

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, [fetchAdmins]);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/admin-management/roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");

      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        if (key === "profileImage" && formData[key]) {
          formDataToSend.append(key, formData[key]);
        } else if (key !== "profileImage") {
          formDataToSend.append(key, formData[key]);
        }
      });

      const response = await fetch(`${API_BASE_URL}/admin-auth/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          username: "",
          phoneNumber: "",
          password: "",
          role: "",
          designation: "",
          dateJoined: "",
          dateOfExpiry: "",
          profileImage: null,
          isActive: true,
        });
        setErrors({});
        fetchAdmins();
        const employeeNumber = data.admin?.employeeNumber;
        if (employeeNumber) {
          toast.success(
            `Admin created successfully! Employee Number: ${employeeNumber}`,
          );
        } else {
          toast.success("Admin created successfully!");
        }
      } else {
        if (data.errors) {
          const errorObj = {};
          data.errors.forEach((error) => {
            errorObj[error.path] = error.msg;
          });
          setErrors(errorObj);
        } else {
          toast.error(data.message || "Failed to create admin");
        }
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error("Error creating admin");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = async (e) => {
    e.preventDefault();

    if (!selectedAdmin || !selectedAdmin.id) {
      toast.error("No admin selected for editing");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(
        `${API_BASE_URL}/admin-management/admins/${selectedAdmin.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setShowEditModal(false);
        setSelectedAdmin(null);
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          username: "",
          phoneNumber: "",
          password: "",
          role: "",
          designation: "",
          dateJoined: "",
          dateOfExpiry: "",
          profileImage: null,
          isActive: true,
        });
        setErrors({});
        fetchAdmins();
        toast.success("Admin updated successfully!");
      } else {
        if (data.errors) {
          const errorObj = {};
          data.errors.forEach((error) => {
            errorObj[error.path] = error.msg;
          });
          setErrors(errorObj);
        } else {
          toast.error(data.message || "Failed to update admin");
        }
      }
    } catch (error) {
      console.error("Error updating admin:", error);
      toast.error("Error updating admin");
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    setAdminToDelete(adminId);
    setShowDeleteModal(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      setDeleteSubmitting(true);
      const token = localStorage.getItem("adminToken");
      const response = await fetch(
        `${API_BASE_URL}/admin-management/admins/${adminToDelete}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        fetchAdmins();
        toast.success("Admin deleted successfully!");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete admin");
      }
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast.error("Error deleting admin");
    } finally {
      setDeleteSubmitting(false);
      setShowDeleteModal(false);
      setAdminToDelete(null);
    }
  };

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setFormData({
      firstName: admin.firstName || "",
      lastName: admin.lastName || "",
      email: admin.email || "",
      username: admin.username || "",
      phoneNumber: admin.phoneNumber || "",
      role: admin.role?.id || admin.roleId || "",
      designation: admin.designation || "",
      dateJoined: admin.dateJoined
        ? new Date(admin.dateJoined).toISOString().split("T")[0]
        : "",
      dateOfExpiry: admin.dateOfExpiry
        ? new Date(admin.dateOfExpiry).toISOString().split("T")[0]
        : "",
      profileImage: null,
      isActive: admin.isActive !== undefined ? admin.isActive : true,
    });
    setShowEditModal(true);
  };

  const openIdCardModal = (admin) => {
    setSelectedAdmin(admin);
    setShowIdCardModal(true);
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);

    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchAdmins(1);
    }, 500);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const getRoleBadgeColor = (roleName) => {
    const colors = {
      "super-admin": "bg-red-100 text-red-800",
      admin: "bg-blue-100 text-blue-800",
      "local-manager": "bg-green-100 text-green-800",
      "review-lead": "bg-purple-100 text-purple-800",
      "review-officer": "bg-yellow-100 text-yellow-800",
      "collection-lead": "bg-orange-100 text-orange-800",
      "collection-officer": "bg-pink-100 text-pink-800",
      "precollection-lead": "bg-indigo-100 text-indigo-800",
      "precollection-officer": "bg-gray-100 text-gray-800",
      "customer-service": "bg-teal-100 text-teal-800",
    };
    return colors[roleName] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiUsers size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Admin Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage admin accounts and access
            </p>
          </div>
          <button
            onClick={() => fetchAdmins()}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {(hasActionPermission("createAdmin") ||
          hasButtonAccess("createAdmin")) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition"
          >
            <FiPlus size={14} /> Create New Admin
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setCurrentPage(1);
              fetchAdmins(1);
            }}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <FiFilter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
              fetchAdmins(1);
            }}
            className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          <FiRefreshCw size={16} className="animate-spin mr-2" /> Loading
          admins...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
          <table className="w-full text-sm" style={{ minWidth: "700px" }}>
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50">
                {[
                  "Name",
                  "Employee #",
                  "Email",
                  "Phone",
                  "Role",
                  "Status",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 text-left"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-gray-400"
                  >
                    No admins found
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr
                    key={admin.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">
                      {admin.firstName} {admin.lastName}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">
                      {admin.employeeNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {admin.email}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {admin.phoneNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getRoleBadgeColor(admin.role?.name || "")}`}
                      >
                        {admin.role?.displayName ||
                          admin.role?.name ||
                          "No Role"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${admin.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}
                      >
                        {admin.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {admin.createdAt
                        ? new Date(admin.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openIdCardModal(admin)}
                          title="View ID Card"
                          className="px-2 py-1 rounded-lg text-xs font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                        >
                          🆔
                        </button>
                        {(hasActionPermission("editAdmin") ||
                          hasButtonAccess("editAdmin")) && (
                          <button
                            onClick={() => openEditModal(admin)}
                            title="Edit"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition"
                          >
                            <FiEdit size={13} />
                          </button>
                        )}
                        {(hasActionPermission("deleteAdmin") ||
                          hasButtonAccess("deleteAdmin")) && (
                          <button
                            onClick={() =>
                              admin.id && handleDeleteAdmin(admin.id)
                            }
                            disabled={!admin.id}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => {
                const p = currentPage - 1;
                setCurrentPage(p);
                fetchAdmins(p);
              }}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => {
                const p = currentPage + 1;
                setCurrentPage(p);
                fetchAdmins(p);
              }}
              className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal &&
        (hasActionPermission("createAdmin") || isSuperAdmin()) &&
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
              onClick={() => setShowCreateModal(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "680px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Create New Admin
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <AdminFormFields
                formData={formData}
                handleInputChange={handleInputChange}
                roles={roles}
                errors={errors}
                onSubmit={handleCreateAdmin}
                submitLabel="Create Admin"
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Edit Modal */}
      {showEditModal &&
        (hasActionPermission("editAdmin") || isSuperAdmin()) &&
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
              onClick={() => setShowEditModal(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "680px",
                maxHeight: "90vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-800 m-0">
                  Edit Admin
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                >
                  <FiX size={16} />
                </button>
              </div>
              <AdminFormFields
                formData={formData}
                handleInputChange={handleInputChange}
                roles={roles}
                errors={errors}
                onSubmit={handleEditAdmin}
                submitLabel="Update Admin"
                onCancel={() => setShowEditModal(false)}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Delete Confirm Modal */}
      {showDeleteModal &&
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
              onClick={() => setShowDeleteModal(false)}
            />
            <div
              style={{
                position: "relative",
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "400px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                padding: "28px",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <FiAlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-800 m-0 mb-2">
                    Delete Admin
                  </h3>
                  <p className="text-sm text-gray-500 m-0">
                    Are you sure you want to delete this admin? This action
                    cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAdmin}
                  disabled={deleteSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {deleteSubmitting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ID Card Modal */}
      {showIdCardModal && selectedAdmin && (
        <IdCardModal
          isOpen={showIdCardModal}
          onClose={() => {
            setShowIdCardModal(false);
            setSelectedAdmin(null);
          }}
          admin={selectedAdmin}
        />
      )}
    </div>
  );
};

export default AdminManagement;

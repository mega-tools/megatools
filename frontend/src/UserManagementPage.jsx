import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import { useAuth } from "./AuthContext";

export default function UserManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";

  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user", status: "active", phone: "", facebook: "", trackingCode: "", referralCode: "" });
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, moderators: 0 });
  const [showRefModal, setShowRefModal] = useState(false);
  const [showActive, setShowActive] = useState(false);
  const [allRefCodes, setAllRefCodes] = useState([]);
  const [refCount, setRefCount] = useState(1);
  const [generatedCode, setGeneratedCode] = useState("");

  const loadUsers = useCallback(() => {
    api.get("/admin/users").then(r => {
      const data = r.data.users || [];
      setUsers(data);
      setStats({
        total: data.length,
        active: data.filter(u => u.status === "active").length,
        blocked: data.filter(u => u.status === "blocked").length,
        moderators: data.filter(u => u.role === "moderator").length
      });
    }).catch(() => {});
  }, []);

  const loadRefCodes = useCallback(() => {
    api.get("/auth/referrals").then(r => {
      const all = r.data || [];
      setAllRefCodes(all.filter(rc => rc.type === "moderator"));
    }).catch(() => {});
  }, []);

  useEffect(() => { loadUsers(); loadRefCodes(); }, [loadUsers, loadRefCodes]);

  const resetForm = () => {
    const autoRef = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setForm({ name: "", email: "", password: "", role: "user", status: "active", phone: "", facebook: "", trackingCode: "", referralCode: autoRef });
    setEditingUser(null);
    setShowForm(false);
  };

  const handleEdit = (u) => {
    setForm({ name: u.name || "", email: u.email || "", password: "", role: u.role || "user", status: u.status || "active", phone: u.phone || "", facebook: u.facebook || "", trackingCode: u.trackingCode || "", referralCode: u.referralCode || "" });
    setEditingUser(u);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return;
    try {
      if (editingUser) {
        await api.put("/admin/users/" + editingUser._id, form);
      } else {
        if (!form.password || form.password.length < 6) return alert("Password must be at least 6 characters");
        await api.post("/admin/users", form);
      }
      resetForm(); loadUsers();
    } catch (e) { console.error(e); }
  };

  const handleBlock = async (u) => {
    const newStatus = u.status === "blocked" ? "active" : "blocked";
    try { 
      await api.patch("/admin/users/" + u._id + "/" + (newStatus === "blocked" ? "block" : "unblock")); 
      loadUsers(); 
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm("Delete user: " + u.email + "?")) return;
    try { await api.delete("/admin/users/" + u._id); loadUsers(); } catch (e) { console.error(e); }
  };

  const handleGenerateRef = async () => {
    try {
      await api.post("/auth/generate-referral", { count: refCount, type: "moderator" });
      const res = await api.post("/auth/generate-referral", { count: refCount, type: "moderator" });
      const codes = res.data.codes || [];
      if (codes.length === 1) setGeneratedCode(codes[0]);
      loadRefCodes();
    } catch (e) { console.error(e); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setGeneratedCode("");
  };

  const canEdit = (u) => {
    if (isAdmin) return true;
    if (isModerator && u.parentId === user?._id) return true;
    return false;
  };

  const canManage = isAdmin || isModerator;

  const getCreatedByName = (u) => {
    if (!u.createdBy && !u.parentId) return "—";
    const creator = users.find(x => x._id === (u.createdBy || u.parentId));
    return creator ? creator.name || creator.username || "—" : "—";
  };

  if (!canManage) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Access denied. Admin or Moderator only.</div>;
  }

  return (
    <div style={{ padding: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>👥 Users Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Manage all users</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {isAdmin && (
            <button onClick={() => { loadRefCodes(); setGeneratedCode(""); setShowRefModal(true); }}
              style={{ padding: "10px 16px", fontSize: 12, fontWeight: 600, background: "var(--purple-bg)", color: "var(--purple)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 8, cursor: "pointer" }}>🎫 Referral Codes</button>
          )}
          <button onClick={() => { resetForm(); setShowForm(true); }}
            style={{ padding: "10px 18px", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#0F172A", border: "1px solid var(--accent)", borderRadius: 8, cursor: "pointer" }}>+ Add User</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
        {[{ label: "Total Users", value: stats.total, color: "var(--accent)" },{ label: "Active", value: stats.active, color: "var(--success)" },{ label: "Blocked", value: stats.blocked, color: "var(--danger)" },{ label: "Moderators", value: stats.moderators, color: "var(--purple)" }].map((s, i) => (
          <div key={i} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: "18px 14px", textAlign: "center", boxShadow: "var(--card-shadow)" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral Code Modal — Admin only, Moderator type only */}
      {showRefModal && isAdmin && (
        <div onClick={() => setShowRefModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, padding: 24, width: 650, maxWidth: "95%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>🎫 Referral Codes</h3>
              <button onClick={() => setShowRefModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Generate Section */}
            <div style={{ background: "var(--bg-secondary)", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>Generate New Moderator Code</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Moderator</span>
                <input type="number" min="1" max="10" value={refCount} onChange={e => setRefCount(parseInt(e.target.value) || 1)} style={{ width: 60, padding: "8px", background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: 6, fontSize: 12, textAlign: "center" }} />
                <button onClick={handleGenerateRef} style={{ padding: "8px 16px", background: "var(--purple)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Generate</button>
              </div>
              {generatedCode && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: "rgba(167,139,250,0.1)", padding: "10px 14px", borderRadius: 6 }}>
                  <code style={{ fontSize: 16, fontWeight: 700, color: "var(--purple)", fontFamily: "monospace" }}>{generatedCode}</code>
                  <button onClick={() => copyCode(generatedCode)} style={{ padding: "6px 12px", background: "var(--accent)", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Copy</button>
                </div>
              )}
            </div>

            {/* Toggle: Active / Pending */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setShowActive(true)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--card-border)", background: showActive ? "var(--success)" : "transparent", color: showActive ? "#000" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Active</button>
              <button onClick={() => setShowActive(false)} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--card-border)", background: !showActive ? "var(--warning)" : "transparent", color: !showActive ? "#000" : "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Pending</button>
            </div>

            {/* Table */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: "1px solid var(--table-border)" }}><th style={{ padding: "8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Code</th><th style={{ padding: "8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Status</th></tr></thead>
              <tbody>
                {allRefCodes.filter(rc => showActive ? rc.used : !rc.used).length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}>No codes</td></tr>}
                {allRefCodes.filter(rc => showActive ? rc.used : !rc.used).map((rc, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--table-border)" }}>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 12, color: "var(--accent)" }}>{rc.code}</td>
                    <td style={{ padding: "6px 8px", fontSize: 11, fontWeight: 600, color: rc.used ? "var(--success)" : "var(--warning)" }}>{rc.used ? "Active" : "Pending"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit User Form */}
      {showForm && (
        <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: "var(--card-shadow)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 12, textTransform: "uppercase" }}>{editingUser ? "Edit User" : "Add New User"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} />
            <input placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inp} />
            {!editingUser && <input placeholder="Password *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} style={inp} />}
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inp} />
            <input placeholder="Facebook" value={form.facebook} onChange={e => setForm({ ...form, facebook: e.target.value })} style={inp} />
            {isAdmin && <input placeholder="Tracking Code" value={form.trackingCode} onChange={e => setForm({ ...form, trackingCode: e.target.value })} style={inp} />}
            <input placeholder="Referral Code" value={form.referralCode} readOnly style={{ ...inp, opacity: 0.7 }} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={resetForm} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "var(--btn-bg)", color: "var(--btn-text)", border: "1px solid var(--btn-border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#0F172A", border: "1px solid var(--accent)", borderRadius: 8, cursor: "pointer" }}>{editingUser ? "Update" : "Create"}</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div style={{ background: "var(--card-bg)", borderRadius: 12, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--table-border)" }}>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: "left" }}>Name</th>
                <th style={{ ...th, textAlign: "left" }}>Email</th>
                <th style={{ ...th, textAlign: "left" }}>Phone</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "left" }}>Tracking Code</th>
                <th style={{ ...th, textAlign: "left" }}>Referral Code</th>
                <th style={{ ...th, textAlign: "left" }}>Created By</th>
                <th style={th}>Profile</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 12 }}>No users found</td></tr>}
              {users.map((u, i) => (
                <tr key={u._id} style={{ borderBottom: "1px solid var(--table-border)", height: 44 }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--table-hover)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ ...td, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 500 }}>{u.name}</td>
                  <td style={{ ...td, textAlign: "left", color: "var(--text-muted)" }}>{u.email}</td>
                  <td style={{ ...td, textAlign: "center", fontSize: 11 }}>{u.phone || "—"}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: u.role === "admin" ? "var(--purple-bg)" : u.role === "moderator" ? "var(--warning-bg)" : "var(--info-bg)", color: u.role === "admin" ? "var(--purple)" : u.role === "moderator" ? "var(--warning)" : "var(--info)" }}>{u.role}</span>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: u.status === "active" ? "var(--success-bg)" : "var(--danger-bg)", color: u.status === "active" ? "var(--success)" : "var(--danger)" }}>{u.status}</span>
                  </td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontSize: 10 }}>{u.trackingCode || "—"}</td>
                  <td style={{ ...td, textAlign: "left", fontFamily: "monospace", fontSize: 10, color: u.referralCode ? "var(--purple)" : "var(--text-muted)" }}>{u.referralCode || "—"}</td>
                  <td style={{ ...td, textAlign: "left", fontSize: 11, color: "var(--text-muted)" }}>{getCreatedByName(u)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <button onClick={() => window.open("/login/" + (u.username || u.email.split('@')[0]), "_blank")} style={{ background: "var(--accent)", color: "#0F172A", border: "none", cursor: "pointer", fontSize: 10, padding: "4px 10px", borderRadius: 4, fontWeight: 600 }}>View</button>
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                      {canEdit(u) && (
                        <button onClick={() => handleEdit(u)} style={{ background: "transparent", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer", fontSize: 9, padding: "3px 7px", borderRadius: 4, fontWeight: 600 }}>Edit</button>
                      )}
                      {canEdit(u) && (
                        <button onClick={() => handleBlock(u)} style={{ background: "transparent", border: "1px solid var(--warning)", color: "var(--warning)", cursor: "pointer", fontSize: 9, padding: "3px 7px", borderRadius: 4, fontWeight: 600 }}>
                          {u.status === "blocked" ? "Unblock" : "Block"}
                        </button>
                      )}
                      {((isAdmin && u.role !== "admin") || (isModerator && u.parentId === user?._id)) && (
                        <button onClick={() => handleDelete(u)} style={{ background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", cursor: "pointer", fontSize: 9, padding: "3px 7px", borderRadius: 4, fontWeight: 600 }}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th = { padding: "10px 8px", fontSize: 9, textAlign: "center", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const td = { padding: "6px 8px", fontSize: 11, color: "var(--text)" };
const inp = { width: "100%", padding: "10px 12px", fontSize: 12, background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: 8 };
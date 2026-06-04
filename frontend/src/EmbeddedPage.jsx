import React, { useState, useEffect } from "react";
import api from "./api";

const ALL_IN_ONE = `/* ═══════════════════════════════════════════════════════════
   Mega Tools v2.0 — COMPLETE PAGE KIT
   Copy EVERYTHING below — CSS + HTML + Rules + AI Prompt
   ═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────
   STEP 1: COMPLETE CSS (Copy All)
   ───────────────────────────────────── */
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#0d1117;color:#c9d1d9;min-height:100vh;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-y:auto}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:#0d1117}
::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#484f58}
.card{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:20px;margin-bottom:16px}
.btn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;white-space:nowrap}
.btn:hover:not(:disabled){transform:translateY(-1px)}
.btn-primary{background:#238636;color:#fff}.btn-primary:hover:not(:disabled){background:#2ea043;box-shadow:0 4px 12px rgba(35,134,54,0.3)}
.btn-success{background:#238636;color:#fff}.btn-success:hover:not(:disabled){background:#2ea043}
.btn-danger{background:#da3633;color:#fff}.btn-danger:hover:not(:disabled){background:#f85149}
.btn-outline{background:transparent;border:1px solid #30363d;color:#c9d1d9}.btn-outline:hover:not(:disabled){background:#21262d;border-color:#58a6ff}
table{width:100%;border-collapse:collapse}
thead th{text-align:left;padding:11px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#8b949e;border-bottom:1px solid #21262d;background:#1c2128;font-weight:600}
tbody td{padding:11px 14px;font-size:13px;border-bottom:1px solid #21262d;color:#c9d1d9}
tbody tr:hover td{background:#1c2128}
input,select,textarea{width:100%;padding:10px 12px;background:#0d1117;color:#c9d1d9;border:1px solid #30363d;border-radius:6px;font-size:13px;outline:none;font-family:inherit;transition:border-color 0.2s}
input:focus,select:focus,textarea:focus{border-color:#58a6ff;box-shadow:0 0 0 3px rgba(88,166,255,0.1)}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600}
.badge-success{background:rgba(35,134,54,0.15);color:#3fb950}
.badge-danger{background:rgba(218,54,51,0.15);color:#f85149}
.badge-warning{background:rgba(210,153,34,0.15);color:#d29922}
.badge-info{background:rgba(88,166,255,0.15);color:#58a6ff}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat-card{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:18px 16px;text-align:center}
.stat-value{font-size:28px;font-weight:700;margin-bottom:4px}
.stat-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#8b949e;font-weight:600}
.page-header{margin-bottom:24px}
.page-header h2{font-size:22px;font-weight:700;color:#e6edf3;margin-bottom:4px}
.page-header p{color:#8b949e;font-size:12px}
.flex{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:768px){.grid-2{grid-template-columns:1fr}}

/* ─────────────────────────────────────
   STEP 2: HTML TEMPLATE (Customize Below)
   ───────────────────────────────────── */
/*
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="robots" content="noindex,nofollow"><title>Your Page</title><style>PASTE CSS HERE</style></head>
<body><div class="page-header"><h2>Title</h2></div><div class="stat-grid"><div class="stat-card"><div class="stat-value" style="color:#3b82f6">0</div></div></div><div class="card"><h3>Section</h3></div><div class="card"><div class="grid-2"><input placeholder="Field 1" /><input placeholder="Field 2" /></div><button class="btn btn-success">Submit</button></div></body></html>
*/

/* ─────────────────────────────────────
   STEP 3: AI PROMPT
   ─────────────────────────────────────
Build a complete dark-themed HTML page for Mega Tools Dashboard.
Use ONLY the CSS provided below. Include page header, stat cards, content card, table, and form.
No external frameworks. Font: Segoe UI. Scrollbar 6px thin.
---PASTE COMPLETE CSS FROM STEP 1---
*/`;

export default function EmbeddedPage() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [showKit, setShowKit] = useState(false);
  const [singleForm, setSingleForm] = useState({ buttonName: "", pageUrl: "", addToGroupId: "" });

  const FIXED_GROUPS = [
    { id: "mega-tools", name: "Mega Tools" },
    { id: "mega-service", name: "Mega Service" }
  ];

  const loadItems = () => {
    api.get("/admin/menu-items").then(r => {
      const allItems = r.data || [];
      const grouped = {};
      const singles = [];
      allItems.forEach(item => {
        if (item.groupId && item.buttonName) {
          if (!grouped[item.groupId]) grouped[item.groupId] = { _id: item.groupId, groupName: item.groupName || (item.groupId === "mega-tools" ? "Mega Tools" : "Mega Service"), buttons: [] };
          grouped[item.groupId].buttons.push(item);
        } else if (item.buttonName && !item.groupId) {
          singles.push(item);
        }
      });
      setItems([...Object.values(grouped), ...singles]);
    }).catch(() => {});
  };
  useEffect(loadItems, []);

  const addButton = () => {
    if (!singleForm.buttonName || !singleForm.pageUrl) { setMsg("Name and URL required"); setTimeout(() => setMsg(""), 3000); return; }
    const payload = {
      buttonName: singleForm.buttonName,
      pageUrl: singleForm.pageUrl,
      location: "sidebar"
    };
    if (singleForm.addToGroupId) {
      const grp = FIXED_GROUPS.find(g => g.id === singleForm.addToGroupId);
      payload.groupId = singleForm.addToGroupId;
      payload.groupName = grp ? grp.name : '';
    }
    api.post("/admin/menu-items", payload).then(() => {
      setSingleForm({ buttonName: "", pageUrl: "", addToGroupId: "" });
      setShowForm(false);
      setMsg(singleForm.addToGroupId ? "Added to " + (FIXED_GROUPS.find(g => g.id === singleForm.addToGroupId)?.name || "group") + "!" : "Button added!");
      setTimeout(() => setMsg(""), 2000);
      loadItems();
    });
  };

  const handleDelete = (item) => {
    if (item.groupName) {
      if (!window.confirm("Delete all buttons in " + item.groupName + "?")) return;
      Promise.all(item.buttons.map(b => api.delete("/admin/menu-items/" + b._id))).then(() => { setMsg("Deleted"); loadItems(); });
    } else {
      if (!window.confirm("Remove this button?")) return;
      api.delete("/admin/menu-items/" + item._id).then(() => { setMsg("Removed"); loadItems(); });
    }
  };

  const copyKit = () => { navigator.clipboard.writeText(ALL_IN_ONE); setMsg("Kit copied!"); setTimeout(() => setMsg(""), 2000); };

  const msgStyle = (g) => ({ background: g ? "var(--success-bg)" : "var(--danger-bg)", color: g ? "var(--success)" : "var(--danger)", padding: "8px 14px", borderRadius: 6, marginBottom: 14, fontSize: 11, textAlign: "center" });
  const labelStyle = { color: "var(--text-muted)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block", fontWeight: 500 };
  const inp = { width: "100%", padding: "6px 8px", border: "1px solid var(--input-border)", borderRadius: 4, outline: "none", fontSize: 10, background: "var(--input-bg)", color: "var(--text)" };

  return (
    <div>
      <div className="page-header"><h2>📌 Embedded Pages</h2><p>Add buttons to Mega Tools or Mega Service dropdown groups, or as single sidebar buttons.</p></div>
      {msg && <div style={msgStyle(!msg.includes('Error'))}>{msg}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => { setSingleForm({ buttonName: "", pageUrl: "", addToGroupId: "" }); setShowForm(true); }} className="btn btn-primary btn-sm">+ Add Button</button>
        <button onClick={() => setShowKit(!showKit)} className="btn btn-outline btn-sm">{showKit ? 'Hide' : 'Show'} Page Kit</button>
        {showKit && <button onClick={copyKit} className="btn btn-outline btn-sm" style={{ background: "#f59e0b", color: "#000", border: "none" }}>📋 Copy Kit</button>}
      </div>

      {showKit && (
        <div className="card" style={{ marginBottom: 14, borderLeft: "3px solid #f59e0b" }}>
          <h3 style={{ color: "#f59e0b", fontSize: 13, marginBottom: 8 }}>📦 Complete Page Kit</h3>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8 }}>CSS + HTML Template + AI Prompt</p>
          <pre style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 6, fontSize: 9, color: "var(--text-muted)", maxHeight: 350, overflow: "auto", whiteSpace: "pre-wrap", border: "1px solid var(--card-border)", fontFamily: "'Consolas', monospace", lineHeight: 1.4 }}>{ALL_IN_ONE}</pre>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--card-border)" }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Add Sidebar Button</h3>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>×</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelStyle}>Button Name *</label><input value={singleForm.buttonName} onChange={e => setSingleForm({ ...singleForm, buttonName: e.target.value })} style={inp} placeholder="My Page" /></div>
            <div><label style={labelStyle}>Page URL *</label><input value={singleForm.pageUrl} onChange={e => setSingleForm({ ...singleForm, pageUrl: e.target.value })} style={inp} placeholder="https://..." /></div>
            <div>
              <label style={labelStyle}>Add to Group</label>
              <select value={singleForm.addToGroupId} onChange={e => setSingleForm({ ...singleForm, addToGroupId: e.target.value })} style={inp}>
                <option value="">— Single (no group) —</option>
                {FIXED_GROUPS.map(g => <option key={g.id} value={g.id}>📁 {g.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">Cancel</button>
            <button onClick={addButton} className="btn btn-success btn-sm">Save</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--card-border)" }}><h3 style={{ color: "var(--text)", fontSize: 13, fontWeight: 600, margin: 0 }}>Sidebar Items ({items.length})</h3></div>
        <table>
          <thead><tr><th style={{ width: 30 }}>#</th><th>Name</th><th style={{ width: 80, textAlign: "center" }}>Type</th><th style={{ width: 100, textAlign: "center" }}>Actions</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 11 }}>No buttons yet</td></tr>}
            {items.map((item, idx) => (
              <tr key={item._id || idx}>
                <td style={{ color: "var(--text-muted)", fontSize: 10, textAlign: "center" }}>{idx + 1}</td>
                <td>
                  {item.groupName ? (
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: 11 }}>📂 {item.groupName}</span>
                      <div style={{ marginTop: 3, paddingLeft: 8 }}>
                        {item.buttons.filter(b => b.buttonName).length > 0 ? (
                          item.buttons.filter(b => b.buttonName).map(b => (
                            <div key={b._id} style={{ fontSize: 9, color: "var(--text-muted)" }}>↳ {b.buttonName}</div>
                          ))
                        ) : (
                          <div style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>No buttons</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 500, fontSize: 11 }}>{item.buttonName}</span>
                  )}
                </td>
                <td style={{ textAlign: "center" }}>
                  <span className={`badge ${item.groupName ? 'badge-info' : 'badge-success'}`} style={{ fontSize: 9 }}>{item.groupName ? 'Dropdown' : 'Single'}</span>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button onClick={() => handleDelete(item)} className="btn btn-danger btn-sm" style={{ fontSize: 9, padding: "3px 7px" }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
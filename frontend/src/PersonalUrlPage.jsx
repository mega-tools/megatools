import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import { useAuth } from "./AuthContext";

export default function PersonalUrlPage() {
  const { user } = useAuth();
  const userTrackingCode = user?.trackingCode || "";

  const [links, setLinks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [form, setForm] = useState({ name: "", baseUrl: "", customSlug: "" });

  const loadLinks = useCallback(() => { api.get("/links").then(r => setLinks(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { loadLinks(); }, [loadLinks]);

  const personalLinks = links.filter(l => l.category === "personal" && l.ownerId === user?._id);

  const resetForm = () => { setForm({ name: "", baseUrl: "", customSlug: "" }); setEditingLink(null); setShowForm(false); };
  
  const handleEdit = (link) => { 
    const fullUrl = link.baseUrl || "";
    const parts = fullUrl.split("/");
    const customPart = parts.length > 3 ? parts.slice(3).join("/") : "";
    
    setForm({ 
      name: link.name||"", 
      baseUrl: parts.slice(0, 3).join("/") || fullUrl, 
      customSlug: customPart
    }); 
    setEditingLink(link); 
    setShowForm(true); 
  };
  
  const handleSave = async () => {
    if (!form.name) { alert("Name is required"); return; }
    if (!form.baseUrl) { alert("Deployed URL is required"); return; }
    
    let finalUrl = form.baseUrl.replace(/\/$/, "");
    if (form.customSlug && form.customSlug.trim()) {
      finalUrl += "/" + form.customSlug.trim().replace(/^\/+/, "");
    }
    
    const payload = { 
      name: form.name, 
      baseUrl: finalUrl, 
      category: "personal", 
      inboxView: "personal", 
      showInInbox: false 
    };
    
    try { 
      if (editingLink) {
        await api.put("/links/"+editingLink._id, payload);
      } else {
        await api.post("/links", payload);
      }
      resetForm(); 
      loadLinks(); 
    } catch (e) { 
      console.error(e); 
      alert("Failed to save"); 
    }
  };
  
  const handleDelete = async (link) => { 
    if (!window.confirm("Delete this link?")) return; 
    try { 
      await api.delete("/links/"+link._id); 
      loadLinks(); 
    } catch (e) { 
      console.error(e); 
    } 
  };

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🔒 All My Personal URL</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Your private links — only visible to you · Tracking: <code style={{ color: "var(--accent)", fontWeight: 600 }}>{userTrackingCode}</code>
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, background: "#10b981", color: "#fff", border: "1px solid #10b981", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add Personal URL</button>
      </div>

      {/* POPUP MODAL FORM */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, padding: 28, width: 560, maxWidth: "92%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#10b981" }}>
                {editingLink ? "Edit" : "Add"} Personal URL
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                {editingLink ? "Update your private link" : "Create a new private link for your visitors"}
              </p>
            </div>

            {/* Name Field */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Name *</label>
              <input placeholder="e.g. My Maps Page" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} />
            </div>

            {/* Deployed URL Field */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Deployed URL *</label>
              <input placeholder="https://my-site.netlify.app" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} style={inp} />
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                Paste the URL from Netlify/Vercel after deploying your HTML file
              </div>
            </div>

            {/* Custom Path Field */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Custom Path (Optional)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 0, background: "var(--input-bg)", borderRadius: 8, border: "1px solid var(--input-border)", overflow: "hidden" }}>
                <span style={{ padding: "14px 8px 14px 16px", fontSize: 13, color: "var(--text-muted)", fontFamily: "monospace", whiteSpace: "nowrap", background: "var(--bg-secondary)" }}>
                  {(form.baseUrl || "https://...").replace(/\/$/, "")}/
                </span>
                <input 
                  placeholder="my-custom-path" 
                  value={form.customSlug} 
                  onChange={e => setForm({ ...form, customSlug: e.target.value.replace(/\s/g, "-") })}
                  style={{ flex: 1, padding: "14px 16px", fontSize: 14, background: "transparent", color: "var(--accent)", border: "none", outline: "none", fontFamily: "monospace" }} 
                />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                Add a custom ending to your URL for easy sharing
              </div>
            </div>

            {/* Preview */}
            {form.baseUrl && (
              <div style={{ marginBottom: 16, padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 10, color: "#166534", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>🔗 Final URL Preview</div>
                <code style={{ fontSize: 13, color: "#166534", wordBreak: "break-all", fontWeight: 600 }}>
                  {form.baseUrl.replace(/\/$/, "")}/{form.customSlug || ""}
                </code>
              </div>
            )}

            {/* Info Box */}
            <div style={{ marginBottom: 20, padding: 10, background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--card-border)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text)" }}>💡 How it works:</strong><br />
              1. Download HTML from All External URL page<br />
              2. Deploy to Netlify/Vercel<br />
              3. Paste the deployed URL here<br />
              4. Add a custom path (optional)<br />
              5. Share the final URL with visitors
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetForm} style={{ flex: 1, padding: "12px", fontSize: 13, fontWeight: 600, background: "var(--bg-secondary)", color: "var(--text)", border: "1px solid var(--card-border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 2, padding: "12px", fontSize: 14, fontWeight: 600, background: "#10b981", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span>{editingLink ? "💾" : "✨"}</span> {editingLink ? "Update Link" : "Create Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--table-border)" }}>
          <th style={th}>#</th>
          <th style={{ ...th, textAlign: "left" }}>Name</th>
          <th style={{ ...th, textAlign: "left" }}>Full URL</th>
          <th style={th}>Action</th>
        </tr></thead>
          <tbody>{personalLinks.length===0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>No personal links yet. Click "+ Add Personal URL" to create one.</td></tr>}
          {personalLinks.map((link, i) => (
            <tr key={link._id} style={{borderBottom:"1px solid var(--table-border)",height:56}} onMouseEnter={e=>e.currentTarget.style.background="var(--table-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{...td,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>{i+1}</td>
              <td style={{...td,textAlign:"left",fontWeight:600,fontSize:14}}>{link.name}</td>
              <td style={{...td,textAlign:"left",fontFamily:"monospace",fontSize:13,color:"var(--accent)",wordBreak:"break-all"}}>{link.baseUrl||"—"}</td>
              <td style={{...td,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={()=>handleEdit(link)} style={{background:"transparent",border:"1px solid var(--accent)",color:"var(--accent)",cursor:"pointer",fontSize:13,padding:"6px 12px",borderRadius:5,fontWeight:600}}>✏️</button><button onClick={()=>handleDelete(link)} style={{background:"transparent",border:"1px solid var(--danger)",color:"var(--danger)",cursor:"pointer",fontSize:13,padding:"6px 12px",borderRadius:5,fontWeight:600}}>🗑️</button></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

const th = { padding: "14px 10px", fontSize: 12, textAlign: "center", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
const td = { padding: "10px 10px", fontSize: 14, color: "var(--text)", lineHeight: "1.6" };
const lbl = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "14px 16px", fontSize: 14, background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: 8 };
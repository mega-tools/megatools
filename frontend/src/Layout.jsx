import React, { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import api from "./api";

export default function Layout() {
  const { user, logout, unseenLinkCount, markLinksSeen, unseenMegaToolsCount, markMegaToolsSeen, unseenMegaServiceCount, markMegaServiceSeen, showBadge, setShowBadge } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuItems, setMenuItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const dropdownRef = useRef(null);
  const [openGroups, setOpenGroups] = useState({});
  const [iframeUrl, setIframeUrl] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => { api.get("/admin/menu-items").then(res => setMenuItems(res.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const groupedItems = {};
  const sidebarSingles = [];
  menuItems.forEach(item => {
    if (item.groupId) {
      if (!groupedItems[item.groupId]) groupedItems[item.groupId] = { groupName: item.groupName || (item.groupId === "mega-tools" ? "Mega Tools" : "Mega Service"), buttons: [] };
      groupedItems[item.groupId].buttons.push(item);
    } else {
      sidebarSingles.push(item);
    }
  });

  const toggleGroup = (groupId) => { setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };

  const allMenuItems = [
    { label: "Visitor Management", path: "/live-inbox", roles: ["admin", "moderator", "user"], icon: "▦", badgeKey: "visitor" },
    { label: "All External URL", path: "/links", roles: ["admin", "moderator", "user"], icon: "🌐", badgeKey: "links" },
    { label: "All My Personal URL", path: "/personal-links", roles: ["admin", "moderator", "user"], icon: "🔒" },
    { label: "Users Management", path: "/users", roles: ["admin", "moderator"], icon: "▥" },
    { label: "Embedded Page", path: "/embedded", roles: ["admin"], icon: "▣" },
  ];

  const isActive = (path) => location.pathname === path;
  const isMobile = window.innerWidth < 1024;
  const sidebarW = !isMobile && sidebarOpen ? 240 : 0;

  const getRoleBadge = () => {
    if (user?.role === "admin") return { label: "Admin", bg: "var(--purple-bg)", color: "var(--purple)" };
    if (user?.role === "moderator") return { label: "Moderator", bg: "var(--warning-bg)", color: "var(--warning)" };
    return { label: "User", bg: "var(--info-bg)", color: "var(--info)" };
  };

  const getStatusText = () => {
    if (user?.role === "admin") return "Administrator";
    if (user?.role === "moderator") return "Moderator";
    return "Standard User";
  };

  const getStatusColor = () => {
    if (user?.role === "admin") return "var(--success)";
    if (user?.role === "moderator") return "var(--warning)";
    return "var(--accent)";
  };

  const roleBadge = getRoleBadge();

  const sidebarContent = (
    <div style={{ minWidth: 240, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <img src="/logo.webp" alt="Mega Tools" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px" }}>Mega Tools</div>
          <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500, marginTop: 1 }}>Visitor Management System</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px" }}>
        <div style={sectionLabel}>Main Menu</div>
        {allMenuItems.filter(n => n.roles.includes(user?.role)).map(item => (
          <div key={item.path} onClick={() => { navigate(item.path); setIframeUrl(null); setMobileMenuOpen(false); if (item.badgeKey === "visitor") setShowBadge(false); if (item.badgeKey === "links") markLinksSeen(); }}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "2px 0", borderRadius: 8, cursor: "pointer", background: isActive(item.path) ? "rgba(99,102,241,0.15)" : "transparent", color: isActive(item.path) ? "#fff" : "#CBD5E1", fontSize: 13, fontWeight: isActive(item.path) ? 600 : 400, transition: "all 0.2s ease", position: "relative" }}>
            <span style={{ fontSize: 16, width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{item.icon}</span>{item.label}
            {item.badgeKey === "visitor" && showBadge && (<span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>NEW</span>)}
            {item.badgeKey === "links" && unseenLinkCount > 0 && (<span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>{unseenLinkCount}</span>)}
          </div>
        ))}
        <div style={sectionLabel}>More</div>
        <div style={{ marginTop: 2 }}>
          <div onClick={() => { toggleGroup("mega-tools"); markMegaToolsSeen(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "2px 0", borderRadius: 8, cursor: "pointer", color: "#CBD5E1", fontSize: 13, fontWeight: 500, transition: "all 0.2s ease", position: "relative" }}>
            <span style={{ fontSize: 14 }}>{openGroups["mega-tools"] ? "📂" : "📁"}</span>Mega Tools
            {unseenMegaToolsCount > 0 && (<span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>{unseenMegaToolsCount}</span>)}
            <span style={{ marginLeft: "auto", fontSize: 10, transition: "transform 0.2s", transform: openGroups["mega-tools"] ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
          {openGroups["mega-tools"] && (
            <div style={{ paddingLeft: 18 }}>
              {groupedItems["mega-tools"]?.buttons.filter(b => b.buttonName).length > 0 ? groupedItems["mega-tools"].buttons.filter(b => b.buttonName).map(b => (
                <div key={b._id} onClick={() => { setIframeUrl(b.pageUrl); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", margin: "1px 0", borderRadius: 6, cursor: "pointer", color: "#94A3B8", fontSize: 12, transition: "all 0.15s ease" }}>↳ {b.buttonName}</div>
              )) : (<div style={{ padding: "6px 12px", color: "#64748B", fontSize: 11, fontStyle: "italic" }}>No buttons yet</div>)}
            </div>
          )}
        </div>
        <div style={{ marginTop: 2 }}>
          <div onClick={() => { toggleGroup("mega-service"); markMegaServiceSeen(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "2px 0", borderRadius: 8, cursor: "pointer", color: "#CBD5E1", fontSize: 13, fontWeight: 500, transition: "all 0.2s ease", position: "relative" }}>
            <span style={{ fontSize: 14 }}>{openGroups["mega-service"] ? "📂" : "📁"}</span>Mega Service
            {unseenMegaServiceCount > 0 && (<span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>{unseenMegaServiceCount}</span>)}
            <span style={{ marginLeft: "auto", fontSize: 10, transition: "transform 0.2s", transform: openGroups["mega-service"] ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
          </div>
          {openGroups["mega-service"] && (
            <div style={{ paddingLeft: 18 }}>
              {groupedItems["mega-service"]?.buttons.filter(b => b.buttonName).length > 0 ? groupedItems["mega-service"].buttons.filter(b => b.buttonName).map(b => (
                <div key={b._id} onClick={() => { setIframeUrl(b.pageUrl); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", margin: "1px 0", borderRadius: 6, cursor: "pointer", color: "#94A3B8", fontSize: 12, transition: "all 0.15s ease" }}>↳ {b.buttonName}</div>
              )) : (<div style={{ padding: "6px 12px", color: "#64748B", fontSize: 11, fontStyle: "italic" }}>No buttons yet</div>)}
            </div>
          )}
        </div>
        {sidebarSingles.filter(m => m.buttonName).length > 0 && (
          <div style={{ marginTop: 6 }}>
            {sidebarSingles.filter(m => m.buttonName).map(m => (
              <div key={m._id} onClick={() => { setIframeUrl(m.pageUrl); setMobileMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", margin: "2px 0", borderRadius: 8, cursor: "pointer", color: "#94A3B8", fontSize: 13, transition: "all 0.15s ease" }}>▤ {m.buttonName}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#94A3B8", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: getStatusColor(), display: "inline-block" }}></span>
        {getStatusText()}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && (
        <div style={{ width: sidebarW, background: "linear-gradient(180deg, #1a1f2e 0%, #1E293B 100%)", borderRight: sidebarOpen ? "1px solid rgba(255,255,255,0.08)" : "none", position: "fixed", top: 0, left: 0, height: "100vh", overflowY: "auto", overflowX: "hidden", transition: "width 0.3s ease", zIndex: 100, minWidth: sidebarW, display: "flex", flexDirection: "column" }}>
          {sidebarOpen && sidebarContent}
        </div>
      )}

      {isMobile && mobileMenuOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.7)", zIndex: 999, display: "flex" }}>
          <div style={{ width: 280, background: "linear-gradient(180deg, #1a1f2e 0%, #1E293B 100%)", overflowY: "auto", height: "100vh" }}>
            {sidebarContent}
          </div>
          <div onClick={() => setMobileMenuOpen(false)} style={{ flex: 1 }}></div>
        </div>
      )}

      {!isMobile && (
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ position: "fixed", top: 14, left: sidebarOpen ? 224 : 8, zIndex: 110, background: "#1E293B", border: "1px solid rgba(255,255,255,0.1)", color: "#94A3B8", borderRadius: 6, cursor: "pointer", fontSize: 12, transition: "left 0.3s ease, all 0.2s ease", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          {sidebarOpen ? "◂" : "▸"}
        </button>
      )}

      <div style={{ marginLeft: isMobile ? 0 : sidebarW, flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", transition: "margin-left 0.3s ease", minWidth: 0, background: "var(--bg)" }}>
        <header style={{ background: "var(--header-bg)", padding: "0 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--header-border)", position: "sticky", top: 0, zIndex: 50, height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && <button onClick={() => setMobileMenuOpen(true)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>☰</button>}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Dashboard</span>
            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 500, background: roleBadge.bg, color: roleBadge.color }}>{roleBadge.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleTheme} style={{ fontSize: 15, width: 30, height: 30, background: "transparent", border: "none", cursor: "pointer", borderRadius: 6 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
            {!isMobile && <span style={{ color: "var(--text-muted)", fontSize: 11, fontFamily: "Consolas, monospace", userSelect: "none", background: "var(--bg-secondary)", padding: "3px 8px", borderRadius: 4, border: "1px solid var(--card-border)" }}>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <div onClick={() => setShowDropdown(!showDropdown)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "5px 8px", borderRadius: 8, background: showDropdown ? "var(--menu-hover-bg)" : "transparent", transition: "all 0.2s ease" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{user?.name?.charAt(0)?.toUpperCase() || "?"}</div>
                {!isMobile && <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 500 }}>{user?.name || "User"}</span>}
                <span style={{ color: "var(--text-muted)", fontSize: 9, transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
              </div>
              {showDropdown && (<div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 6, minWidth: 200, zIndex: 200, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", overflow: "hidden" }}>
                <div style={{ padding: "6px 12px 4px 12px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>{user?.name?.charAt(0)?.toUpperCase() || "?"}</div>
                  <div><div style={{ color: "var(--text)", fontWeight: 500, fontSize: 11 }}>{user?.name || "User"}</div><div style={{ fontSize: 9, opacity: 0.7 }}>{user?.email || "Signed In"}</div></div>
                </div>
                <div style={{ height: 1, background: "var(--card-border)", margin: "4px 8px" }}></div>
                <div onClick={() => { navigate("/settings"); setShowDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, color: "var(--text)", fontSize: 12, transition: "all 0.1s ease", display: "flex", alignItems: "center", gap: 8 }}>My Account</div>
                <div style={{ height: 1, background: "var(--card-border)", margin: "4px 8px" }}></div>
                <div onClick={() => { handleLogout(); setShowDropdown(false); }} style={{ padding: "8px 12px", cursor: "pointer", borderRadius: 6, color: "var(--danger)", fontSize: 12, transition: "all 0.1s ease", display: "flex", alignItems: "center", gap: 8 }}>Sign Out</div>
              </div>)}
            </div>
          </div>
        </header>
        {iframeUrl && iframeUrl !== "about:blank" ? (
          <iframe src={iframeUrl} scrolling="auto" style={{ width: "100%", height: "calc(100vh - 52px)", border: "none", display: "block" }} title="External Page" />
        ) : (
          <div style={{ padding: "18px" }}><Outlet /></div>
        )}
      </div>
    </div>
  );
}

const sectionLabel = { color: "#64748B", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, padding: "14px 12px 6px 12px" };
import React, { useState, useEffect } from "react";
import api from "./api";
import { useAuth } from "./AuthContext";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    facebook: user?.facebook || "",
    profilePic: user?.profilePic || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    setMsg("Theme changed to " + newTheme + " mode!");
    setMsgType("success");
    setTimeout(() => setMsg(""), 2000);
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true); setMsg("");
    try {
      await api.put("/auth/profile", profileForm);
      setMsg("Profile updated successfully!"); setMsgType("success");
      await refreshUser();
    } catch (e) {
      setMsg("Error updating profile."); setMsgType("error");
    } finally { setProfileLoading(false); setTimeout(() => setMsg(""), 3000); }
  };

  const changePassword = async (e) => {
    e.preventDefault(); setMsg("");
    if (!passwordForm.currentPassword || !passwordForm.newPassword) { setMsg("Both current and new password are required"); setMsgType("error"); setTimeout(() => setMsg(""), 3000); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setMsg("Passwords do not match"); setMsgType("error"); setTimeout(() => setMsg(""), 3000); return; }
    if (passwordForm.newPassword.length < 6) { setMsg("Password must be at least 6 characters"); setMsgType("error"); setTimeout(() => setMsg(""), 3000); return; }
    setPasswordLoading(true);
    try {
      await api.put("/auth/password", { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setMsg("Password changed successfully!"); setMsgType("success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) { setMsg(e.response?.data?.message || "Error changing password."); setMsgType("error"); }
    finally { setPasswordLoading(false); setTimeout(() => setMsg(""), 4000); }
  };

  const copyCode = (code, label) => { navigator.clipboard.writeText(code); setMsg(label + " copied!"); setMsgType("success"); setTimeout(() => setMsg(""), 2000); };

  const sectionTitleStyle = { color: "var(--text)", fontSize: 15, fontWeight: 600, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--card-border)", display: "flex", alignItems: "center", gap: 8 };
  const labelStyle = { color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block", fontWeight: 500 };
  const infoCard = { background: "var(--bg-secondary)", border: "1px solid var(--card-border)", borderRadius: 8, padding: 16 };
  const msgStyle = { background: msgType === "success" ? "var(--success-bg)" : "var(--danger-bg)", color: msgType === "success" ? "var(--success)" : "var(--danger)", padding: "10px 16px", borderRadius: 6, marginBottom: 20, fontSize: 12, fontWeight: 500, border: "1px solid " + (msgType === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)") };

  return (
    <div>
      <div className="page-header">
        <h2>Account & Settings</h2>
        <p>Manage your profile, security, and preferences</p>
      </div>

      {msg && <div style={msgStyle}>{msg}</div>}

      {/* PREFERENCES */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={sectionTitleStyle}>Preferences</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
          <div style={infoCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>{theme === "dark" ? "Dark" : "Light"} Theme</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Switch between dark and light mode</div>
              </div>
              <button onClick={toggleTheme} className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: "6px 14px" }}>Switch to {theme === "dark" ? "Light" : "Dark"}</button>
            </div>
          </div>
          <div style={infoCard}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 4 }}>Real-time Updates</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Sessions refresh via WebSocket + 10s polling. Sound alerts are always active.</div>
          </div>
        </div>
      </div>

      {/* ACCOUNT INFO */}
      <div className="card">
        <h3 style={sectionTitleStyle}>Account Information</h3>
        <div className="flex items-center gap-4" style={{ paddingBottom: 20, marginBottom: 20, borderBottom: "1px solid var(--card-border)" }}>
          <div>
            {profileForm.profilePic ? (
              <img src={profileForm.profilePic} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--card-border)" }} onError={(e) => (e.target.style.display = "none")} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 600 }}>{user?.name?.charAt(0) || "?"}</div>
            )}
          </div>
          <div style={{ flex: 1 }}><label style={labelStyle}>Profile Picture URL</label><input placeholder="https://example.com/photo.jpg" value={profileForm.profilePic} onChange={(e) => setProfileForm({ ...profileForm, profilePic: e.target.value })} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={infoCard}><div style={labelStyle}>Role</div><span className={"badge " + (user?.role === "admin" ? "badge-info" : user?.role === "moderator" ? "badge-warning" : "badge-neutral")} style={{ fontSize: 12, padding: "4px 12px" }}>{user?.role || "user"}</span></div>
          <div style={infoCard}><div style={labelStyle}>Tracking Code</div><div className="flex items-center gap-2"><code style={{ color: "var(--success)", fontSize: 14, fontWeight: 600 }}>{user?.trackingCode || "N/A"}</code><button onClick={() => copyCode(user?.trackingCode, "Tracking code")} className="btn btn-outline btn-sm">Copy</button></div></div>
          <div style={infoCard}><div style={labelStyle}>Identity</div><div className="flex items-center gap-2"><code style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600 }}>{user?._id?.slice(-8) || "N/A"}</code><button onClick={() => copyCode(user?._id?.slice(-8), "Identity code")} className="btn btn-outline btn-sm">Copy</button></div></div>
        </div>

        {user?.referralCode && (
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--card-border)" }}><div style={labelStyle}>Referral Code</div><code style={{ color: "var(--purple)", fontSize: 14, fontWeight: 600, fontFamily: "'Consolas', monospace", background: "var(--purple-bg)", padding: "4px 10px", borderRadius: 4 }}>{user.referralCode}</code></div>
        )}

        <form onSubmit={updateProfile}>
          <div className="grid-2">
            <div><label style={labelStyle}>Full Name</label><input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Your full name" /></div>
            <div><label style={labelStyle}>Email Address</label><input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="you@example.com" /></div>
            <div><label style={labelStyle}>Phone Number</label><input placeholder="+1234567890" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
            <div><label style={labelStyle}>Facebook URL</label><input placeholder="facebook.com/username" value={profileForm.facebook} onChange={(e) => setProfileForm({ ...profileForm, facebook: e.target.value })} /></div>
          </div>
          <div className="flex gap-2" style={{ marginTop: 14 }}><button type="submit" className="btn btn-primary" disabled={profileLoading}>{profileLoading ? "Saving..." : "Update Profile"}</button></div>
        </form>
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--card-border)" }}><div style={labelStyle}>Member Since</div><div style={{ color: "var(--text-muted)", fontSize: 13 }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}</div></div>
      </div>

      {/* SECURITY */}
      <div className="card">
        <h3 style={sectionTitleStyle}>Security & Password</h3>
        <form onSubmit={changePassword}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Current Password</label><input type="password" placeholder="••••••••" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></div>
            <div><label style={labelStyle}>New Password</label><input type="password" placeholder="Min 6 characters" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></div>
            <div><label style={labelStyle}>Confirm New Password</label><input type="password" placeholder="Repeat password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></div>
          </div>
          <div className="flex gap-2" style={{ marginTop: 14 }}><button type="submit" className="btn btn-warning" disabled={passwordLoading}>{passwordLoading ? "Changing..." : "Update Password"}</button></div>
        </form>
      </div>
    </div>
  );
}
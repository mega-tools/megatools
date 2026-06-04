import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { username: paramUsername } = useParams();
  const [email, setEmail] = useState(paramUsername ? paramUsername + "@megatools.local" : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "", phone: "", facebook: "", referralCode: "", parentUsername: paramUsername || "" });
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter email and password"); return; }
    setLoading(true);
    try { await login(email, password); navigate("/"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (!signupData.name || !signupData.email || !signupData.password) { setError("Name, email and password are required"); return; }
    setLoading(true);
    try { await signup(signupData); await login(signupData.email, signupData.password); navigate("/"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (showSignup) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <img src="/logo.webp" alt="Mega Tools" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", margin: "0 auto 14px", boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }} />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 4, letterSpacing: "-0.3px" }}>Create Account</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {paramUsername ? "Join " + paramUsername + "'s team" : "Get started with Mega Tools"}
            </p>
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <input placeholder="Full Name" value={signupData.name} onChange={e => setSignupData({ ...signupData, name: e.target.value })} style={inp} />
            <input placeholder="Email address" type="email" value={signupData.email} onChange={e => setSignupData({ ...signupData, email: e.target.value })} style={inp} />
            <input placeholder="Password (min 6 characters)" type="password" value={signupData.password} onChange={e => setSignupData({ ...signupData, password: e.target.value })} style={inp} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <input placeholder="Phone (optional)" value={signupData.phone} onChange={e => setSignupData({ ...signupData, phone: e.target.value })} style={inp} />
              <input placeholder="Facebook (optional)" value={signupData.facebook} onChange={e => setSignupData({ ...signupData, facebook: e.target.value })} style={inp} />
            </div>
            {!paramUsername && <input placeholder="Referral Code (optional)" value={signupData.referralCode} onChange={e => setSignupData({ ...signupData, referralCode: e.target.value })} style={inp} />}
            <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "Creating Account..." : "Create Account"}</button>
          </form>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <span onClick={() => setShowSignup(false)} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600, transition: "opacity 0.2s" }} onMouseEnter={e => e.target.style.opacity = 0.8} onMouseLeave={e => e.target.style.opacity = 1}>Sign in</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.webp" alt="Mega Tools" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", margin: "0 auto 14px", boxShadow: "0 6px 20px rgba(99,102,241,0.35)" }} />
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 4, letterSpacing: "-0.3px" }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sign in to your dashboard</p>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <input placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} />
          <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "Signing in..." : "Sign In"}</button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <span onClick={() => setShowSignup(true)} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600, transition: "opacity 0.2s" }} onMouseEnter={e => e.target.style.opacity = 0.8} onMouseLeave={e => e.target.style.opacity = 1}>Sign up</span>
        </p>
      </div>
    </div>
  );
}

const pageStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  minHeight: "100vh", background: "linear-gradient(135deg, #0b1120 0%, #1a1f35 50%, #0f172a 100%)", padding: 20
};

const cardStyle = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: 20,
  padding: "40px 36px",
  width: 440,
  maxWidth: "94%",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.08) inset"
};

const errorStyle = {
  padding: "10px 14px", background: "rgba(248,113,113,0.1)", color: "var(--danger)",
  borderRadius: 8, fontSize: 12, marginBottom: 14, textAlign: "center",
  border: "1px solid rgba(248,113,113,0.2)", fontWeight: 500
};

const inp = {
  width: "100%", padding: "13px 16px", fontSize: 14,
  background: "var(--input-bg)", color: "var(--text)",
  border: "1px solid var(--input-border)", borderRadius: 10,
  outline: "none", transition: "border-color 0.2s, box-shadow 0.2s"
};

const btnPrimary = {
  padding: "14px", fontSize: 15, fontWeight: 700,
  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
  color: "#fff", border: "none", borderRadius: 10, cursor: "pointer",
  transition: "all 0.2s ease", letterSpacing: "0.3px",
  boxShadow: "0 4px 16px rgba(99,102,241,0.3)"
};
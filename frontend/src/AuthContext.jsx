import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import api from "./api";
import { io } from "socket.io-client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const [newAlert, setNewAlert] = useState(null);
  const [showBadge, setShowBadge] = useState(false);
  const [isInboxPage, setIsInboxPage] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [unseenSessionIds, setUnseenSessionIds] = useState([]);
  const [unseenLinkCount, setUnseenLinkCount] = useState(0);
  const [unseenMegaToolsCount, setUnseenMegaToolsCount] = useState(0);
  const [unseenMegaServiceCount, setUnseenMegaServiceCount] = useState(0);
  const socketRef = useRef(null);
  const sessionCacheRef = useRef([]);
  const audioClickRef = useRef(null);
  const audioSubmitRef = useRef(null);
  const soundThrottleRef = useRef({ click: 0, submit: 0 });

  useEffect(() => {
    audioClickRef.current = new Audio("/sounds/Desktop-Click.mp3");
    audioClickRef.current.volume = 0.6;
    audioSubmitRef.current = new Audio("/sounds/Submissions.mp3");
    audioSubmitRef.current.volume = 0.7;
  }, []);

  useEffect(() => { checkAuth(); }, []);

  const checkAuth = async () => {
    try { const res = await api.get("/auth/me"); setUser(res.data); setError(null); }
    catch (err) { if (err.response?.status === 401) setUser(null); }
    finally { setLoading(false); }
  };

  const login = useCallback(async (email, password) => {
    setLoading(true); setError(null);
    try { const res = await api.post("/auth/login", { email, password }); setUser(res.data.user); return res.data; }
    catch (err) { const msg = err.response?.data?.message || "Login failed."; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  const signup = useCallback(async (data) => {
    setLoading(true); setError(null);
    try { const res = await api.post("/auth/signup", data); return res.data; }
    catch (err) { const msg = err.response?.data?.message || "Signup failed."; setError(msg); throw new Error(msg); }
    finally { setLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try { await api.post("/auth/logout"); } catch (err) {}
    setUser(null); setError(null); setLoading(false);
    setLiveCount(0); setShowBadge(false); setNewAlert(null); setUnseenSessionIds([]);
    setUnseenLinkCount(0); setUnseenMegaToolsCount(0); setUnseenMegaServiceCount(0);
    sessionCacheRef.current = [];
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    setIsConnected(false);
    document.title = "Mega Tools";
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const playSound = useCallback((type) => {
    const now = Date.now();
    const last = soundThrottleRef.current[type] || 0;
    if (now - last < 4000) return;
    soundThrottleRef.current[type] = now;
    try {
      if (type === "submit" && audioSubmitRef.current) {
        audioSubmitRef.current.currentTime = 0;
        audioSubmitRef.current.play().catch(() => {});
      } else if (type === "click" && audioClickRef.current) {
        audioClickRef.current.currentTime = 0;
        audioClickRef.current.play().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const notify = useCallback((title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/favicon.ico", tag: "megatools" }); } catch (e) {}
    }
  }, []);

  const clearAlert = useCallback(() => setNewAlert(null), []);

  const markSessionSeen = useCallback((sessionId) => {
    setUnseenSessionIds(prev => prev.filter(id => id !== sessionId));
  }, []);

  const markLinksSeen = useCallback(() => {
    setUnseenLinkCount(0);
  }, []);

  const markMegaToolsSeen = useCallback(() => {
    setUnseenMegaToolsCount(0);
  }, []);

  const markMegaServiceSeen = useCallback(() => {
    setUnseenMegaServiceCount(0);
  }, []);

  useEffect(() => {
    if (!user) return;

    const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => { setIsConnected(true); socket.emit("joinUserRoom", user._id); });
    socket.on("disconnect", () => { setIsConnected(false); });

    socket.on("newSession", (data) => {
      setLiveCount(prev => prev + 1);
      if (!isInboxPage || document.hidden) { setShowBadge(true); }
      setNewAlert({ message: "New visitor arrived!", type: "session" });
      setUnseenSessionIds(prev => [...prev, data._id].slice(-50));
      playSound("click");
      notify("New Visitor", "Someone just visited your link!");
      sessionCacheRef.current = [data, ...sessionCacheRef.current].slice(0, 50);
    });

    socket.on("formSubmitted", (data) => {
      setNewAlert({ message: "Form submitted!", type: "submit" });
      playSound("submit");
      notify("Form Submitted", "A visitor just submitted a form!");
    });

    socket.on("sessionsUpdated", () => {});
    
    socket.on("linkCreated", () => {
      setUnseenLinkCount(prev => prev + 1);
    });
    
    socket.on("menuUpdated", (data) => {
      if (data && data.groupId === "mega-tools") {
        setUnseenMegaToolsCount(prev => prev + 1);
      } else if (data && data.groupId === "mega-service") {
        setUnseenMegaServiceCount(prev => prev + 1);
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; setIsConnected(false); };
  }, [user?._id, isInboxPage, playSound, notify]);

  useEffect(() => { if (!user) { setLiveCount(0); setShowBadge(false); setNewAlert(null); setUnseenSessionIds([]); setUnseenLinkCount(0); setUnseenMegaToolsCount(0); setUnseenMegaServiceCount(0); document.title = "Mega Tools"; } }, [user]);

  const contextValue = {
    user, loading, error, login, signup, logout, clearError,
    isAdmin: user?.role === "admin", isModerator: user?.role === "moderator", isUser: user?.role === "user",
    liveCount, setLiveCount, newAlert, clearAlert, showBadge, setShowBadge,
    isInboxPage, setIsInboxPage, isConnected, playSound, notify, socketRef, sessionCache: sessionCacheRef,
    unseenSessionIds, setUnseenSessionIds, markSessionSeen,
    unseenLinkCount, setUnseenLinkCount, markLinksSeen,
    unseenMegaToolsCount, setUnseenMegaToolsCount, markMegaToolsSeen,
    unseenMegaServiceCount, setUnseenMegaServiceCount, markMegaServiceSeen,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; };

export const useInbox = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useInbox must be used within AuthProvider");
  return {
    liveCount: ctx.liveCount, setLiveCount: ctx.setLiveCount,
    newAlert: ctx.newAlert, clearAlert: ctx.clearAlert,
    showBadge: ctx.showBadge, setShowBadge: ctx.setShowBadge,
    isInboxPage: ctx.isInboxPage, setIsInboxPage: ctx.setIsInboxPage,
    isConnected: ctx.isConnected, playSound: ctx.playSound, notify: ctx.notify,
    socketRef: ctx.socketRef, sessionCache: ctx.sessionCache,
    unseenSessionIds: ctx.unseenSessionIds, markSessionSeen: ctx.markSessionSeen,
    unseenLinkCount: ctx.unseenLinkCount, markLinksSeen: ctx.markLinksSeen,
    unseenMegaToolsCount: ctx.unseenMegaToolsCount, markMegaToolsSeen: ctx.markMegaToolsSeen,
    unseenMegaServiceCount: ctx.unseenMegaServiceCount, markMegaServiceSeen: ctx.markMegaServiceSeen,
  };
};

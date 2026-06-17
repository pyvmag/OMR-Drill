"use client";
import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ArrowLeft, Check, X, Clock, AlertTriangle } from "lucide-react";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const formatTime = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

const computeStats = (mock) => {
  const total = mock.numQuestions;
  let attempted = 0, correct = 0, wrong = 0;
  for (let i = 0; i < total; i++) {
    if (mock.answers[i]) attempted++;
    if (mock.evalMarks[i] === "correct") correct++;
    if (mock.evalMarks[i] === "wrong") wrong++;
  }
  const unattempted = total - attempted;
  const score = +(correct * mock.marksCorrect - wrong * mock.marksNegative).toFixed(2);
  const maxScore = +(total * mock.marksCorrect).toFixed(2);
  const percentage = maxScore > 0 ? +((score / maxScore) * 100).toFixed(1) : 0;
  const marked = correct + wrong;
  const fullyEvaluated = marked >= attempted;
  return { total, attempted, correct, wrong, unattempted, score, maxScore, percentage, fullyEvaluated };
};

export default function OmrDrillApp() {
  const [screen, setScreen] = useState("home");
  const [mocks, setMocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [setupForm, setSetupForm] = useState({ title: "", numQuestions: "100", timerMinutes: "60", marksCorrect: "1", marksNegative: "0.33" });
  const [setupError, setSetupError] = useState("");
  const tickRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = window.localStorage.getItem("mocks-data");
        if (res) setMocks(JSON.parse(res));
      } catch (e) {
        // no saved mocks yet
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (updated) => {
    setMocks(updated);
    try {
      window.localStorage.setItem("mocks-data", JSON.stringify(updated));
    } catch (e) {
      console.error("storage save failed", e);
    }
  };

  useEffect(() => {
    if (screen !== "exam") return;
    if (timeLeft <= 0) {
      setTimeUp(true);
      return;
    }
    tickRef.current = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(tickRef.current);
  }, [screen, timeLeft]);

  const openSetup = () => {
    setSetupForm({ title: `Mock ${mocks.length + 1}`, numQuestions: "100", timerMinutes: "60", marksCorrect: "1", marksNegative: "0.33" });
    setSetupError("");
    setScreen("setup");
  };

  const validateSetup = () => {
    const nq = parseInt(setupForm.numQuestions, 10);
    const tm = parseInt(setupForm.timerMinutes, 10);
    const mc = parseFloat(setupForm.marksCorrect);
    const mn = parseFloat(setupForm.marksNegative);
    if (!nq || nq < 1 || nq > 300) return "Number of questions should be between 1 and 300.";
    if (!tm || tm < 1 || tm > 300) return "Duration should be between 1 and 300 minutes.";
    if (isNaN(mc) || mc < 0) return "Marks per correct answer can't be negative.";
    if (isNaN(mn) || mn < 0) return "Negative marks should be entered as a positive number (e.g. 0.33).";
    return "";
  };

  const startExam = () => {
    const err = validateSetup();
    if (err) {
      setSetupError(err);
      return;
    }
    const nq = parseInt(setupForm.numQuestions, 10);
    const tm = parseInt(setupForm.timerMinutes, 10);
    const m = {
      id: uid(),
      title: setupForm.title.trim() || `Mock ${mocks.length + 1}`,
      numQuestions: nq,
      timerMinutes: tm,
      marksCorrect: parseFloat(setupForm.marksCorrect),
      marksNegative: parseFloat(setupForm.marksNegative),
      answers: Array(nq).fill(null),
      evalMarks: Array(nq).fill(null),
      status: "in-progress",
      createdAt: Date.now(),
    };
    setCurrent(m);
    setTimeLeft(tm * 60);
    setTimeUp(false);
    setScreen("exam");
  };

  const selectAnswer = (i, opt) => {
    setCurrent((c) => {
      const answers = [...c.answers];
      answers[i] = answers[i] === opt ? null : opt;
      return { ...c, answers };
    });
  };

  const setEvalMark = (i, mark) => {
    setCurrent((c) => {
      if (!c.answers[i]) return c;
      const evalMarks = [...c.evalMarks];
      evalMarks[i] = evalMarks[i] === mark ? null : mark;
      return { ...c, evalMarks };
    });
  };

  const confirmSubmitExam = () => setConfirmModal({ type: "submit" });
  const confirmAbandonExam = () => setConfirmModal({ type: "abandon" });
  const confirmDelete = (id, title) => setConfirmModal({ type: "delete", id, title });

  const handleConfirm = () => {
    if (!confirmModal) return;
    if (confirmModal.type === "submit") {
      const updatedMock = { ...current, status: "pending-evaluation", submittedAt: Date.now() };
      persist([updatedMock, ...mocks]);
      setCurrent(updatedMock);
      setScreen("evaluate");
    } else if (confirmModal.type === "abandon") {
      setCurrent(null);
      setScreen("home");
    } else if (confirmModal.type === "delete") {
      persist(mocks.filter((m) => m.id !== confirmModal.id));
    }
    setConfirmModal(null);
  };

  const saveEvaluation = () => {
    const stats = computeStats(current);
    const updatedMock = { ...current, status: stats.fullyEvaluated ? "evaluated" : "pending-evaluation" };
    persist(mocks.map((m) => (m.id === updatedMock.id ? updatedMock : m)));
    setCurrent(null);
    setScreen("home");
  };

  const openMock = (m) => {
    setCurrent(m);
    setScreen("evaluate");
  };

  const fontImport = "@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');";

  return (
    <div className="omr-app">
      <style>{`
        ${fontImport}
        .omr-app {
          --paper: #F1EEE0;
          --ink: #182B45;
          --ink-soft: #5A6E8C;
          --olive: #5C6B43;
          --olive-deep: #3F4A2E;
          --correct: #2E6B4F;
          --correct-bg: #E2EEE7;
          --wrong: #A3372B;
          --wrong-bg: #F4E5E2;
          --amber: #B5792A;
          --amber-bg: #F4EAD3;
          --line: #C9C2A6;
          --card: #FBFAF1;
          --shadow: rgba(24,43,69,0.14);
          min-height: 100vh;
          background: var(--paper);
          background-image: linear-gradient(var(--line) 1px, transparent 1px);
          background-size: 100% 28px;
          font-family: 'IBM Plex Sans', sans-serif;
          color: var(--ink);
          padding: 28px 20px 60px;
          box-sizing: border-box;
        }
        .omr-app * { box-sizing: border-box; }
        .wrap { max-width: 880px; margin: 0 auto; }
        .eyebrow { font-family:'IBM Plex Mono'; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--olive-deep); }
        h1.brand { font-family:'Space Grotesk'; font-weight:700; font-size:30px; margin:4px 0 0; letter-spacing:-0.01em; }
        .home-header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:16px; border-bottom:2px dashed var(--line); margin-bottom:24px; flex-wrap:wrap; gap:14px; }
        .btn { font-family:'Space Grotesk'; font-weight:600; border-radius:8px; padding:11px 18px; border:none; cursor:pointer; font-size:14px; display:inline-flex; align-items:center; gap:7px; transition: transform .1s, background .15s; }
        .btn:active { transform: scale(0.96); }
        .btn-primary { background: var(--olive); color: #fff; }
        .btn-primary:hover { background: var(--olive-deep); }
        .btn-ghost { background: transparent; border: 1.5px solid var(--ink-soft); color: var(--ink); }
        .btn-ghost:hover { border-color: var(--ink); }
        .btn-danger { background: var(--wrong); color: #fff; }
        .btn:disabled { opacity:.4; cursor:not-allowed; }
        .empty { text-align:center; padding: 70px 20px; border: 2px dashed var(--line); border-radius:14px; }
        .empty p { font-family:'IBM Plex Mono'; color: var(--ink-soft); margin-bottom:18px; }
        .mock-list { display:grid; gap:12px; }
        .mock-card { background: var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 20px 16px 26px; position:relative; cursor:pointer; box-shadow: 0 1px 0 var(--shadow); transition: transform .15s, box-shadow .15s; display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; }
        .mock-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px var(--shadow); }
        .mock-card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:12px; background-image: radial-gradient(circle, var(--paper) 3px, transparent 3.6px); background-size: 12px 16px; background-repeat: repeat-y; }
        .mock-title { font-family:'Space Grotesk'; font-weight:600; font-size:16px; }
        .mock-meta { font-family:'IBM Plex Mono'; font-size:11.5px; color: var(--ink-soft); margin-top:4px; }
        .badge { font-family:'IBM Plex Mono'; font-size:11.5px; font-weight:600; padding:5px 10px; border-radius:6px; white-space:nowrap; }
        .badge-amber { background: var(--amber-bg); color: var(--amber); }
        .badge-score { background: var(--correct-bg); color: var(--correct); }
        .icon-btn { background:transparent; border:none; color: var(--ink-soft); cursor:pointer; padding:6px; border-radius:6px; }
        .icon-btn:hover { color: var(--wrong); background: var(--wrong-bg); }
        .card-right { display:flex; align-items:center; gap:10px; }
        .form-card { background: var(--card); border:1px solid var(--line); border-radius:14px; padding:28px; max-width: 480px; margin: 0 auto; }
        .field { margin-bottom:18px; }
        .field label { display:block; font-family:'IBM Plex Mono'; font-size:11px; text-transform:uppercase; letter-spacing:.08em; color: var(--ink-soft); margin-bottom:6px; }
        .field input { width:100%; padding:10px 12px; border:1.5px solid var(--line); border-radius:8px; font-family:'IBM Plex Sans'; font-size:14px; background:#fff; color:var(--ink); }
        .field input:focus { outline:none; border-color: var(--olive); }
        .field-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .setup-error { font-family:'IBM Plex Mono'; font-size:12.5px; color: var(--wrong); background: var(--wrong-bg); border-radius:8px; padding:10px 12px; margin-bottom:16px; display:flex; gap:8px; align-items:flex-start; }
        .sticky-bar { position:sticky; top:0; background: var(--paper); padding:14px 0; border-bottom:2px dashed var(--line); z-index:10; display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; gap:14px; flex-wrap:wrap; }
        .sticky-title { font-family:'Space Grotesk'; font-weight:600; font-size:17px; }
        .timer-box { display:flex; align-items:center; gap:8px; font-family:'IBM Plex Mono'; }
        .timer { font-size:26px; font-weight:600; letter-spacing:1px; }
        .timer.warn { color: var(--wrong); animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .timeup-banner { background: var(--wrong-bg); color: var(--wrong); border:1.5px solid var(--wrong); border-radius:8px; padding:10px 14px; font-family:'IBM Plex Mono'; font-size:13px; margin-bottom:16px; display:flex; gap:8px; align-items:center; }
        .omr-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(225px,1fr)); gap:10px; }
        .omr-row { display:flex; align-items:center; gap:8px; background: var(--card); border:1px solid var(--line); border-radius:8px; padding:9px 11px; }
        .qnum { font-family:'IBM Plex Mono'; font-weight:600; font-size:13px; color: var(--ink-soft); width:26px; text-align:right; flex-shrink:0; }
        .bubbles { display:flex; gap:5px; }
        .bubble { width:25px; height:25px; border-radius:50%; border:1.6px solid var(--ink-soft); background:transparent; font-family:'IBM Plex Mono'; font-size:11.5px; font-weight:600; color: var(--ink-soft); display:flex; align-items:center; justify-content:center; cursor:pointer; transition: all .12s ease; padding:0; }
        .bubble:hover:not(.readonly) { border-color: var(--olive); color: var(--olive-deep); }
        .bubble.filled { background: var(--ink); border-color: var(--ink); color: var(--paper); }
        .bubble.readonly { cursor:default; }
        .eval-controls { display:flex; gap:5px; margin-left:auto; align-items:center; }
        .eval-btn { width:25px; height:25px; border-radius:6px; border:1.6px solid var(--line); background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }
        .eval-btn.correct.active { background: var(--correct-bg); border-color: var(--correct); color: var(--correct); }
        .eval-btn.wrong.active { background: var(--wrong-bg); border-color: var(--wrong); color: var(--wrong); }
        .eval-btn:disabled { opacity:.25; cursor:not-allowed; }
        .na-label { font-size:10.5px; color: var(--ink-soft); font-style:italic; margin-left:2px; white-space:nowrap; }
        .score-panel { display:flex; gap:24px; flex-wrap:wrap; background: var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 20px; margin-bottom:18px; }
        .stat .num { font-family:'IBM Plex Mono'; font-size:21px; font-weight:600; color: var(--ink); }
        .stat .num.green { color: var(--correct); }
        .stat .num.red { color: var(--wrong); }
        .stat .label { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color: var(--ink-soft); margin-top:2px; }
        .bottom-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:22px; }
        .modal-overlay { position:fixed; inset:0; background: rgba(24,43,69,.45); display:flex; align-items:center; justify-content:center; z-index:50; padding:20px; }
        .modal-card { background: var(--card); border-radius:12px; padding:24px; max-width:360px; width:100%; box-shadow: 0 14px 34px rgba(0,0,0,.28); }
        .modal-card h3 { font-family:'Space Grotesk'; margin:0 0 8px; font-size:17px; }
        .modal-card p { font-size:13.5px; color: var(--ink-soft); margin:0 0 20px; line-height:1.5; }
        .modal-actions { display:flex; justify-content:flex-end; gap:10px; }
      `}</style>

      <div className="wrap">
        {screen === "home" && (
          <>
            <div className="home-header">
              <div>
                <div className="eyebrow">CDS &middot; AFCAT &middot; Practice Drills</div>
                <h1 className="brand">OMR Drill</h1>
              </div>
              <button className="btn btn-primary" onClick={openSetup}><Plus size={16} /> New Mock</button>
            </div>

            {!loaded ? null : mocks.length === 0 ? (
              <div className="empty">
                <p>No mock attempts yet. Start your first drill.</p>
                <button className="btn btn-primary" onClick={openSetup}><Plus size={16} /> New Mock</button>
              </div>
            ) : (
              <div className="mock-list">
                {mocks.map((m) => {
                  const stats = computeStats(m);
                  const isEvaluated = m.status === "evaluated";
                  return (
                    <div className="mock-card" key={m.id} onClick={() => openMock(m)}>
                      <div>
                        <div className="mock-title">{m.title}</div>
                        <div className="mock-meta">
                          {m.numQuestions} Qs &middot; {m.timerMinutes} min &middot; +{m.marksCorrect}/&minus;{m.marksNegative} &middot; {new Date(m.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="card-right">
                        {isEvaluated ? (
                          <span className="badge badge-score">Score {stats.score}/{stats.maxScore} &middot; {stats.percentage}%</span>
                        ) : (
                          <span className="badge badge-amber">Evaluation pending</span>
                        )}
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); confirmDelete(m.id, m.title); }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {screen === "setup" && (
          <>
            <div className="home-header">
              <button className="btn btn-ghost" onClick={() => setScreen("home")}><ArrowLeft size={16} /> Home</button>
            </div>
            <div className="form-card">
              <div className="eyebrow">New mock</div>
              <h1 className="brand" style={{ fontSize: 24, marginBottom: 22 }}>Set up your sheet</h1>
              {setupError && <div className="setup-error"><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{setupError}</div>}
              <div className="field">
                <label>Mock title</label>
                <input type="text" value={setupForm.title} onChange={(e) => setSetupForm({ ...setupForm, title: e.target.value })} placeholder="e.g. CDS 2024 II - English" />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Number of questions</label>
                  <input type="number" min="1" max="300" value={setupForm.numQuestions} onChange={(e) => setSetupForm({ ...setupForm, numQuestions: e.target.value })} />
                </div>
                <div className="field">
                  <label>Duration (minutes)</label>
                  <input type="number" min="1" max="300" value={setupForm.timerMinutes} onChange={(e) => setSetupForm({ ...setupForm, timerMinutes: e.target.value })} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Marks per correct</label>
                  <input type="number" step="0.01" min="0" value={setupForm.marksCorrect} onChange={(e) => setSetupForm({ ...setupForm, marksCorrect: e.target.value })} />
                </div>
                <div className="field">
                  <label>Negative marks per wrong</label>
                  <input type="number" step="0.01" min="0" value={setupForm.marksNegative} onChange={(e) => setSetupForm({ ...setupForm, marksNegative: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={startExam}>Start Exam</button>
            </div>
          </>
        )}

        {screen === "exam" && current && (
          <>
            <div className="sticky-bar">
              <div>
                <div className="eyebrow">In progress</div>
                <div className="sticky-title">{current.title}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div className="timer-box">
                  <Clock size={18} />
                  <span className={`timer ${timeUp ? "warn" : ""}`}>{formatTime(timeLeft)}</span>
                </div>
                <button className="btn btn-ghost" onClick={confirmAbandonExam}>Leave</button>
                <button className="btn btn-primary" onClick={confirmSubmitExam}>Submit Exam</button>
              </div>
            </div>
            {timeUp && <div className="timeup-banner"><AlertTriangle size={16} /> Time's up. Submit whenever you're ready.</div>}
            <div className="omr-grid">
              {Array.from({ length: current.numQuestions }).map((_, i) => (
                <div className="omr-row" key={i}>
                  <div className="qnum">{i + 1}</div>
                  <div className="bubbles">
                    {["A", "B", "C", "D"].map((opt) => (
                      <button key={opt} className={`bubble ${current.answers[i] === opt ? "filled" : ""}`} onClick={() => selectAnswer(i, opt)}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="bottom-actions">
              <button className="btn btn-primary" onClick={confirmSubmitExam}>Submit Exam</button>
            </div>
          </>
        )}

        {screen === "evaluate" && current && (
          <>
            <div className="sticky-bar">
              <div>
                <div className="eyebrow">{current.status === "evaluated" ? "Review" : "Evaluation"}</div>
                <div className="sticky-title">{current.title}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => { setCurrent(null); setScreen("home"); }}><ArrowLeft size={16} /> Home</button>
            </div>
            {(() => {
              const stats = computeStats(current);
              return (
                <div className="score-panel">
                  <div className="stat"><div className="num">{stats.attempted}/{stats.total}</div><div className="label">Attempted</div></div>
                  <div className="stat"><div className="num green">{stats.correct}</div><div className="label">Correct</div></div>
                  <div className="stat"><div className="num red">{stats.wrong}</div><div className="label">Wrong</div></div>
                  <div className="stat"><div className="num">{stats.unattempted}</div><div className="label">Unattempted</div></div>
                  <div className="stat"><div className="num">{stats.score}/{stats.maxScore}</div><div className="label">Score</div></div>
                  <div className="stat"><div className="num">{stats.percentage}%</div><div className="label">Percentage</div></div>
                </div>
              );
            })()}
            <div className="omr-grid">
              {Array.from({ length: current.numQuestions }).map((_, i) => {
                const answered = !!current.answers[i];
                return (
                  <div className="omr-row" key={i}>
                    <div className="qnum">{i + 1}</div>
                    <div className="bubbles">
                      {["A", "B", "C", "D"].map((opt) => (
                        <button key={opt} className={`bubble readonly ${current.answers[i] === opt ? "filled" : ""}`} disabled>{opt}</button>
                      ))}
                    </div>
                    <div className="eval-controls">
                      {answered ? (
                        <>
                          <button className={`eval-btn correct ${current.evalMarks[i] === "correct" ? "active" : ""}`} onClick={() => setEvalMark(i, "correct")}><Check size={14} /></button>
                          <button className={`eval-btn wrong ${current.evalMarks[i] === "wrong" ? "active" : ""}`} onClick={() => setEvalMark(i, "wrong")}><X size={14} /></button>
                        </>
                      ) : (
                        <span className="na-label">Not attempted</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bottom-actions">
              <button className="btn btn-primary" onClick={saveEvaluation}>Save &amp; Go Home</button>
            </div>
          </>
        )}
      </div>

      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {confirmModal.type === "submit" && (
              <>
                <h3>Submit this mock?</h3>
                <p>You won't be able to change your answers after submitting. You'll move on to checking them against your answer key.</p>
              </>
            )}
            {confirmModal.type === "abandon" && (
              <>
                <h3>Leave this mock?</h3>
                <p>Your attempt hasn't been saved yet and will be discarded.</p>
              </>
            )}
            {confirmModal.type === "delete" && (
              <>
                <h3>Delete "{confirmModal.title}"?</h3>
                <p>This will permanently remove this mock and its results. This can't be undone.</p>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className={`btn ${confirmModal.type === "delete" || confirmModal.type === "abandon" ? "btn-danger" : "btn-primary"}`} onClick={handleConfirm}>
                {confirmModal.type === "submit" ? "Submit" : confirmModal.type === "abandon" ? "Leave" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


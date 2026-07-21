import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";

export default function DriverTraining() {
  const user = getUser();
  const driverId = user?.driver_id;
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [watched, setWatched] = useState(0);
  const [videoDone, setVideoDone] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/training/course?siteId=site-1");
        if (cancelled) return;
        setCourse(data.course);
        setQuestions(data.questions);
        const st = await api(`/training/status?driverId=${driverId}`);
        if (cancelled) return;
        if (st.record) {
          setWatched(st.record.watched_seconds || 0);
          setVideoDone(!!st.record.video_completed);
          if (st.passed) {
            setResult({
              passed: true,
              score: st.record.quiz_score,
              validUntil: st.record.valid_until,
            });
          }
        }
      } catch (e) {
        if (!cancelled) setMsg(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId]);

  async function tickWatch() {
    if (!course || !driverId || videoDone || saving) return;
    const next = Math.min(watched + 5, course.min_watch_seconds);
    setSaving(true);
    setMsg("");
    setWatched(next);
    try {
      const r = await api("/training/progress", {
        method: "POST",
        body: { watchedSeconds: next, driverId },
      });
      const seconds = r.record?.watched_seconds ?? next;
      setWatched(seconds);
      if (r.record?.video_completed) setVideoDone(true);
    } catch (e) {
      setMsg(e.message || "进度保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function submitQuiz() {
    if (!driverId || saving) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await api("/training/quiz", {
        method: "POST",
        body: { answers, driverId },
      });
      setResult(r);
      setMsg(r.passed ? "培训通过，可继续上传证件/报到" : "未及格，请复习后重考");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!course) return <div className="h5">{msg || "加载课程…"}</div>;

  const pct = Math.min(100, Math.round((watched / course.min_watch_seconds) * 100));

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← 返回
      </Link>
      <h1 className="h5-title">{course.title}</h1>
      <p className="h5-sub">
        最短观看 {course.min_watch_seconds}s · 及格线 {course.pass_score} 分
      </p>

      <div className="card">
        <div className="muted">视频进度（模拟播放器）</div>
        <div className="progress" style={{ margin: "10px 0" }}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="row">
          <button
            className="btn primary btn-block"
            type="button"
            onClick={tickWatch}
            disabled={videoDone || saving}
          >
            {videoDone
              ? "已看完"
              : saving
                ? "保存中…"
                : `继续观看 +5s（${watched}/${course.min_watch_seconds}）`}
          </button>
          {videoDone && <span className="pill ok">可答题</span>}
        </div>
      </div>

      {videoDone && !result?.passed && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>准入答题</strong>
          {questions.map((q) => (
            <div key={q.id} style={{ marginTop: 14 }}>
              <div>{q.stem}</div>
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`btn quiz-opt ${answers[q.id] === idx ? "picked" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                >
                  {opt}
                </button>
              ))}
            </div>
          ))}
          <button
            className="btn primary btn-block"
            type="button"
            onClick={submitQuiz}
            disabled={saving}
            style={{ marginTop: 12 }}
          >
            提交答卷
          </button>
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <span className={`pill ${result.passed ? "ok" : "bad"}`}>
            {result.passed ? "通过" : "未通过"} · {result.score} 分
          </span>
          {result.validUntil && (
            <p className="muted">有效期至 {result.validUntil}</p>
          )}
        </div>
      )}
      {msg && <p className={msg.includes("失败") || msg.includes("错误") ? "form-err" : "muted"}>{msg}</p>}
    </div>
  );
}

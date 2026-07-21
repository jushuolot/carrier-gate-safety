import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { localizeTraining, translateApiError } from "../../i18n/content";
import { useI18n } from "../../i18n/I18nContext";

export default function DriverTraining() {
  const user = getUser();
  const { t, lang } = useI18n();
  const driverId = user?.driver_id;
  const [course, setCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [watched, setWatched] = useState(0);
  const [videoDone, setVideoDone] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgBad, setMsgBad] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api("/training/course?siteId=site-1");
        if (cancelled) return;
        const loc = localizeTraining(lang, data.course, data.questions);
        setCourse(loc.course);
        setQuestions(loc.questions);
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
        if (!cancelled) {
          setMsg(translateApiError(lang, e.message));
          setMsgBad(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, lang]);

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
      setMsg(translateApiError(lang, e.message) || t("progressSaveFailed"));
      setMsgBad(true);
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
      setMsg(r.passed ? t("quizPassedMsg") : t("quizFailedMsg"));
      setMsgBad(!r.passed);
    } catch (e) {
      setMsg(translateApiError(lang, e.message));
      setMsgBad(true);
    } finally {
      setSaving(false);
    }
  }

  if (!course) return <div className="h5">{msg || t("loadingCourse")}</div>;

  const pct = Math.min(100, Math.round((watched / course.min_watch_seconds) * 100));

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← {t("back")}
      </Link>
      <h1 className="h5-title">{course.title}</h1>
      <p className="h5-sub">
        {t("minWatch", { s: course.min_watch_seconds, score: course.pass_score })}
      </p>

      <div className="card">
        <div className="muted">{t("videoProgress")}</div>
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
              ? t("watchedDone")
              : saving
                ? t("saving")
                : t("continueWatch", {
                    watched,
                    total: course.min_watch_seconds,
                  })}
          </button>
          {videoDone && <span className="pill ok">{t("readyQuiz")}</span>}
        </div>
      </div>

      {videoDone && !result?.passed && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{t("quizTitle")}</strong>
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
            {t("submitQuiz")}
          </button>
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 12 }}>
          <span className={`pill ${result.passed ? "ok" : "bad"}`}>
            {result.passed ? t("passed") : t("failed")} · {t("scorePoints", { score: result.score })}
          </span>
          {result.validUntil && (
            <p className="muted">{t("validUntil", { date: result.validUntil })}</p>
          )}
        </div>
      )}
      {msg && <p className={msgBad ? "form-err" : "muted"}>{msg}</p>}
    </div>
  );
}

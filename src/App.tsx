import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SECTION_DESC,
  SECTION_LABEL,
  TYPE_LABEL,
  TYPE_ORDER,
  chapterLabel,
  chapterList,
  countsFor,
  isAuto,
  isCorrect,
  loadBank,
  prepareQuestion,
  shuffle,
} from './data';
import type {
  Bank,
  HistoryEntry,
  QType,
  Question,
  Section,
  SessionState,
  SetupConfig,
} from './types';

type View = 'home' | 'setup' | 'session' | 'review' | 'bank' | 'flash';

const DEFAULT_SETUP: SetupConfig = {
  types: ['truefalse', 'mcq'],
  chapter: 'all',
  count: 20,
  mode: 'practice',
  shuffleOptions: true,
};

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [bank, setBank] = useState<Bank | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>(() => loadLS('ktct.section', 'core' as Section));
  const [view, setView] = useState<View>('home');
  const [setup, setSetup] = useState<SetupConfig>(() => loadLS('ktct.setup', DEFAULT_SETUP));
  const [session, setSession] = useState<SessionState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadLS('ktct.history', []));
  const [known, setKnown] = useState<Record<string, true>>(() => loadLS('ktct.known', {}));

  useEffect(() => {
    loadBank()
      .then(setBank)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => saveLS('ktct.section', section), [section]);
  useEffect(() => saveLS('ktct.setup', setup), [setup]);
  useEffect(() => saveLS('ktct.history', history), [history]);
  useEffect(() => saveLS('ktct.known', known), [known]);

  const changeSection = (next: Section) => {
    setSection(next);
    setSession(null);
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const beginItems = (items: Question[], mode: 'practice' | 'exam') => {
    if (!items.length) return;
    setSession({
      items,
      answers: {},
      flags: {},
      index: 0,
      mode,
      startedAt: Date.now(),
    });
    setView('session');
    window.scrollTo({ top: 0 });
  };

  const startWithTypes = (types: QType[], overrides: Partial<SetupConfig> = {}) => {
    if (!bank) return;
    const cfg: SetupConfig = { ...setup, ...overrides, types };
    const pool = bank.questions.filter(
      (q) =>
        q.section === section &&
        types.includes(q.type) &&
        (cfg.chapter === 'all' || q.chapter === cfg.chapter)
    );
    const picked = shuffle(pool)
      .slice(0, Math.max(1, Math.min(cfg.count, pool.length)))
      .map((q) => prepareQuestion(q, cfg.shuffleOptions));
    if (!picked.length) return;
    setSetup(cfg);
    beginItems(picked, cfg.mode);
  };

  const finishSession = () => {
    if (!session) return;
    const auto = session.items.filter(isAuto);
    const correct = auto.filter((q) => isCorrect(q, session.answers[q.id])).length;
    const entry: HistoryEntry = {
      date: new Date().toISOString(),
      section,
      total: session.items.length,
      autoTotal: auto.length,
      correct,
    };
    setHistory((h) => [entry, ...h].slice(0, 30));
    setView('review');
    window.scrollTo({ top: 0 });
  };

  if (error) {
    return (
      <div className="app-shell">
        <main className="container">
          <div className="panel empty">
            <h2>Không tải được dữ liệu</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              {error}
            </p>
            <p className="small muted" style={{ marginTop: 12 }}>
              Hãy chạy <code>npm run build-bank</code> để tạo file dữ liệu.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!bank) {
    return <div className="loading">Đang tải ngân hàng câu hỏi…</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="brand" onClick={() => setView('home')} aria-label="Về trang chủ">
            <span className="brand-mark">KT</span>
            <span>
              KTCT Mác – Lênin
              <small>Ôn thi cuối kì</small>
            </span>
          </button>
          <div className="section-tabs" role="tablist" aria-label="Chọn phần học">
            {(['core', 'extra'] as Section[]).map((s) => (
              <button
                key={s}
                data-section={s}
                role="tab"
                aria-selected={section === s}
                className={section === s ? 'active' : ''}
                onClick={() => changeSection(s)}
              >
                <span className="dot" />
                {SECTION_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container">
        {view === 'home' && (
          <HomeView
            bank={bank}
            section={section}
            history={history}
            onStart={startWithTypes}
            onSetup={(preset) => {
              setSetup((s) => ({ ...s, types: preset }));
              setView('setup');
            }}
            onFlash={() => setView('flash')}
            onBank={() => setView('bank')}
          />
        )}

        {view === 'setup' && (
          <SetupView
            bank={bank}
            section={section}
            setup={setup}
            setSetup={setSetup}
            onBack={() => setView('home')}
            onStart={startWithTypes}
          />
        )}

        {view === 'session' && session && (
          <SessionView
            session={session}
            setSession={setSession}
            section={section}
            onFinish={finishSession}
            onExit={() => setView('home')}
          />
        )}

        {view === 'review' && session && (
          <ReviewView
            session={session}
            section={section}
            onHome={() => setView('home')}
            onRetryWrong={() => {
              const wrong = session.items.filter(
                (q) => isAuto(q) && q.answer && session.answers[q.id] !== q.answer
              );
              beginItems(wrong, 'practice');
            }}
            onNew={() => {
              setSession(null);
              setView('setup');
            }}
          />
        )}

        {view === 'bank' && (
          <BankView bank={bank} section={section} onBack={() => setView('home')} />
        )}

        {view === 'flash' && (
          <FlashView
            bank={bank}
            section={section}
            known={known}
            setKnown={setKnown}
            onBack={() => setView('home')}
          />
        )}
      </main>

      <footer className="footer">
        <div className="container">
          Phần <strong>Ôn chính</strong> dựng từ đề cương, lý thuyết, công thức và 12 bài tập trong bộ tài liệu của bạn.
          Phần <strong>Luyện thêm</strong> dùng câu hỏi công khai từ{' '}
          <a href="https://www.studocu.vn/vn/course/truong-dai-hoc-kinh-te-dai-hoc-da-nang/kinh-te-chinh-tri-mac-lenin/5955041" target="_blank" rel="noreferrer">
            Studocu – KTCT Mác Lênin (SMT1006)
          </a>
          . Nội dung chỉ dùng cho mục đích học tập cá nhân.
        </div>
      </footer>
    </div>
  );
}

/* ===================================================================== */
/* Home                                                                  */
/* ===================================================================== */

function HomeView({
  bank,
  section,
  history,
  onStart,
  onSetup,
  onFlash,
  onBank,
}: {
  bank: Bank;
  section: Section;
  history: HistoryEntry[];
  onStart: (types: QType[], overrides?: Partial<SetupConfig>) => void;
  onSetup: (types: QType[]) => void;
  onFlash: () => void;
  onBank: () => void;
}) {
  const counts = countsFor(bank, section);
  const total = TYPE_ORDER.reduce((sum, t) => sum + (counts[t] || 0), 0);
  const sectionHistory = history.filter((h) => h.section === section).slice(0, 5);
  const extraSources = useMemo(
    () => new Set(bank.questions.filter((q) => q.section === 'extra').map((q) => q.source)).size,
    [bank]
  );

  const modeCards: { key: QType[]; title: string; meta: string; disabled?: boolean }[] = [
    {
      key: ['truefalse', 'mcq'],
      title: 'Trắc nghiệm',
      meta: `${(counts.truefalse || 0) + (counts.mcq || 0)} câu Đúng/Sai và trắc nghiệm`,
    },
    { key: ['essay'], title: 'Tự luận', meta: `${counts.essay || 0} câu hỏi lý thuyết` },
    { key: ['exercise'], title: 'Bài tập', meta: `${counts.exercise || 0} bài tính toán có lời giải` },
    { key: ['flashcard'], title: 'Thẻ ghi nhớ', meta: `${counts.flashcard || 0} khái niệm và định nghĩa` },
  ];

  return (
    <div>
      <div className="hero">
        <div>
          <span className={`badge ${section === 'extra' ? 'teal' : ''}`}>
            {SECTION_LABEL[section]}
          </span>
          <h1 style={{ marginTop: 10 }}>
            {section === 'core' ? 'Ôn chắc đề cương' : 'Luyện thêm đề và câu hỏi'}
          </h1>
          <p>{SECTION_DESC[section]}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={onBank}>
            Ngân hàng câu hỏi
          </button>
          <button className="btn btn-primary" onClick={() => onSetup(['truefalse', 'mcq'])}>
            Tùy chỉnh đề
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat">
          <div className="num">{total}</div>
          <div className="lab">Tổng mục</div>
        </div>
        <div className="stat">
          <div className="num">{(counts.truefalse || 0) + (counts.mcq || 0)}</div>
          <div className="lab">Trắc nghiệm</div>
        </div>
        <div className="stat">
          <div className="num">{(counts.essay || 0) + (counts.exercise || 0)}</div>
          <div className="lab">Tự luận / bài tập</div>
        </div>
        <div className="stat">
          <div className="num">{counts.flashcard || 0}</div>
          <div className="lab">Thẻ ghi nhớ</div>
        </div>
        {section === 'extra' && (
          <div className="stat">
            <div className="num">{extraSources}</div>
            <div className="lab">Bộ câu hỏi nguồn</div>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <div className="row">
          <div>
            <h2 style={{ fontSize: 18 }}>Chọn hình thức luyện</h2>
            <p className="small muted">Đề được xáo trộn ngẫu nhiên mỗi lần bắt đầu.</p>
          </div>
        </div>
        <div className="mode-grid">
          {modeCards.map((m) => {
            const count = m.key.reduce((s, t) => s + (counts[t] || 0), 0);
            return (
              <button
                key={m.title}
                className={`mode-card ${section === 'extra' ? 'accent' : ''}`}
                disabled={count === 0}
                onClick={() => (m.key[0] === 'flashcard' ? onFlash() : onStart(m.key))}
              >
                <span className="title">{m.title}</span>
                <span className="meta">{m.meta}</span>
                <span className="arrow">{count === 0 ? 'Chưa có dữ liệu' : 'Bắt đầu →'}</span>
              </button>
            );
          })}
          <button className="mode-card" onClick={onBank}>
            <span className="title">Ngân hàng câu hỏi</span>
            <span className="meta">Tìm kiếm, lọc theo chương và xem đáp án</span>
            <span className="arrow">Mở danh sách →</span>
          </button>
        </div>
      </div>

      {sectionHistory.length > 0 && (
        <div className="panel" style={{ padding: 20, marginTop: 16 }}>
          <h3 style={{ fontSize: 15 }}>Lần luyện gần đây</h3>
          <div className="history" style={{ marginTop: 10 }}>
            {sectionHistory.map((h, i) => (
              <div className="history-row" key={`${h.date}-${i}`}>
                <span className="muted tiny" style={{ width: 130 }}>
                  {new Date(h.date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="small">
                  {h.total} câu · {h.autoTotal} câu tự chấm
                </span>
                <span className="spacer" />
                <span className="score">
                  {h.correct}/{h.autoTotal}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================================================================== */
/* Setup                                                                 */
/* ===================================================================== */

function SetupView({
  bank,
  section,
  setup,
  setSetup,
  onBack,
  onStart,
}: {
  bank: Bank;
  section: Section;
  setup: SetupConfig;
  setSetup: React.Dispatch<React.SetStateAction<SetupConfig>>;
  onBack: () => void;
  onStart: (types: QType[], overrides?: Partial<SetupConfig>) => void;
}) {
  const counts = countsFor(bank, section);
  const chapters = chapterList(bank, section);
  const available = TYPE_ORDER.filter((t) => (counts[t] || 0) > 0);

  const toggleType = (t: QType) => {
    setSetup((s) => ({
      ...s,
      types: s.types.includes(t) ? s.types.filter((x) => x !== t) : [...s.types, t],
    }));
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quay lại
        </button>
        <span className="badge">{SECTION_LABEL[section]}</span>
      </div>

      <div className="panel" style={{ padding: 22 }}>
        <h1 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>Tùy chỉnh đề luyện</h1>
        <p className="small muted" style={{ marginTop: 4 }}>
          Chọn dạng câu, chương và số lượng. Hệ thống sẽ lấy ngẫu nhiên từ ngân hàng.
        </p>

        <div className="setup-grid" style={{ marginTop: 20 }}>
          <div className="field">
            <label>Dạng câu hỏi</label>
            <div className="chips">
              {available.map((t) => (
                <button
                  key={t}
                  className={`chip ${setup.types.includes(t) ? 'on' : ''}`}
                  onClick={() => toggleType(t)}
                >
                  {TYPE_LABEL[t]} <span className="count">{counts[t] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="inline-fields">
            <div className="field">
              <label>Chương</label>
              <select
                value={String(setup.chapter)}
                onChange={(e) =>
                  setSetup((s) => ({
                    ...s,
                    chapter: e.target.value === 'all' ? 'all' : Number(e.target.value),
                  }))
                }
              >
                <option value="all">Tất cả các chương</option>
                {chapters.map((ch) => (
                  <option key={ch} value={ch}>
                    {chapterLabel(ch)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Số câu</label>
              <select
                value={setup.count}
                onChange={(e) => setSetup((s) => ({ ...s, count: Number(e.target.value) }))}
              >
                {[10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} câu
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Chế độ</label>
              <select
                value={setup.mode}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, mode: e.target.value as 'practice' | 'exam' }))
                }
              >
                <option value="practice">Luyện tập – hiện đáp án ngay</option>
                <option value="exam">Thi thử – nộp bài mới xem đáp án</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Thứ tự đáp án</label>
            <div className="chips">
              <button
                className={`chip ${setup.shuffleOptions ? 'on' : ''}`}
                onClick={() => setSetup((s) => ({ ...s, shuffleOptions: true }))}
              >
                Xáo trộn đáp án
              </button>
              <button
                className={`chip ${!setup.shuffleOptions ? 'on' : ''}`}
                onClick={() => setSetup((s) => ({ ...s, shuffleOptions: false }))}
              >
                Giữ nguyên thứ tự
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 4 }}>
            <button
              className="btn btn-primary"
              disabled={setup.types.length === 0}
              onClick={() => onStart(setup.types)}
            >
              Bắt đầu làm bài
            </button>
            <span className="small muted">
              {setup.types.length === 0
                ? 'Chọn ít nhất một dạng câu hỏi.'
                : `Đã chọn ${setup.types.map((t) => TYPE_LABEL[t]).join(', ')}.`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Session                                                               */
/* ===================================================================== */

function SessionView({
  session,
  setSession,
  section,
  onFinish,
  onExit,
}: {
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState | null>>;
  section: Section;
  onFinish: () => void;
  onExit: () => void;
}) {
  const q = session.items[session.index];
  const answer = session.answers[q.id] || '';
  const auto = isAuto(q);
  const revealed = session.mode === 'practice' && auto && !!answer;
  const correct = isCorrect(q, answer);
  const [now, setNow] = useState(Date.now());
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setNow(Date.now());
  }, [session.index]);

  const answeredCount = session.items.filter((item) => (session.answers[item.id] || '').trim()).length;
  const pct = Math.round((answeredCount / session.items.length) * 100);
  const elapsed = Math.floor((now - session.startedAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const choose = (id: string) => {
    if (revealed) return;
    setSession((s) =>
      s ? { ...s, answers: { ...s.answers, [q.id]: id } } : s
    );
  };

  const setText = (value: string) => {
    setSession((s) => (s ? { ...s, answers: { ...s.answers, [q.id]: value } } : s));
  };

  const go = (index: number) => {
    setSession((s) => (s ? { ...s, index: Math.max(0, Math.min(s.items.length - 1, index)) } : s));
  };

  const toggleFlag = () => {
    setSession((s) =>
      s ? { ...s, flags: { ...s.flags, [q.id]: !s.flags[q.id] } } : s
    );
  };

  const submit = () => {
    const unanswered = session.items.filter((item) => !(session.answers[item.id] || '').trim()).length;
    if (unanswered > 0 && !window.confirm(`Còn ${unanswered} câu chưa làm. Vẫn nộp bài?`)) return;
    onFinish();
  };

  const optionClass = (id: string) => {
    if (!revealed) return id === answer ? 'option selected' : 'option';
    if (id === q.answer) return 'option correct';
    if (id === answer) return 'option wrong';
    return 'option';
  };

  return (
    <div>
      <div className="session-head">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>
          ← Thoát
        </button>
        <span className={`badge ${section === 'extra' ? 'teal' : ''}`}>{SECTION_LABEL[section]}</span>
        <span className="small muted">
          Câu {session.index + 1}/{session.items.length}
        </span>
        <div className={`progress ${section === 'extra' ? 'teal' : ''}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="small muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {mm}:{ss}
        </span>
        <button
          className={`btn btn-sm ${session.flags[q.id] ? 'btn-primary' : ''}`}
          onClick={toggleFlag}
        >
          {session.flags[q.id] ? 'Đã đánh dấu' : 'Đánh dấu'}
        </button>
      </div>

      <div className="panel question-card">
        <div className="q-top">
          <span className={`tag ${section === 'extra' ? 'green' : 'blue'}`}>{TYPE_LABEL[q.type]}</span>
          <span className="tag">{chapterLabel(q.chapter)}</span>
          {q.topic && <span className="tag">{q.topic}</span>}
          <span className="spacer" />
          <span className="tiny muted">
            {session.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}
          </span>
        </div>

        <div className="question-text">{q.question}</div>

        {auto ? (
          <>
            <div className="options">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  className={optionClass(o.id)}
                  onClick={() => choose(o.id)}
                  disabled={revealed}
                >
                  <span className="letter">{o.id}</span>
                  <span>{o.text}</span>
                </button>
              ))}
            </div>

            {revealed && (
              <div className={`feedback ${correct ? 'ok' : 'bad'}`}>
                <span className="label">{correct ? 'Chính xác' : 'Chưa đúng'}</span>
                {!correct && (
                  <div>
                    Đáp án đúng: <strong>{q.answer}</strong>
                    {q.options.find((o) => o.id === q.answer)?.text
                      ? ` – ${q.options.find((o) => o.id === q.answer)?.text}`
                      : ''}
                  </div>
                )}
                {q.explanation && <div style={{ marginTop: 6 }}>{q.explanation}</div>}
              </div>
            )}
          </>
        ) : (
          <>
            <textarea
              ref={textRef}
              value={answer}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                q.type === 'exercise'
                  ? 'Trình bày các bước tính toán và kết quả…'
                  : 'Viết câu trả lời của bạn…'
              }
            />
            <p className="tiny muted" style={{ marginTop: 8 }}>
              {q.type === 'exercise'
                ? 'Bài tập sẽ hiện lời giải chi tiết sau khi nộp bài.'
                : 'Câu tự luận sẽ hiện đáp án mẫu sau khi nộp bài.'}
            </p>
          </>
        )}

        <div className="nav-row">
          <button className="btn" onClick={() => go(session.index - 1)} disabled={session.index === 0}>
            ← Câu trước
          </button>
          <button
            className="btn"
            onClick={() => go(session.index + 1)}
            disabled={session.index === session.items.length - 1}
          >
            Câu sau →
          </button>
          <span className="spacer" />
          <button className="btn btn-primary" onClick={submit}>
            Nộp bài
          </button>
        </div>

        <div className="palette" aria-label="Danh sách câu">
          {session.items.map((item, i) => (
            <button
              key={item.id}
              title={`Câu ${i + 1}`}
              className={[
                i === session.index ? 'current' : '',
                (session.answers[item.id] || '').trim() ? 'answered' : '',
                session.flags[item.id] ? 'flagged' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => go(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Review                                                                */
/* ===================================================================== */

function ReviewView({
  session,
  section,
  onHome,
  onRetryWrong,
  onNew,
}: {
  session: SessionState;
  section: Section;
  onHome: () => void;
  onRetryWrong: () => void;
  onNew: () => void;
}) {
  const auto = session.items.filter(isAuto);
  const correct = auto.filter((q) => isCorrect(q, session.answers[q.id])).length;
  const pct = auto.length ? Math.round((correct / auto.length) * 100) : 0;
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');

  const wrong = session.items.filter(
    (q) => isAuto(q) && q.answer && session.answers[q.id] !== q.answer
  );
  const list = filter === 'wrong' ? wrong : session.items;

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className={`badge ${section === 'extra' ? 'teal' : ''}`}>{SECTION_LABEL[section]}</span>
        <span className="small muted">Kết quả bài làm</span>
      </div>

      <div className="panel score-card">
        <div className="score-ring" style={{ '--pct': pct } as React.CSSProperties}>
          <div>{auto.length ? `${pct}%` : '—'}</div>
        </div>
        <div className="score-meta">
          <h2>
            {auto.length
              ? `${correct}/${auto.length} câu trắc nghiệm đúng`
              : 'Đã nộp bài tự luận'}
          </h2>
          <p>
            Tổng {session.items.length} câu · {auto.length} câu tự chấm · {session.items.length - auto.length} câu tự luận/bài tập
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={onHome}>
              Về trang chủ
            </button>
            {wrong.length > 0 && (
              <button className="btn btn-primary" onClick={onRetryWrong}>
                Làm lại {wrong.length} câu sai
              </button>
            )}
            <button className="btn" onClick={onNew}>
              Làm đề mới
            </button>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <h3 style={{ fontSize: 16 }}>Xem lại đáp án</h3>
        <span className="spacer" />
        <div className="chips">
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            Tất cả ({session.items.length})
          </button>
          <button
            className={`chip ${filter === 'wrong' ? 'on' : ''}`}
            onClick={() => setFilter('wrong')}
          >
            Câu sai ({wrong.length})
          </button>
        </div>
      </div>

      <div className="review-list">
        {list.length === 0 && <div className="panel empty">Không có câu nào trong mục này.</div>}
        {list.map((q, i) => (
          <ReviewItem key={q.id} q={q} index={session.items.indexOf(q) + 1} answer={session.answers[q.id]} />
        ))}
      </div>
    </div>
  );
}

function ReviewItem({ q, index, answer }: { q: Question; index: number; answer?: string }) {
  const auto = isAuto(q);
  const ok = auto ? isCorrect(q, answer) : null;
  const verdictClass = ok === true ? 'ok' : ok === false ? 'bad' : 'skip';
  const verdictText = ok === true ? 'Đúng' : ok === false ? 'Sai' : 'Tự chấm';

  return (
    <div className="panel review-item">
      <div className="q-top">
        <span className="tag">Câu {index}</span>
        <span className={`tag ${q.section === 'extra' ? 'green' : 'blue'}`}>{TYPE_LABEL[q.type]}</span>
        <span className="tag">{chapterLabel(q.chapter)}</span>
        <span className="spacer" />
        <span className={`verdict ${verdictClass}`}>{verdictText}</span>
      </div>
      <div className="question-text" style={{ fontSize: 16, marginBottom: 12 }}>
        {q.question}
      </div>

      {auto && (
        <div className="options">
          {q.options.map((o) => {
            const isAnswer = o.id === q.answer;
            const isPicked = o.id === answer;
            const cls = isAnswer ? 'option correct' : isPicked ? 'option wrong' : 'option';
            return (
              <div key={o.id} className={cls} style={{ cursor: 'default' }}>
                <span className="letter">{o.id}</span>
                <span>
                  {o.text}
                  {isPicked && <span className="tiny muted"> (bạn chọn)</span>}
                  {isAnswer && <span className="tiny" style={{ color: 'var(--ok)' }}> (đáp án)</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!auto && (
        <div className="answer-box">
          <span className="label">Bài làm của bạn</span>
          {answer?.trim() ? answer : <span className="muted">(chưa trả lời)</span>}
        </div>
      )}

      {q.explanation && (
        <div className="feedback info" style={{ marginTop: 12 }}>
          <span className="label">Giải thích</span>
          {q.explanation}
        </div>
      )}

      {q.modelAnswer && (
        <div className="answer-box" style={{ borderStyle: 'solid', background: '#f8fafc' }}>
          <span className="label">{q.type === 'exercise' ? 'Lời giải chi tiết' : 'Đáp án mẫu'}</span>
          {q.modelAnswer}
        </div>
      )}

      {q.sourceUrl && (
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Nguồn:{' '}
          <a href={q.sourceUrl} target="_blank" rel="noreferrer">
            {q.topic || 'Studocu'}
          </a>
        </p>
      )}
    </div>
  );
}

/* ===================================================================== */
/* Bank                                                                  */
/* ===================================================================== */

function BankView({ bank, section, onBack }: { bank: Bank; section: Section; onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<QType | 'all'>('all');
  const [chapter, setChapter] = useState<number | 'all'>('all');
  const [limit, setLimit] = useState(30);
  const chapters = chapterList(bank, section);
  const counts = countsFor(bank, section);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bank.questions.filter((q) => {
      if (q.section !== section) return false;
      if (type !== 'all' && q.type !== type) return false;
      if (chapter !== 'all' && q.chapter !== chapter) return false;
      if (!needle) return true;
      const hay = [q.question, q.topic, q.explanation, q.modelAnswer, ...q.options.map((o) => o.text)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [bank, section, query, type, chapter]);

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quay lại
        </button>
        <span className={`badge ${section === 'extra' ? 'teal' : ''}`}>{SECTION_LABEL[section]}</span>
      </div>

      <div className="panel" style={{ padding: 20 }}>
        <h1 style={{ fontSize: 22 }}>Ngân hàng câu hỏi</h1>
        <p className="small muted" style={{ marginTop: 4 }}>
          {results.length} mục phù hợp. Bấm vào từng câu để xem đáp án và giải thích.
        </p>

        <div className="searchbar" style={{ marginTop: 16 }}>
          <input
            type="search"
            placeholder="Tìm theo nội dung, khái niệm, đáp án…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(30);
            }}
          />
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as QType | 'all');
              setLimit(30);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="all">Mọi dạng</option>
            {TYPE_ORDER.filter((t) => (counts[t] || 0) > 0).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            value={String(chapter)}
            onChange={(e) => {
              setChapter(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setLimit(30);
            }}
            style={{ maxWidth: 160 }}
          >
            <option value="all">Mọi chương</option>
            {chapters.map((ch) => (
              <option key={ch} value={ch}>
                {chapterLabel(ch)}
              </option>
            ))}
          </select>
        </div>

        <div className="bank-list">
          {results.slice(0, limit).map((q, i) => (
            <details className="bank-item" key={q.id}>
              <summary>
                <span className="idx">{i + 1}</span>
                <span>
                  {q.question}
                  <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>
                    {TYPE_LABEL[q.type]} · {chapterLabel(q.chapter)}
                    {q.topic ? ` · ${q.topic}` : ''}
                  </span>
                </span>
              </summary>
              <div className="bank-body">
                {q.options.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {q.options.map((o) => (
                      <div key={o.id} className={`opt ${o.id === q.answer ? 'correct' : ''}`}>
                        {o.id}. {o.text}
                        {o.id === q.answer ? '  ✓' : ''}
                      </div>
                    ))}
                  </div>
                )}
                {q.explanation && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Giải thích: </strong>
                    {q.explanation}
                  </div>
                )}
                {q.modelAnswer && (
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    <strong>{q.type === 'exercise' ? 'Lời giải: ' : 'Đáp án mẫu: '}</strong>
                    {q.modelAnswer}
                  </div>
                )}
                {q.sourceUrl && (
                  <p className="tiny muted" style={{ marginTop: 8 }}>
                    Nguồn:{' '}
                    <a href={q.sourceUrl} target="_blank" rel="noreferrer">
                      {q.topic || 'Studocu'}
                    </a>
                  </p>
                )}
              </div>
            </details>
          ))}
          {results.length === 0 && <div className="empty">Không tìm thấy câu phù hợp.</div>}
        </div>

        {results.length > limit && (
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className="btn" onClick={() => setLimit((n) => n + 30)}>
              Tải thêm ({results.length - limit})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================== */
/* Flashcards                                                            */
/* ===================================================================== */

function FlashView({
  bank,
  section,
  known,
  setKnown,
  onBack,
}: {
  bank: Bank;
  section: Section;
  known: Record<string, true>;
  setKnown: React.Dispatch<React.SetStateAction<Record<string, true>>>;
  onBack: () => void;
}) {
  const cards = useMemo(
    () => bank.questions.filter((q) => q.section === section && q.type === 'flashcard'),
    [bank, section]
  );
  const [deck, setDeck] = useState<Question[]>(() => shuffle(cards));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hideKnown, setHideKnown] = useState(false);

  useEffect(() => {
    setDeck(shuffle(cards));
    setIndex(0);
    setFlipped(false);
  }, [section]);

  const visible = deck.filter((c) => !hideKnown || !known[c.id]);
  const current = visible.length ? visible[index % visible.length] : null;
  const knownCount = cards.filter((c) => known[c.id]).length;

  if (!cards.length) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quay lại
        </button>
        <div className="panel empty">Phần này chưa có thẻ ghi nhớ.</div>
      </div>
    );
  }

  if (!current) {
    return (
      <div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quay lại
        </button>
        <div className="panel empty">
          Bạn đã đánh dấu nhớ hết {cards.length} thẻ. Tắt “Ẩn thẻ đã nhớ” để xem lại.
        </div>
      </div>
    );
  }

  const next = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + visible.length) % visible.length);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Quay lại
        </button>
        <span className={`badge ${section === 'extra' ? 'teal' : ''}`}>{SECTION_LABEL[section]}</span>
        <span className="small muted">
          {index + 1}/{visible.length} thẻ
        </span>
        <span className="spacer" />
        <span className="small muted">Đã nhớ {knownCount}/{cards.length}</span>
      </div>

      <div className="flash-wrap">
        <div
          className={`flashcard ${flipped ? 'flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
        >
          <div className="flashcard-inner">
            <div className="flash-face">
              <span className="kicker">{chapterLabel(current.chapter)} · Thuật ngữ</span>
              <span className="term">{current.question}</span>
              <span className="tiny muted">Bấm hoặc nhấn Space để lật thẻ</span>
            </div>
            <div className="flash-face back">
              <span className="kicker">Định nghĩa</span>
              <span className="def">{current.modelAnswer}</span>
            </div>
          </div>
        </div>

        <div className="flash-controls">
          <button className="btn" onClick={() => next(-1)}>
            ← Trước
          </button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>
            Lật thẻ
          </button>
          <button className="btn" onClick={() => next(1)}>
            Tiếp →
          </button>
          <button
            className={`btn ${known[current.id] ? 'btn-primary' : ''}`}
            onClick={() =>
              setKnown((k) => {
                const copy = { ...k };
                if (copy[current.id]) delete copy[current.id];
                else copy[current.id] = true;
                return copy;
              })
            }
          >
            {known[current.id] ? 'Bỏ đánh dấu' : 'Đã nhớ'}
          </button>
          <button
            className="btn"
            onClick={() => {
              setDeck(shuffle(cards));
              setIndex(0);
              setFlipped(false);
            }}
          >
            Xáo trộn
          </button>
          <button className={`btn ${hideKnown ? 'btn-primary' : ''}`} onClick={() => setHideKnown((v) => !v)}>
            Ẩn thẻ đã nhớ
          </button>
        </div>
      </div>
    </div>
  );
}

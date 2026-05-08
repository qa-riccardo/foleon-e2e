import type {
  Reporter, FullConfig, Suite, TestCase, TestResult, TestStep, FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StepData {
  title: string;
  category: 'action' | 'assertion';
  duration: number;
  status: 'passed' | 'failed';
  steps: StepData[];
}

interface TestData {
  title: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  steps: StepData[];
  screenshots: string[];
  videoPath: string | null;
  error?: string;
}

interface SuiteData { title: string; tests: TestData[]; }

interface Signal {
  emoji: string;
  name: string;
  detail: string;
  color: 'green' | 'blue' | 'amber';
  status: 'pass' | 'warn';
}

interface RunEntry {
  id: string;
  startTime: string;
  duration: number;
  status: string;
  passed: number;
  failed: number;
  total: number;
  suites: SuiteData[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ms = (n: number) => n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;

function stepIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('navigate') || t.includes('open editor') || t.includes('login'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clip-rule="evenodd"/></svg>`;
  if (t.includes('color') || t.includes('background') || t.includes('swatch') || t.includes('palette'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd"/></svg>`;
  if (t.includes('font') || t.includes('typography') || t.includes('header') || t.includes('lucida'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"/><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"/></svg>`;
  if (t.includes('logo') || t.includes('image') || t.includes('media'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg>`;
  if (t.includes('save') || t.includes('confirm') || t.includes('modal'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z"/></svg>`;
  if (t.includes('chart'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>`;
  if (t.includes('navigation') || t.includes('content') || t.includes('tab') || t.includes('mode'))
    return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`;
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/></svg>`;
}

function assertionLabel(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('not.tobevisible') || t.includes('tobehidden')) return 'Element dismissed from view';
  if (t.includes('tobevisible')) return 'Element visible on page';
  if (t.includes('tohavecss')) return 'Visual style verified';
  if (t.includes('tocontaintext') || t.includes('tohavetext')) return 'Content text verified';
  if (t.includes('tobechecked')) return 'Checkbox state verified';
  if (t.includes('tohaveurl') || t.includes('tohavetitle')) return 'Page state verified';
  if (t.includes('tohavecount')) return 'Element count verified';
  return 'Assertion passed';
}

function collectSteps(raw: TestStep[]): StepData[] {
  return raw
    .filter(s => s.category === 'test.step')
    .map(s => ({
      title: s.title,
      category: 'action' as const,
      duration: s.duration,
      status: (s.error ? 'failed' : 'passed') as 'passed' | 'failed',
      steps: collectAssertions(s.steps),
    }));
}

function collectAssertions(raw: TestStep[]): StepData[] {
  const out: StepData[] = [];
  for (const s of raw) {
    if (s.category === 'expect') {
      out.push({ title: assertionLabel(s.title), category: 'assertion', duration: s.duration, status: s.error ? 'failed' : 'passed', steps: [] });
    } else if (s.category === 'test.step') {
      out.push({ title: s.title, category: 'action', duration: s.duration, status: s.error ? 'failed' : 'passed', steps: collectAssertions(s.steps) });
    }
  }
  return out;
}

// ─── Quality Signals ─────────────────────────────────────────────────────────

function deriveSignals(suites: SuiteData[]): Signal[] {
  const all = suites.flatMap(s => s.tests);
  const failed = all.filter(t => !['passed', 'skipped'].includes(t.status)).length;
  const screenshots = all.reduce((n, t) => n + t.screenshots.length, 0);
  const videos = all.filter(t => t.videoPath).length;
  const titles = all.flatMap(t => t.steps.map(s => s.title.toLowerCase()));

  const signals: Signal[] = [
    { emoji: '🗺', name: 'End-to-End Flow', detail: failed === 0 ? 'All user journeys validated' : `${failed} failure(s) detected`, color: 'green', status: failed === 0 ? 'pass' : 'warn' },
    { emoji: '📸', name: 'Visual Evidence', detail: screenshots > 0 ? `${screenshots} screenshots captured` : 'No screenshots available', color: screenshots > 0 ? 'green' : 'amber', status: screenshots > 0 ? 'pass' : 'warn' },
    { emoji: '🎬', name: 'Execution Recording', detail: videos > 0 ? `${videos} recording(s) available` : 'No recordings available', color: videos > 0 ? 'green' : 'amber', status: videos > 0 ? 'pass' : 'warn' },
  ];

  if (titles.some(t => t.includes('font') || t.includes('typography') || t.includes('header')))
    signals.push({ emoji: '✍️', name: 'Typography Rules', detail: 'Font styles validated', color: 'blue', status: 'pass' });
  if (titles.some(t => t.includes('brand') || t.includes('color') || t.includes('palette') || t.includes('swatch')))
    signals.push({ emoji: '🎨', name: 'Brand Consistency', detail: 'Color system verified', color: 'blue', status: 'pass' });
  if (titles.some(t => t.includes('logo') || t.includes('media') || t.includes('image')))
    signals.push({ emoji: '🖼', name: 'Media Assets', detail: 'Asset library tested', color: 'blue', status: 'pass' });
  if (titles.some(t => t.includes('save') || t.includes('persist')))
    signals.push({ emoji: '💾', name: 'Data Persistence', detail: 'Save flow confirmed', color: 'green', status: 'pass' });

  return signals;
}

// ─── Release Gate ────────────────────────────────────────────────────────────

interface GateCheck { label: string; pass: boolean; detail: string }

interface ReleaseGate {
  verdict: 'approved' | 'conditional' | 'blocked';
  score: number;
  checks: GateCheck[];
  summary: string;
}

function computeReleaseGate(run: RunEntry): ReleaseGate {
  const all = run.suites.flatMap(s => s.tests);
  const timedOut = all.filter(t => t.status === 'timedOut').length;
  const withScreenshots = all.filter(t => t.screenshots.length > 0).length;
  const activeSuites = run.suites.filter(s => s.tests.length > 0).length;

  let score = 0;

  const checks: GateCheck[] = [
    {
      label: 'Zero failures',
      pass: run.failed === 0,
      detail: run.failed === 0 ? `All ${run.total} test(s) passed` : `${run.failed} failure(s) detected`,
    },
    {
      label: 'No timeouts',
      pass: timedOut === 0,
      detail: timedOut === 0 ? 'Stable execution environment' : `${timedOut} test(s) timed out`,
    },
    {
      label: 'Visual evidence captured',
      pass: withScreenshots > 0,
      detail: withScreenshots > 0 ? `${withScreenshots} test(s) with screenshots` : 'No screenshots captured',
    },
    {
      label: 'Multi-suite coverage',
      pass: activeSuites >= 2,
      detail: `${activeSuites} test suite(s) executed`,
    },
  ];

  if (run.failed === 0) score += 50;
  if (timedOut === 0) score += 20;
  if (withScreenshots > 0) score += 20;
  if (activeSuites >= 2) score += 10;

  const hardBlocked = run.failed > 0 || timedOut > 0;
  const verdict: ReleaseGate['verdict'] = hardBlocked
    ? 'blocked'
    : score >= 80 ? 'approved' : 'conditional';

  const summary = {
    approved: 'Automated gate passed · Safe to deploy to production',
    conditional: 'Gate passed with caveats · Lightweight review recommended before deploy',
    blocked: 'Gate failed · Resolve all failures before deploying to production',
  }[verdict];

  return { verdict, score, checks, summary };
}

function renderReleaseGate(gate: ReleaseGate, runId: string): string {
  const r = 28, cx = 36, cy = 36;
  const circumference = parseFloat((2 * Math.PI * r).toFixed(1));
  const targetOffset = parseFloat((circumference * (1 - gate.score / 100)).toFixed(1));

  const icon = gate.verdict === 'approved' ? '✦' : gate.verdict === 'conditional' ? '⚑' : '✕';
  const verdictLabel = gate.verdict === 'approved'
    ? 'RELEASE APPROVED'
    : gate.verdict === 'conditional'
    ? 'REVIEW RECOMMENDED'
    : 'RELEASE BLOCKED';

  const checksHtml = gate.checks.map(c => `
    <div class="rg-check">
      <span class="rg-check-ico ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✕'}</span>
      <span class="rg-check-lbl">${esc(c.label)}</span>
      <span class="rg-check-detail">${esc(c.detail)}</span>
    </div>`).join('');

  return `<div class="release-gate rg-${gate.verdict} fade-up" id="rg-${esc(runId)}">
  <div class="rg-icon">${icon}</div>
  <div class="rg-main">
    <div class="rg-verdict">${verdictLabel}</div>
    <div class="rg-desc">${esc(gate.summary)}</div>
  </div>
  <div class="rg-score-wrap">
    <div class="rg-score-ring">
      <svg viewBox="0 0 72 72" style="transform:rotate(-90deg)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="5" stroke-linecap="round"
          class="rg-ring-fill"
          style="stroke-dasharray:${circumference};stroke-dashoffset:${circumference}"
          data-rg-offset="${targetOffset}"/>
      </svg>
      <div class="rg-score-num">
        <span class="rg-score-n" data-n="${gate.score}">0</span>
        <span class="rg-score-lbl">score</span>
      </div>
    </div>
    <div class="rg-score-tag">confidence</div>
  </div>
  <div class="rg-checks">${checksHtml}</div>
</div>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#f0f2f7;
  --card:#ffffff;
  --card-alt:#f7f8fc;
  --hero-a:#0f1225;
  --hero-b:#1a1d4e;
  --hero-c:#252a7a;
  --t1:#111827;
  --t2:#4b5563;
  --t3:#9ca3af;
  --acc:#4f46e5;
  --acc-s:#eef2ff;
  --pass:#16a34a;
  --pass-s:#dcfce7;
  --pass-b:#86efac;
  --fail:#dc2626;
  --fail-s:#fee2e2;
  --fail-b:#fca5a5;
  --skip:#6b7280;
  --skip-s:#f3f4f6;
  --warn:#d97706;
  --warn-s:#fef3c7;
  --brd:#e5e7eb;
  --brd2:#d1d5db;
  --sh0:0 1px 2px rgba(0,0,0,.05);
  --sh1:0 1px 4px rgba(0,0,0,.06),0 2px 10px rgba(0,0,0,.04);
  --sh2:0 4px 14px rgba(0,0,0,.08),0 1px 4px rgba(0,0,0,.04);
  --sh3:0 8px 28px rgba(0,0,0,.1),0 2px 8px rgba(0,0,0,.05);
  --r:12px;
  --rsm:8px;
  --rxs:5px;
  --rfl:9999px;
  --font:'Inter',system-ui,-apple-system,sans-serif;
  --mono:'SF Mono','Fira Code','Cascadia Code',monospace;
}

[data-theme="dark"]{
  --bg:#0c0e1a;
  --card:#131628;
  --card-alt:#1a1e35;
  --t1:#f1f5f9;
  --t2:#94a3b8;
  --t3:#475569;
  --acc-s:rgba(79,70,229,.18);
  --brd:rgba(255,255,255,.07);
  --brd2:rgba(255,255,255,.13);
  --pass-s:rgba(22,163,74,.12);
  --pass-b:rgba(22,163,74,.28);
  --fail-s:rgba(220,38,38,.12);
  --fail-b:rgba(220,38,38,.28);
  --skip-s:rgba(107,114,128,.1);
  --warn-s:rgba(217,119,6,.12);
  --sh0:0 1px 2px rgba(0,0,0,.25);
  --sh1:0 1px 4px rgba(0,0,0,.3),0 2px 10px rgba(0,0,0,.2);
  --sh2:0 4px 14px rgba(0,0,0,.35),0 1px 4px rgba(0,0,0,.2);
  --sh3:0 8px 28px rgba(0,0,0,.45),0 2px 8px rgba(0,0,0,.2);
}

body{font-family:var(--font);background:var(--bg);color:var(--t1);min-height:100vh;-webkit-font-smoothing:antialiased;transition:background .3s,color .3s}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--brd2);border-radius:3px}

/* ══ TOPNAV ══ */
.topnav{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--brd);padding:0 24px;display:flex;align-items:center;gap:12px;height:50px;box-shadow:var(--sh1)}
.topnav-logo{width:28px;height:28px;background:var(--acc);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.topnav-name{font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.01em;white-space:nowrap}
.topnav-sub{font-size:13px;color:var(--t2);font-weight:500;white-space:nowrap}
.topnav-sep{width:1px;height:18px;background:var(--brd);flex-shrink:0}
.topnav-spacer{flex:1}
.topnav-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.topnav-theme-btn{width:30px;height:30px;border-radius:var(--rsm);border:1px solid var(--brd);background:transparent;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all .15s;line-height:1;font-family:var(--font);flex-shrink:0}
.topnav-theme-btn:hover{border-color:var(--acc);background:var(--acc-s);color:var(--acc)}

/* run history dropdown */
.run-hist-wrap{position:relative}
.run-hist-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border:1px solid var(--brd);border-radius:var(--rsm);background:transparent;color:var(--t2);font-size:13px;font-weight:600;font-family:var(--font);cursor:pointer;transition:all .15s;line-height:1;white-space:nowrap}
.run-hist-btn svg{width:13px;height:13px;flex-shrink:0}
.run-hist-btn:hover,.run-hist-btn.open{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.run-hist-ct{background:var(--acc);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--rfl);line-height:1.4}
.run-hist-chev{transition:transform .2s}
.run-hist-btn.open .run-hist-chev{transform:rotate(180deg)}
.run-hist-panel{position:absolute;top:calc(100% + 8px);right:0;width:360px;background:var(--card);border:1px solid var(--brd);border-radius:var(--r);box-shadow:var(--sh3);z-index:500;overflow:hidden;display:none}
.run-hist-panel.open{display:block;animation:hist-in .14s cubic-bezier(.4,0,.2,1)}
@keyframes hist-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}
.run-hist-hd{padding:10px 14px 9px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between}
.run-hist-hd-lbl{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t2)}
.run-hist-hd-sub{font-size:12px;color:var(--t2)}
.run-hist-list{padding:6px;max-height:400px;overflow-y:auto}
.run-hist-card{padding:10px 36px 10px 12px;border-radius:var(--rsm);cursor:pointer;border:1px solid transparent;transition:all .15s;margin-bottom:3px;position:relative}
.run-hist-card:last-child{margin-bottom:0}
.run-hist-card:hover{background:var(--card-alt);border-color:var(--brd)}
.run-hist-card.active{background:var(--acc-s);border-color:var(--acc)}
.run-hist-card-top{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.run-hist-status{display:flex;align-items:center;gap:5px;flex:1;min-width:0}
.run-hist-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.run-hist-dot.pass{background:var(--pass)}
.run-hist-dot.fail{background:var(--fail)}
.run-hist-vtext{font-size:13px;font-weight:700;white-space:nowrap}
.run-hist-vtext.pass{color:var(--pass)}
.run-hist-vtext.fail{color:var(--fail)}
.run-hist-date{font-size:12px;color:var(--t2);white-space:nowrap;flex-shrink:0}
.run-hist-meta{font-size:12px;color:var(--t2);font-family:var(--mono);white-space:nowrap;flex-shrink:0}
.run-hist-bar-track{height:3px;background:var(--brd);border-radius:var(--rfl);overflow:hidden}
.run-hist-bar-fill{height:100%;border-radius:var(--rfl)}
.run-hist-bar-fill.pass{background:var(--pass)}
.run-hist-bar-fill.fail{background:var(--fail)}
.run-hist-del{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;background:transparent;border:1px solid transparent;cursor:pointer;font-size:14px;color:var(--t3);display:flex;align-items:center;justify-content:center;transition:all .15s;opacity:0;line-height:1;padding:0;font-family:var(--font)}
.run-hist-card:hover .run-hist-del{opacity:1}
.run-hist-del:hover{background:var(--fail-s);border-color:var(--fail-b);color:var(--fail)}
.run-pane{display:none}
.run-pane.active{display:block}

/* ══ TOAST ══ */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--t1);color:var(--card);padding:9px 16px;border-radius:var(--rfl);font-size:12px;font-weight:500;box-shadow:var(--sh3);opacity:0;transition:opacity .22s;pointer-events:none;z-index:9000;white-space:nowrap}
.toast.show{opacity:1}

/* ══ HERO ══ */
.hero{background:linear-gradient(148deg,var(--hero-a) 0%,var(--hero-b) 52%,var(--hero-c) 100%);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 65% 65% at 82% 8%,rgba(99,102,241,.2) 0%,transparent 55%),radial-gradient(ellipse 45% 55% at 8% 85%,rgba(139,92,246,.14) 0%,transparent 55%);pointer-events:none}
.hero::after{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}
.hero-inner{max-width:1200px;margin:0 auto;padding:34px 32px 0;position:relative;z-index:1}

.hero-top{display:flex;align-items:center;gap:14px;margin-bottom:40px}
.hero-icon{width:38px;height:38px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;backdrop-filter:blur(8px)}
.hero-brand-name{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.85);line-height:1.2}
.hero-brand-sub{font-size:12px;color:rgba(255,255,255,.55);letter-spacing:.07em;text-transform:uppercase}
.hero-spacer{flex:1}
.hero-right{display:flex;align-items:center;gap:12px}
.hero-datechip{font-size:13px;color:rgba(255,255,255,.62);display:flex;align-items:center;gap:8px}
.hero-datechip-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.3)}
.hero-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:var(--rfl);font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.hero-badge.passed{background:rgba(22,163,74,.2);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
.hero-badge.failed{background:rgba(220,38,38,.2);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.hero-badge-dot{width:5px;height:5px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

.hero-kpis{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1.8fr;gap:13px;align-items:start}
.kpi{background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.09);border-radius:var(--r);padding:18px 20px;backdrop-filter:blur(10px);transition:background .2s}
.kpi:hover{background:rgba(255,255,255,.1)}
.kpi-val{font-size:38px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums;margin-bottom:6px}
.kpi-val.c-pass{color:#4ade80}
.kpi-val.c-fail{color:#f87171}
.kpi-lbl{font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.55)}

.kpi-rate .kpi-rate-num{font-size:46px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em;margin-bottom:3px}
.kpi-rate .kpi-lbl{margin-bottom:14px}
.kpi-bar-track{height:7px;background:rgba(255,255,255,.1);border-radius:var(--rfl);overflow:hidden;margin-bottom:8px}
.kpi-bar-fill{height:100%;border-radius:var(--rfl);transition:width 1.3s cubic-bezier(.4,0,.2,1)}
.kpi-bar-fill.pass{background:linear-gradient(90deg,#4ade80,#22c55e)}
.kpi-bar-fill.fail{background:linear-gradient(90deg,#f87171,#ef4444)}
.kpi-rate-sub{font-size:13px;color:rgba(255,255,255,.55)}

.hero-wave{margin-top:38px;height:46px;background:linear-gradient(to bottom,transparent,var(--bg));position:relative;z-index:1;transition:background .3s}

/* ══ LAYOUT ══ */
.app{max-width:1200px;margin:0 auto;padding:0 32px 80px}

/* ══ SIGNALS ══ */
.signals{margin:20px 0 26px}
.signals-hd{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t2);margin-bottom:10px;display:flex;align-items:center;gap:10px}
.signals-hd::after{content:'';flex:1;height:1px;background:var(--brd)}
.signals-grid{display:grid;gap:12px}
.signal{background:var(--card);border:1px solid var(--brd);border-radius:10px;padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;box-shadow:var(--sh0);transition:box-shadow .2s,transform .2s;position:relative;overflow:hidden}
.signal::before{content:'';position:absolute;top:0;left:0;right:0;height:4px}
.signal.pass::before{background:var(--pass)}
.signal.warn::before{background:var(--warn)}
.signal:hover{box-shadow:var(--sh1);transform:translateY(-2px)}
.signal-top{display:flex;align-items:center;justify-content:space-between}
.signal-em{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.signal-em.green{background:var(--pass-s)}
.signal-em.blue{background:var(--acc-s)}
.signal-em.amber{background:var(--warn-s)}
.signal-badge{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:999px}
.signal-badge.pass{background:var(--pass-s);color:var(--pass)}
.signal-badge.warn{background:var(--warn-s);color:var(--warn)}
.signal-name{font-size:14px;font-weight:700;color:var(--t1);line-height:1.3}
.signal-detail{font-size:12px;color:var(--t2);line-height:1.5}

/* ══ FILTER BAR ══ */
.filter-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.filter-lbl{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t2);margin-right:4px}
.filter-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border:1px solid var(--brd);border-radius:var(--rfl);background:var(--card);color:var(--t2);font-size:13px;font-weight:500;font-family:var(--font);cursor:pointer;transition:all .15s;white-space:nowrap;box-shadow:var(--sh0)}
.filter-btn:hover{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.filter-btn.active{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,.3)}
.filter-n{font-size:11px;font-weight:700;padding:1px 5px;border-radius:var(--rfl);background:rgba(0,0,0,.08);min-width:17px;text-align:center}
.filter-btn.active .filter-n{background:rgba(255,255,255,.22)}

/* ══ SUITE ══ */
.suite{margin-bottom:24px}
.suite-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.suite-name{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t2)}
.suite-ct{font-size:12px;color:var(--t2);background:var(--brd);border-radius:var(--rfl);padding:2px 8px}

/* ══ TEST CARD ══ */
.tc{background:var(--card);border:1px solid var(--brd);border-radius:var(--r);box-shadow:var(--sh1);margin-bottom:8px;overflow:hidden;transition:box-shadow .2s,border-color .2s}
.tc:hover{box-shadow:var(--sh2)}
.tc.passed{border-left:3px solid var(--pass)}
.tc.failed,.tc.timedOut{border-left:3px solid var(--fail);box-shadow:var(--sh1),0 0 0 1px rgba(220,38,38,.06)}
.tc.skipped{border-left:3px solid var(--skip)}
.tc[data-hidden]{display:none}

.tc-sum{display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;list-style:none;-webkit-user-select:none;user-select:none;transition:background .15s}
.tc-sum::-webkit-details-marker{display:none}
.tc-sum:hover{background:var(--card-alt)}
.tc-chev{width:16px;height:16px;flex-shrink:0;margin-left:auto;color:var(--t3);transition:transform .25s cubic-bezier(.4,0,.2,1)}
details[open]>.tc-sum .tc-chev{transform:rotate(180deg);color:var(--t2)}
.tc-chev svg{width:16px;height:16px}

.pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--rfl);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0;border:1px solid transparent}
.pill.passed{background:var(--pass-s);color:var(--pass);border-color:var(--pass-b)}
.pill.failed,.pill.timedOut{background:var(--fail-s);color:var(--fail);border-color:var(--fail-b)}
.pill.skipped{background:var(--skip-s);color:var(--skip);border-color:var(--brd)}
.pill-dot{width:4px;height:4px;border-radius:50%;background:currentColor}

.tc-title{flex:1;font-size:15px;font-weight:600;color:var(--t1);line-height:1.4;min-width:0}
.tc-meta{display:flex;align-items:center;gap:7px;flex-shrink:0}
.tc-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:var(--rfl);font-size:12px;font-weight:500;color:var(--t2);background:var(--card-alt);border:1px solid var(--brd)}
.tc-dur{font-size:13px;color:var(--t2);font-family:var(--mono);flex-shrink:0}
.tc-body{border-top:1px solid var(--brd)}

/* ══ JOURNEY ══ */
.journey{padding:16px 18px 12px}
.journey-hd{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t2);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.journey-hd::after{content:'';flex:1;height:1px;background:var(--brd)}
.step-list{display:flex;flex-direction:column;gap:2px}

.step-item{border-radius:var(--rsm);overflow:hidden;border:1px solid transparent}
.step-item:not(.step-failed):hover{border-color:var(--brd);background:var(--card-alt)}
.step-item.step-failed{background:var(--fail-s);border-color:var(--fail-b)}
details.step-item>summary{list-style:none;cursor:pointer;-webkit-user-select:none;user-select:none}
details.step-item>summary::-webkit-details-marker{display:none}

.step-row{display:flex;align-items:center;gap:9px;padding:7px 10px}
.step-ico{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-ico svg{width:10px;height:10px}
.step-ico.pass{background:var(--pass-s);color:var(--pass)}
.step-ico.fail{background:var(--fail-s);color:var(--fail)}
.step-lbl{flex:1;font-size:14px;font-weight:500;color:var(--t1);line-height:1.35}
.step-lbl.fail{color:var(--fail)}
.step-checks{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--t2);background:var(--card-alt);border:1px solid var(--brd);border-radius:var(--rfl);padding:2px 7px;font-weight:500;white-space:nowrap;transition:all .15s}
details.step-item>summary:hover .step-checks{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.step-arr{transition:transform .2s;font-size:9px;display:inline-block}
details.step-item[open] .step-arr{transform:rotate(180deg)}
.step-dur{font-size:12px;color:var(--t2);font-family:var(--mono);white-space:nowrap}

.asserts{padding:2px 10px 10px 42px;display:flex;flex-direction:column;gap:3px}
.assert-row{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:13px;color:var(--t1)}
.assert-ico{width:14px;text-align:center;font-size:12px;flex-shrink:0}
.assert-ico.pass{color:var(--pass)}
.assert-ico.fail{color:var(--fail)}
.assert-txt{flex:1}
.assert-txt.fail{color:var(--fail);font-weight:500}
.assert-dur{font-size:11px;font-family:var(--mono);color:var(--t2);margin-left:auto}

/* ══ FAILURE ANALYSIS ══ */
.fail-panel{margin:0 18px 14px;border:1px solid var(--fail-b);border-radius:var(--rsm);overflow:hidden}
.fail-hd{display:flex;align-items:center;gap:7px;padding:10px 14px;background:var(--fail-s);border-bottom:1px solid var(--fail-b);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--fail)}
.fail-hd svg{width:13px;height:13px}
.fail-rows{padding:12px 14px 10px;display:flex;flex-direction:column;gap:9px}
.fail-row{display:flex;gap:10px;align-items:flex-start}
.fail-key{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t2);min-width:72px;padding-top:1px;flex-shrink:0}
.fail-val{font-size:13px;color:var(--t1);flex:1;line-height:1.5}
.fail-code{font-family:var(--mono);font-size:12.5px;color:var(--fail);background:var(--fail-s);border:1px solid var(--fail-b);border-radius:var(--rxs);padding:10px 12px;white-space:pre-wrap;word-break:break-word;line-height:1.65;margin:0 14px 14px;max-height:180px;overflow-y:auto}

/* ══ SCREENSHOTS ══ */
.artifacts{border-top:1px solid var(--brd);padding:14px 18px}
.artifacts-hd{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t2);margin-bottom:12px}
.artifacts-hd svg{width:12px;height:12px}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px}
.sc-card{border-radius:var(--rsm);overflow:hidden;border:1px solid var(--brd);background:var(--card-alt);cursor:zoom-in;position:relative;aspect-ratio:16/9;transition:all .2s}
.sc-card:hover{border-color:var(--acc);transform:translateY(-2px);box-shadow:var(--sh2),0 0 0 2px rgba(79,70,229,.1)}
.sc-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.sc-card:hover img{transform:scale(1.04)}
.sc-label{position:absolute;bottom:0;left:0;right:0;padding:18px 8px 5px;background:linear-gradient(to top,rgba(0,0,0,.75),transparent);color:#fff;font-size:11px;font-weight:500;line-height:1}
.sc-n{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;backdrop-filter:blur(4px)}
.sc-zoom{position:absolute;top:5px;right:5px;width:20px;height:20px;background:rgba(0,0,0,.55);border-radius:4px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;backdrop-filter:blur(4px)}
.sc-card:hover .sc-zoom{opacity:1}
.sc-zoom svg{width:10px;height:10px;color:#fff}

/* ══ VIDEO ══ */
.video-sec{border-top:1px solid var(--brd);padding:14px 18px}
.video-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.video-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t2)}
.video-title svg{width:12px;height:12px}
.video-dl{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--acc);text-decoration:none;font-weight:500;padding:4px 10px;border:1px solid var(--acc);border-radius:var(--rfl);transition:all .15s}
.video-dl:hover{background:var(--acc);color:#fff}
.video-dl svg{width:11px;height:11px}
.video-wrap{border-radius:var(--rsm);overflow:hidden;border:1px solid var(--brd);background:#000}
.video-wrap video{width:100%;max-height:320px;display:block}

/* ══ LIGHTBOX ══ */
#lb{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.9);backdrop-filter:blur(20px);display:none;align-items:center;justify-content:center;padding:20px}
#lb.open{display:flex;animation:lbin .18s ease}
@keyframes lbin{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
#lb-img{max-width:100%;max-height:90vh;border-radius:var(--rsm);box-shadow:0 40px 80px rgba(0,0,0,.6)}
.lb-x{position:absolute;top:14px;right:14px;width:36px;height:36px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;font-size:18px;font-family:var(--font);line-height:1;transition:background .15s}
.lb-x:hover{background:rgba(255,255,255,.22)}

/* ══ MISC ══ */
.empty{text-align:center;padding:56px 20px;color:var(--t3)}
.empty-icon{font-size:36px;margin-bottom:10px}
.fade-up{opacity:0;transform:translateY(10px);transition:opacity .42s cubic-bezier(.4,0,.2,1),transform .42s cubic-bezier(.4,0,.2,1)}
.fade-up.in{opacity:1;transform:none}

/* ══ RELEASE GATE ══ */
.release-gate{border-radius:var(--r);padding:22px 26px;display:flex;align-items:center;gap:22px;margin-bottom:22px;position:relative;overflow:hidden;box-shadow:var(--sh3)}
.release-gate::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(-55deg,rgba(255,255,255,.022) 0,rgba(255,255,255,.022) 1px,transparent 1px,transparent 9px);pointer-events:none}
.rg-approved{background:linear-gradient(140deg,#052e16 0%,#14532d 60%,#166534 100%);border:1px solid rgba(74,222,128,.2)}
.rg-conditional{background:linear-gradient(140deg,#1c1007 0%,#451a03 60%,#7c2d12 100%);border:1px solid rgba(251,191,36,.2)}
.rg-blocked{background:linear-gradient(140deg,#1c0a0a 0%,#450a0a 60%,#7f1d1d 100%);border:1px solid rgba(248,113,113,.2)}

.rg-icon{font-size:32px;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:900;font-family:var(--mono)}
.rg-approved .rg-icon{color:#4ade80;background:rgba(74,222,128,.12);border:2px solid rgba(74,222,128,.25);text-shadow:0 0 20px rgba(74,222,128,.5)}
.rg-conditional .rg-icon{color:#fbbf24;background:rgba(251,191,36,.1);border:2px solid rgba(251,191,36,.25)}
.rg-blocked .rg-icon{color:#f87171;background:rgba(248,113,113,.1);border:2px solid rgba(248,113,113,.25)}

.rg-main{flex:1;min-width:0}
.rg-verdict{font-size:18px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;line-height:1.2;margin-bottom:6px}
.rg-approved .rg-verdict{color:#4ade80}
.rg-conditional .rg-verdict{color:#fbbf24}
.rg-blocked .rg-verdict{color:#f87171}
.rg-desc{font-size:13px;color:rgba(255,255,255,.72);line-height:1.5;max-width:380px}

.rg-score-wrap{text-align:center;flex-shrink:0}
.rg-score-ring{position:relative;width:72px;height:72px;margin-bottom:4px}
.rg-ring-fill{transition:stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)}
.rg-approved .rg-ring-fill{stroke:#4ade80}
.rg-conditional .rg-ring-fill{stroke:#fbbf24}
.rg-blocked .rg-ring-fill{stroke:#f87171}
.rg-score-num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}
.rg-score-n{font-size:20px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em;font-family:var(--mono)}
.rg-score-lbl{font-size:10px;color:rgba(255,255,255,.72);letter-spacing:.07em;text-transform:uppercase;font-weight:600}
.rg-score-tag{font-size:12px;color:rgba(255,255,255,.72);letter-spacing:.08em;text-transform:uppercase;font-weight:600}

.rg-checks{display:flex;flex-direction:column;gap:7px;flex-shrink:0;min-width:220px}
.rg-check{display:flex;align-items:center;gap:8px}
.rg-check-ico{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:800;line-height:1}
.rg-check-ico.pass{background:rgba(74,222,128,.2);color:#4ade80;border:1px solid rgba(74,222,128,.4)}
.rg-check-ico.fail{background:rgba(248,113,113,.2);color:#f87171;border:1px solid rgba(248,113,113,.4)}
.rg-check-lbl{font-size:13px;color:rgba(255,255,255,.85);flex:1}
.rg-check-detail{font-size:12px;color:rgba(255,255,255,.52);white-space:nowrap;margin-left:4px}

@keyframes rg-pulse{0%,100%{box-shadow:var(--sh3),0 0 0 0 rgba(74,222,128,.15)}60%{box-shadow:var(--sh3),0 0 0 10px rgba(74,222,128,.0)}}
.rg-approved{animation:rg-pulse 3.5s ease-in-out infinite}

/* ══ VIEW TOGGLE ══ */
.view-toggle{display:flex;align-items:center;gap:3px;padding:3px;background:var(--card-alt);border:1px solid var(--brd);border-radius:var(--rsm)}
.view-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border:none;border-radius:5px;background:transparent;color:var(--t2);font-size:12px;font-weight:500;font-family:var(--font);cursor:pointer;transition:all .15s;white-space:nowrap;line-height:1}
.view-btn svg{width:13px;height:13px;flex-shrink:0}
.view-btn.active{background:var(--card);color:var(--acc);box-shadow:var(--sh0);font-weight:600}
.view-btn:not(.active):hover{color:var(--t1)}
.toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;justify-content:space-between}
.toolbar-left{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1}

/* ══ ANALYTICS ══ */
.analytics{margin:0 0 24px}
.analytics-hd{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t2);margin-bottom:10px;display:flex;align-items:center;gap:10px}
.analytics-hd::after{content:'';flex:1;height:1px;background:var(--brd)}
.analytics-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.chart-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--r);padding:18px 20px;box-shadow:var(--sh1)}
.chart-card-hd{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t2);margin-bottom:14px;display:flex;align-items:center;gap:7px}
.chart-card-hd svg{width:12px;height:12px}
.chart-empty{font-size:13px;color:var(--t2);text-align:center;padding:24px 0;font-style:italic}

.chart-donut-wrap{display:flex;align-items:center;gap:18px}
.donut-svg{width:120px;height:120px;flex-shrink:0;overflow:visible}
.donut-pct{font-size:24px;font-weight:800;fill:var(--t1);font-family:var(--font);letter-spacing:-.04em}
.donut-sub{font-size:10px;font-weight:600;fill:var(--t2);letter-spacing:.08em;text-transform:uppercase;font-family:var(--font)}
.donut-legend{display:flex;flex-direction:column;gap:10px;flex:1}
.donut-legend-item{display:flex;align-items:center;gap:8px}
.donut-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.donut-legend-lbl{font-size:13px;color:var(--t1);flex:1}
.donut-legend-n{font-size:14px;font-weight:700;color:var(--t1);font-family:var(--mono)}

.bar-svg{width:100%;height:auto;display:block}
.bar-label{font-size:12px;fill:var(--t1);font-family:var(--font)}
.bar-val{font-size:11px;fill:var(--t2);font-family:var(--mono)}

.trend-svg{width:100%;height:auto;display:block}
.trend-label{font-size:11px;fill:var(--t2);font-family:var(--font)}
.trend-pct{font-size:10px;fill:var(--t2);font-family:var(--font)}

/* ══ BOARD VIEW ══ */
.board-view{overflow-x:auto;padding-bottom:4px}
.board-cols{display:flex;gap:14px;min-width:0;align-items:flex-start}
.board-col{flex:1;min-width:240px;background:var(--card-alt);border:1px solid var(--brd);border-radius:var(--r);overflow:hidden}
.board-col-hd{display:flex;align-items:center;gap:8px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--brd);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t1)}
.board-col-fail>.board-col-hd{border-top:3px solid var(--fail)}
.board-col-pass>.board-col-hd{border-top:3px solid var(--pass)}
.board-col-skip>.board-col-hd{border-top:3px solid var(--skip)}
.board-col-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.board-col-dot.pass{background:var(--pass)}
.board-col-dot.fail{background:var(--fail)}
.board-col-dot.skip{background:var(--skip)}
.board-col-ct{margin-left:auto;background:var(--brd);color:var(--t2);font-size:11px;font-weight:700;padding:1px 7px;border-radius:var(--rfl);font-family:var(--mono);min-width:20px;text-align:center}
.board-cards{padding:9px;display:flex;flex-direction:column;gap:7px;max-height:560px;overflow-y:auto}
.board-card{background:var(--card);border:1px solid var(--brd);border-radius:var(--rsm);padding:11px 13px;box-shadow:var(--sh0);transition:box-shadow .18s,transform .18s}
.board-card:hover{box-shadow:var(--sh1);transform:translateY(-1px)}
.board-card-title{font-size:14px;font-weight:600;color:var(--t1);line-height:1.4;margin-bottom:5px}
.board-card-suite{font-size:11px;color:var(--t2);margin-bottom:7px;font-weight:500;letter-spacing:.05em;text-transform:uppercase}
.board-card-err{font-size:11.5px;color:var(--fail);background:var(--fail-s);border-radius:4px;padding:5px 8px;margin-bottom:7px;line-height:1.4;font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.board-card-meta{display:flex;align-items:center;justify-content:space-between;gap:8px}
.board-empty{font-size:13px;color:var(--t2);text-align:center;padding:20px;font-style:italic}

@media(max-width:900px){
  .hero-inner,.app{padding-left:20px;padding-right:20px}
  .hero-kpis{grid-template-columns:1fr 1fr}
  .hero-datechip{display:none}
  .analytics-grid{grid-template-columns:1fr}
}
@media(max-width:600px){
  .hero-kpis{grid-template-columns:1fr 1fr}
  .sc-grid{grid-template-columns:1fr 1fr}
  .board-col{min-width:200px}
}
`;

// ─── JS ──────────────────────────────────────────────────────────────────────

const JS = `(function(){
  /* Theme */
  const html=document.documentElement;
  const thBtn=document.querySelector('.topnav-theme-btn');
  const saved=localStorage.getItem('fqr-theme')||'light';
  html.dataset.theme=saved;
  if(thBtn)thBtn.textContent=saved==='dark'?'☀️':'🌙';
  if(thBtn)thBtn.addEventListener('click',function(){
    const next=html.dataset.theme==='dark'?'light':'dark';
    html.dataset.theme=next;
    localStorage.setItem('fqr-theme',next);
    thBtn.textContent=next==='dark'?'☀️':'🌙';
  });

  /* Animations */
  function animCount(el){
    const target=parseInt(el.dataset.n,10)||0;
    if(!target)return;
    const dur=900,start=performance.now();
    const tick=t=>{
      const p=Math.min((t-start)/dur,1);
      const e=1-Math.pow(1-p,3);
      el.textContent=Math.round(e*target);
      if(p<1)requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function animPane(pane){
    if(!pane)return;
    pane.querySelectorAll('[data-n]').forEach(animCount);
    pane.querySelectorAll('[data-bar]').forEach(el=>{
      requestAnimationFrame(()=>setTimeout(()=>{el.style.width=el.dataset.bar;},80));
    });
    pane.querySelectorAll('[data-rg-offset]').forEach(el=>{
      requestAnimationFrame(()=>setTimeout(()=>{el.style.strokeDashoffset=el.dataset.rgOffset;},250));
    });
    pane.querySelectorAll('.fade-up').forEach((el,i)=>{
      setTimeout(()=>el.classList.add('in'),i*20);
    });
  }

  const animated=new Set();

  /* Run selector */
  window.selectRun=function(rid){
    document.querySelectorAll('.run-hist-card').forEach(function(c){c.classList.toggle('active',c.dataset.rid===rid);});
    document.querySelectorAll('.run-pane').forEach(function(p){p.classList.toggle('active',p.dataset.rid===rid);});
    const panel=document.getElementById('run-hist-panel');
    const histBtn=document.querySelector('.run-hist-btn');
    if(panel)panel.classList.remove('open');
    if(histBtn)histBtn.classList.remove('open');
    if(!animated.has(rid)){
      animated.add(rid);
      animPane(document.querySelector('.run-pane[data-rid="'+rid+'"]'));
    }
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.toggleRunHistory=function(){
    const panel=document.getElementById('run-hist-panel');
    const histBtn=document.querySelector('.run-hist-btn');
    if(!panel||!histBtn)return;
    const open=panel.classList.toggle('open');
    histBtn.classList.toggle('open',open);
  };

  /* Toast */
  const toastEl=document.getElementById('fqr-toast');
  let toastTmr;
  function showToast(msg){
    if(!toastEl)return;
    toastEl.textContent=msg;
    toastEl.classList.add('show');
    clearTimeout(toastTmr);
    toastTmr=setTimeout(()=>toastEl.classList.remove('show'),2500);
  }

  /* Delete run */
  window.deleteRun=function(rid,e){
    e.stopPropagation();
    const cleanup=function(){
      const card=document.querySelector('.run-hist-card[data-rid="'+rid+'"]');
      const pane=document.querySelector('.run-pane[data-rid="'+rid+'"]');
      const wasActive=card&&card.classList.contains('active');
      if(card)card.remove();
      if(pane)pane.remove();
      const ctEl=document.querySelector('.run-hist-ct');
      if(ctEl){const n=parseInt(ctEl.textContent||'0')-1;ctEl.textContent=String(Math.max(0,n));}
      if(wasActive){
        const first=document.querySelector('.run-hist-card');
        if(first)window.selectRun(first.dataset.rid);
      }
      showToast('Run deleted');
    };
    const hidden=JSON.parse(localStorage.getItem('fqr-hidden')||'[]');
    if(!hidden.includes(rid)){hidden.push(rid);localStorage.setItem('fqr-hidden',JSON.stringify(hidden));}
    fetch('/api/delete/'+encodeURIComponent(rid),{method:'DELETE'}).catch(()=>null).finally(cleanup);
  };

  /* On load: apply localStorage-deleted runs */
  const lsHidden=JSON.parse(localStorage.getItem('fqr-hidden')||'[]');
  lsHidden.forEach(function(rid){
    document.querySelector('.run-hist-card[data-rid="'+rid+'"]')?.remove();
    document.querySelector('.run-pane[data-rid="'+rid+'"]')?.remove();
  });
  const firstCard=document.querySelector('.run-hist-card');
  if(firstCard&&!document.querySelector('.run-pane.active')){
    firstCard.classList.add('active');
    const fp=document.querySelector('.run-pane[data-rid="'+firstCard.dataset.rid+'"]');
    if(fp)fp.classList.add('active');
  }
  const ctEl=document.querySelector('.run-hist-ct');
  if(ctEl)ctEl.textContent=String(document.querySelectorAll('.run-hist-card').length);

  /* Animate initial active pane */
  const initPane=document.querySelector('.run-pane.active');
  if(initPane){
    animated.add(initPane.dataset.rid);
    animPane(initPane);
  }

  /* Close run history on outside click */
  document.addEventListener('click',function(e){
    if(!e.target.closest('.run-hist-wrap')){
      document.getElementById('run-hist-panel')?.classList.remove('open');
      document.querySelector('.run-hist-btn')?.classList.remove('open');
    }
  });

  /* Filter bar — event delegation scoped to run-pane */
  document.addEventListener('click',function(e){
    const btn=e.target.closest('.filter-btn');
    if(!btn)return;
    const pane=btn.closest('.run-pane');
    if(!pane)return;
    pane.querySelectorAll('.filter-btn').forEach(function(b){b.classList.remove('active');});
    btn.classList.add('active');
    const f=btn.dataset.f;
    pane.querySelectorAll('.tc').forEach(function(card){
      let show=true;
      if(f==='passed')show=card.dataset.s==='passed';
      else if(f==='failed')show=['failed','timedOut'].includes(card.dataset.s);
      else if(f==='skipped')show=card.dataset.s==='skipped';
      else if(f==='shots')show=card.dataset.shots==='1';
      else if(f==='video')show=card.dataset.video==='1';
      card.toggleAttribute('data-hidden',!show);
    });
  });

  /* Lightbox */
  const lb=document.getElementById('lb');
  const lbImg=document.getElementById('lb-img');
  document.addEventListener('click',function(e){
    const img=e.target.closest('.sc-card img');
    if(img){lbImg.src=img.src;lb.classList.add('open');document.body.style.overflow='hidden';}
  });
  document.querySelector('.lb-x').addEventListener('click',closeLb);
  lb.addEventListener('click',function(e){if(e.target===lb)closeLb();});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      closeLb();
      document.getElementById('run-hist-panel')?.classList.remove('open');
      document.querySelector('.run-hist-btn')?.classList.remove('open');
    }
  });
  function closeLb(){lb.classList.remove('open');document.body.style.overflow='';lbImg.src='';}

  /* View toggle (list ↔ board) */
  window.setView=function(view,pane){
    if(!pane)return;
    const lv=pane.querySelector('.list-view');
    const bv=pane.querySelector('.board-view');
    pane.querySelectorAll('.view-btn').forEach(function(b){b.classList.toggle('active',b.dataset.view===view);});
    if(lv)lv.style.display=view==='list'?'':'none';
    if(bv)bv.style.display=view==='board'?'':'none';
  };
})();`;

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderStepList(steps: StepData[]): string {
  return steps.map(step => {
    const s = step.status === 'failed' ? 'fail' : 'pass';
    const icon = stepIcon(step.title);
    const asserts = step.steps.filter(x => x.category === 'assertion');
    const nested = step.steps.filter(x => x.category === 'action');
    const hasExpand = asserts.length > 0 || nested.length > 0;

    const assertsHtml = asserts.length ? `<div class="asserts">${asserts.map(a =>
      `<div class="assert-row">
        <span class="assert-ico ${a.status}">${a.status === 'passed' ? '✓' : '✕'}</span>
        <span class="assert-txt ${a.status === 'failed' ? 'fail' : ''}">${esc(a.title)}</span>
        <span class="assert-dur">${ms(a.duration)}</span>
      </div>`).join('')}</div>` : '';

    const nestedHtml = nested.length ? `<div style="padding-left:32px">${renderStepList(nested)}</div>` : '';

    const inner = `
      <div class="step-ico ${s}">${icon}</div>
      <span class="step-lbl ${step.status === 'failed' ? 'fail' : ''}">${esc(step.title)}</span>
      ${asserts.length ? `<span class="step-checks">${asserts.length} check${asserts.length !== 1 ? 's' : ''} <span class="step-arr">▾</span></span>` : ''}
      <span class="step-dur">${ms(step.duration)}</span>`;

    if (hasExpand) {
      return `<details class="step-item step-${step.status}">
        <summary><div class="step-row">${inner}</div></summary>
        ${assertsHtml}${nestedHtml}
      </details>`;
    }
    return `<div class="step-item step-${step.status}"><div class="step-row">${inner}</div></div>`;
  }).join('');
}

function renderScreenshots(screenshots: string[], isFailed: boolean): string {
  if (!screenshots.length) return '';
  const cameraIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`;
  const zoomIcon = `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8V4m0 0h4M3 4l4 4m10-8v4m0 0h-4m4 0l-4-4M3 16v-4m0 0h4m-4 0l4 4m10-4v4m0 0h-4m4 0l-4-4"/></svg>`;
  const total = screenshots.length;
  const items = screenshots.map((src, i) => {
    const label = isFailed && i === total - 1 ? 'Failure State'
      : i === total - 1 ? 'Final State'
      : i === 0 ? 'Initial State'
      : `Step ${i + 1}`;
    return `<div class="sc-card">
      <span class="sc-n">${i + 1}</span>
      <img src="${src}" alt="Screenshot ${i + 1}" loading="lazy"/>
      <span class="sc-label">${label}</span>
      <div class="sc-zoom">${zoomIcon}</div>
    </div>`;
  }).join('');
  return `<div class="artifacts">
    <div class="artifacts-hd">${cameraIcon} Screenshots · ${total}</div>
    <div class="sc-grid">${items}</div>
  </div>`;
}

function renderVideo(videoPath: string | null): string {
  if (!videoPath) return '';
  const filmIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/></svg>`;
  const dlIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
  return `<div class="video-sec">
    <div class="video-hd">
      <div class="video-title">${filmIcon} Test Execution Replay</div>
      <a href="${esc(videoPath)}" download class="video-dl">${dlIcon} Download</a>
    </div>
    <div class="video-wrap">
      <video controls preload="metadata">
        <source src="${esc(videoPath)}" type="video/webm"/>
      </video>
    </div>
  </div>`;
}

// ─── Charts & Board ───────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function svgArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (Math.abs(endDeg - startDeg) >= 360) endDeg = startDeg + 359.99;
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${(endDeg - startDeg) > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function renderDonutChart(passed: number, failed: number, skipped: number): string {
  const total = passed + failed + skipped;
  if (!total) return `<div class="chart-empty">No data</div>`;
  const cx = 80, cy = 80, r = 54, sw = 18;
  const passRate = Math.round((passed / total) * 100);
  let deg = 0;
  const segs: Array<{ color: string; count: number; label: string; path: string }> = [];
  ([
    [passed, 'var(--pass)', 'Passed'],
    [failed, 'var(--fail)', 'Failed'],
    [skipped, 'var(--skip)', 'Skipped'],
  ] as [number, string, string][]).forEach(([n, c, l]) => {
    if (!n) return;
    const end = deg + (n / total) * 360;
    segs.push({ color: c, count: n, label: l, path: svgArcPath(cx, cy, r, deg, end) });
    deg = end;
  });
  const arcs = segs.map(s => `<path d="${s.path}" fill="none" stroke="${s.color}" stroke-width="${sw}"/>`).join('');
  const legend = segs.map(s => `<div class="donut-legend-item"><div class="donut-legend-dot" style="background:${s.color}"></div><span class="donut-legend-lbl">${s.label}</span><span class="donut-legend-n">${s.count}</span></div>`).join('');
  return `<div class="chart-donut-wrap">
    <svg viewBox="0 0 160 160" class="donut-svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--brd)" stroke-width="${sw}"/>
      ${arcs}
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="donut-pct">${passRate}%</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-sub">pass rate</text>
    </svg>
    <div class="donut-legend">${legend}</div>
  </div>`;
}

function renderSuiteBarChart(suites: SuiteData[]): string {
  const stats = suites.map(s => ({
    name: s.title,
    passed: s.tests.filter(t => t.status === 'passed').length,
    failed: s.tests.filter(t => !['passed', 'skipped'].includes(t.status)).length,
    total: s.tests.length,
  })).filter(s => s.total > 0);
  if (!stats.length) return `<div class="chart-empty">No data</div>`;
  const max = Math.max(...stats.map(s => s.total));
  const bH = 22, gap = 10, lW = 112, cW = 160, vW = lW + cW + 40;
  const vH = stats.length * (bH + gap) + 10;
  const rows = stats.map((s, i) => {
    const y = 5 + i * (bH + gap);
    const pW = (s.passed / max) * cW;
    const fW = (s.failed / max) * cW;
    const short = s.name.length > 15 ? s.name.slice(0, 13) + '…' : s.name;
    return `<text x="${lW - 8}" y="${y + bH / 2 + 4}" text-anchor="end" class="bar-label">${esc(short)}</text>${s.passed > 0 ? `<rect x="${lW}" y="${y}" width="${pW.toFixed(1)}" height="${bH}" rx="3" fill="var(--pass)" opacity=".85"/>` : ''}${s.failed > 0 ? `<rect x="${(lW + pW).toFixed(1)}" y="${y}" width="${fW.toFixed(1)}" height="${bH}" rx="3" fill="var(--fail)" opacity=".85"/>` : ''}<text x="${(lW + pW + fW + 6).toFixed(1)}" y="${y + bH / 2 + 4}" class="bar-val">${s.total}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${vW} ${vH}" class="bar-svg">${rows}</svg>`;
}

function renderTrendChart(runs: RunEntry[]): string {
  if (!runs.length) return `<div class="chart-empty">No run history yet</div>`;
  const recent = [...runs].reverse().slice(0, 10);
  const bW = 26, gap = 8, maxH = 90, labelH = 28, pctH = 14;
  const totalW = recent.length * (bW + gap) + gap;
  const totalH = maxH + labelH + pctH;
  const gridLines = [25, 50, 75, 100].map(p => {
    const y = (pctH + maxH - (p / 100) * maxH).toFixed(1);
    return `<line x1="0" y1="${y}" x2="${totalW}" y2="${y}" stroke="var(--brd)" stroke-width="1" stroke-dasharray="3,3"/>`;
  }).join('');
  const bars = recent.map((r, i) => {
    const rate = r.total ? r.passed / r.total : 0;
    const h = Math.max(4, Math.round(rate * maxH));
    const x = gap + i * (bW + gap);
    const y = pctH + maxH - h;
    const d = new Date(r.startTime);
    const pct = Math.round(rate * 100);
    return `<rect x="${x}" y="${y}" width="${bW}" height="${h}" rx="3" fill="${r.failed > 0 ? 'var(--fail)' : 'var(--pass)'}" opacity=".85"/><text x="${x + bW / 2}" y="${pctH + maxH + 14}" text-anchor="middle" class="trend-label">${d.getDate()}/${d.getMonth() + 1}</text>${pct < 100 ? `<text x="${x + bW / 2}" y="${y - 3}" text-anchor="middle" class="trend-pct">${pct}%</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${totalW} ${totalH}" class="trend-svg">${gridLines}${bars}</svg>`;
}

function renderBoardView(suites: SuiteData[], runId: string): string {
  const all = suites.flatMap(s => s.tests);
  const passed = all.filter(t => t.status === 'passed');
  const failed = all.filter(t => !['passed', 'skipped'].includes(t.status));
  const skipped = all.filter(t => t.status === 'skipped');

  const boardCard = (test: TestData, suiteName: string): string => {
    const sc = test.status === 'passed' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed';
    const errLine = sc === 'failed' && test.error
      ? test.error.split('\n')[0].replace(/^Error:\s*/i, '').slice(0, 85) : '';
    return `<div class="board-card">
  <div class="board-card-title">${esc(test.title)}</div>
  ${suiteName ? `<div class="board-card-suite">${esc(suiteName)}</div>` : ''}
  ${errLine ? `<div class="board-card-err">${esc(errLine)}</div>` : ''}
  <div class="board-card-meta">
    <span class="pill ${sc}" style="font-size:11px;padding:2px 8px">${test.status === 'timedOut' ? 'Timeout' : sc}</span>
    <span class="tc-dur">${ms(test.duration)}</span>
  </div>
</div>`;
  };

  const col = (tests: TestData[], colClass: string, dotClass: string, label: string): string => {
    const cards = tests.map(t => boardCard(t, suites.find(s => s.tests.includes(t))?.title ?? '')).join('')
      || `<div class="board-empty">No ${label.toLowerCase()} tests</div>`;
    return `<div class="board-col ${colClass}">
  <div class="board-col-hd"><span class="board-col-dot ${dotClass}"></span>${label}<span class="board-col-ct">${tests.length}</span></div>
  <div class="board-cards">${cards}</div>
</div>`;
  };

  return `<div class="board-view" id="board-${esc(runId)}" style="display:none">
  <div class="board-cols">
    ${col(failed, 'board-col-fail', 'fail', 'Failed')}
    ${col(passed, 'board-col-pass', 'pass', 'Passed')}
    ${skipped.length ? col(skipped, 'board-col-skip', 'skip', 'Skipped') : ''}
  </div>
</div>`;
}

function renderFailurePanel(test: TestData): string {
  if (!test.error) return '';
  const alertIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
  const failedStep = test.steps.find(s => s.status === 'failed');
  const firstLine = test.error.split('\n')[0].replace(/^Error:\s*/i, '').slice(0, 130);
  const evidence = [
    test.screenshots.length > 0 ? `${test.screenshots.length} screenshot(s)` : null,
    test.videoPath ? 'Video recording' : null,
  ].filter(Boolean).join(', ') || 'None captured';

  return `<div class="fail-panel">
    <div class="fail-hd">${alertIcon} Failure Analysis</div>
    <div class="fail-rows">
      <div class="fail-row"><span class="fail-key">What</span><span class="fail-val">${esc(firstLine)}</span></div>
      ${failedStep ? `<div class="fail-row"><span class="fail-key">At step</span><span class="fail-val">${esc(failedStep.title)}</span></div>` : ''}
      <div class="fail-row"><span class="fail-key">Evidence</span><span class="fail-val">${esc(evidence)}</span></div>
    </div>
    <pre class="fail-code">${esc(test.error)}</pre>
  </div>`;
}

function renderTestCard(test: TestData): string {
  const sc = test.status === 'passed' ? 'passed' : test.status === 'skipped' ? 'skipped' : 'failed';
  const label = test.status === 'timedOut' ? 'Timeout' : test.status.charAt(0).toUpperCase() + test.status.slice(1);
  const isFailed = !['passed', 'skipped'].includes(test.status);
  const hasShots = test.screenshots.length > 0;
  const hasVideo = !!test.videoPath;

  const chevron = `<span class="tc-chev"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></span>`;
  const badges = [
    hasShots ? `<span class="tc-badge">📸 ${test.screenshots.length}</span>` : '',
    hasVideo ? `<span class="tc-badge">🎬</span>` : '',
  ].join('');

  const journey = renderStepList(test.steps);
  const failure = renderFailurePanel(test);
  const shots = renderScreenshots(test.screenshots, isFailed);
  const video = renderVideo(test.videoPath);

  return `<details class="tc ${sc} fade-up" ${isFailed ? 'open' : ''}
    data-s="${sc}" data-shots="${hasShots ? 1 : 0}" data-video="${hasVideo ? 1 : 0}">
    <summary class="tc-sum">
      <span class="pill ${sc}"><div class="pill-dot"></div>${label}</span>
      <span class="tc-title">${esc(test.title)}</span>
      <div class="tc-meta">${badges}<span class="tc-dur">${ms(test.duration)}</span></div>
      ${chevron}
    </summary>
    <div class="tc-body">
      ${journey ? `<div class="journey"><div class="journey-hd">Test Journey</div><div class="step-list">${journey}</div></div>` : ''}
      ${failure}
      ${shots}
      ${video}
    </div>
  </details>`;
}

// ─── Run pane renderer ────────────────────────────────────────────────────────

function renderRunPane(run: RunEntry, isFirst: boolean, allRuns: RunEntry[] = []): string {
  const all = run.suites.flatMap(s => s.tests);
  const skipped = all.filter(t => t.status === 'skipped').length;
  const withShots = all.filter(t => t.screenshots.length > 0).length;
  const withVideo = all.filter(t => t.videoPath).length;
  const passRate = run.total ? Math.round((run.passed / run.total) * 100) : 0;
  const overallFailed = run.failed > 0;

  const dateStr = new Date(run.startTime).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const signals = deriveSignals(run.suites);
  const sigCols = (() => {
    const n = signals.length;
    if (n <= 4) return n;
    if (n === 5) return 5;
    for (let c = Math.min(n, 5); c >= 2; c--) {
      const rem = n % c;
      if (rem === 0 || rem >= 2) return c;
    }
    return Math.min(n, 5);
  })();
  const signalsHtml = signals.map(s => `
    <div class="signal ${s.status}">
      <div class="signal-top">
        <div class="signal-em ${s.color}">${s.emoji}</div>
        <span class="signal-badge ${s.status}">${s.status === 'pass' ? '✓ Pass' : '⚠ Warn'}</span>
      </div>
      <div class="signal-name">${esc(s.name)}</div>
      <div class="signal-detail">${esc(s.detail)}</div>
    </div>`).join('');

  const suitesHtml = run.suites
    .filter(s => s.tests.length > 0)
    .map(suite => `
      <div class="suite fade-up">
        <div class="suite-hd">
          <span class="suite-name">${esc(suite.title)}</span>
          <span class="suite-ct">${suite.tests.length} test${suite.tests.length !== 1 ? 's' : ''}</span>
        </div>
        ${suite.tests.map(t => renderTestCard(t)).join('')}
      </div>`).join('');

  const filterSkipped = skipped > 0 ? `<button class="filter-btn" data-f="skipped">Skipped <span class="filter-n">${skipped}</span></button>` : '';
  const filterShots = withShots > 0 ? `<button class="filter-btn" data-f="shots">📸 Screenshots <span class="filter-n">${withShots}</span></button>` : '';
  const filterVideo = withVideo > 0 ? `<button class="filter-btn" data-f="video">🎬 Video <span class="filter-n">${withVideo}</span></button>` : '';

  const gate = computeReleaseGate(run);
  const gateHtml = renderReleaseGate(gate, run.id);

  const listIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`;
  const boardIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`;
  const pieIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/></svg>`;
  const barIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>`;
  const trendIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clip-rule="evenodd"/></svg>`;

  return `<div class="run-pane${isFirst ? ' active' : ''}" data-rid="${esc(run.id)}">
<header class="hero">
  <div class="hero-inner">
    <div class="hero-top">
      <div class="hero-icon">🎯</div>
      <div>
        <div class="hero-brand-name">Foleon E2E</div>
        <div class="hero-brand-sub">Quality Report</div>
      </div>
      <div class="hero-spacer"></div>
      <div class="hero-right">
        <div class="hero-datechip">
          <span>${esc(dateStr)}</span>
          <div class="hero-datechip-sep"></div>
          <span>${ms(run.duration)}</span>
        </div>
        <div class="hero-badge ${overallFailed ? 'failed' : 'passed'}">
          <div class="hero-badge-dot"></div>
          ${overallFailed ? 'Failures Found' : 'All Passed'}
        </div>
      </div>
    </div>

    <div class="hero-kpis">
      <div class="kpi">
        <div class="kpi-val" data-n="${run.total}">0</div>
        <div class="kpi-lbl">Total Tests</div>
      </div>
      <div class="kpi">
        <div class="kpi-val c-pass" data-n="${run.passed}">0</div>
        <div class="kpi-lbl">Passed</div>
      </div>
      <div class="kpi">
        <div class="kpi-val ${run.failed > 0 ? 'c-fail' : ''}" data-n="${run.failed}">0</div>
        <div class="kpi-lbl">Failed</div>
      </div>
      <div class="kpi">
        <div class="kpi-val">${ms(run.duration)}</div>
        <div class="kpi-lbl">Duration</div>
      </div>
      <div class="kpi kpi-rate">
        <div class="kpi-rate-num" data-n="${passRate}">0</div>
        <div class="kpi-lbl">Pass Rate %</div>
        <div class="kpi-bar-track">
          <div class="kpi-bar-fill ${overallFailed ? 'fail' : 'pass'}" data-bar="${passRate}%" style="width:0"></div>
        </div>
        <div class="kpi-rate-sub">${run.passed} of ${run.total} test${run.total !== 1 ? 's' : ''} passing</div>
      </div>
    </div>
  </div>
  <div class="hero-wave"></div>
</header>

<div class="app">
  ${gateHtml}

  <section class="analytics fade-up">
    <div class="analytics-hd">Analytics</div>
    <div class="analytics-grid">
      <div class="chart-card">
        <div class="chart-card-hd">${pieIcon} Test Results</div>
        ${renderDonutChart(run.passed, run.failed, skipped)}
      </div>
      <div class="chart-card">
        <div class="chart-card-hd">${barIcon} Coverage by Suite</div>
        ${renderSuiteBarChart(run.suites)}
      </div>
      <div class="chart-card">
        <div class="chart-card-hd">${trendIcon} Run History</div>
        ${renderTrendChart(allRuns)}
      </div>
    </div>
  </section>

  <section class="signals fade-up">
    <div class="signals-hd">Quality Signals</div>
    <div class="signals-grid" style="grid-template-columns:repeat(${sigCols},1fr)">${signalsHtml}</div>
  </section>

  <div class="toolbar">
    <div class="toolbar-left filter-bar" style="margin-bottom:0">
      <span class="filter-lbl">Filter:</span>
      <button class="filter-btn active" data-f="all">All <span class="filter-n">${run.total}</span></button>
      <button class="filter-btn" data-f="passed">Passed <span class="filter-n">${run.passed}</span></button>
      <button class="filter-btn" data-f="failed">Failed <span class="filter-n">${run.failed}</span></button>
      ${filterSkipped}${filterShots}${filterVideo}
    </div>
    <div class="view-toggle">
      <button class="view-btn active" data-view="list" onclick="window.setView('list',this.closest('.run-pane'))">${listIcon} List</button>
      <button class="view-btn" data-view="board" onclick="window.setView('board',this.closest('.run-pane'))">${boardIcon} Board</button>
    </div>
  </div>

  <div class="list-view">
    ${suitesHtml || `<div class="empty"><div class="empty-icon">📭</div><div>No test results found.</div></div>`}
  </div>
  ${renderBoardView(run.suites, run.id)}
</div>
</div>`;
}

// ─── Full page builder ────────────────────────────────────────────────────────

function buildMultiRunHTML(runs: RunEntry[]): string {
  const limited = runs.slice(0, 10);

  const clockIcon = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>`;
  const chevIcon = `<svg viewBox="0 0 20 20" fill="currentColor" class="run-hist-chev"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

  const histCards = limited.map((run, i) => {
    const d = new Date(run.startTime);
    const dateLabel = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const passRate = run.total ? Math.round((run.passed / run.total) * 100) : 0;
    const v = run.failed > 0 ? 'fail' : 'pass';
    const vLabel = run.failed > 0 ? `${run.failed} failed` : 'All passed';
    const rid = esc(run.id);
    return `<div class="run-hist-card${i === 0 ? ' active' : ''}" data-rid="${rid}" onclick="window.selectRun('${rid}')">
  <div class="run-hist-card-top">
    <div class="run-hist-status">
      <span class="run-hist-dot ${v}"></span>
      <span class="run-hist-vtext ${v}">${vLabel}</span>
    </div>
    <span class="run-hist-date">${esc(dateLabel)}</span>
    <span class="run-hist-meta">${run.passed}/${run.total} · ${ms(run.duration)}</span>
  </div>
  <div class="run-hist-bar-track"><div class="run-hist-bar-fill ${v}" style="width:${passRate}%"></div></div>
  <button class="run-hist-del" onclick="window.deleteRun('${rid}',event)" aria-label="Delete">×</button>
</div>`;
  }).join('');

  const topnav = limited.length > 0 ? `<nav class="topnav">
  <div class="topnav-logo">🎯</div>
  <span class="topnav-name">Foleon E2E</span>
  <div class="topnav-sep"></div>
  <span class="topnav-sub">Quality Report</span>
  <div class="topnav-spacer"></div>
  <div class="topnav-actions">
    <div class="run-hist-wrap">
      <button class="run-hist-btn" onclick="window.toggleRunHistory()">
        ${clockIcon}
        Run History
        <span class="run-hist-ct">${limited.length}</span>
        ${chevIcon}
      </button>
      <div class="run-hist-panel" id="run-hist-panel">
        <div class="run-hist-hd">
          <span class="run-hist-hd-lbl">Run History</span>
          <span class="run-hist-hd-sub">Last ${limited.length} run${limited.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="run-hist-list">${histCards}</div>
      </div>
    </div>
    <button class="topnav-theme-btn" aria-label="Toggle theme">🌙</button>
  </div>
</nav>` : '';

  const panesHtml = limited.map((run, i) => renderRunPane(run, i === 0, limited)).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Foleon Quality Report</title>
  <style>${CSS}</style>
</head>
<body>

${topnav}
${panesHtml}

<div id="lb">
  <button class="lb-x" aria-label="Close">×</button>
  <img id="lb-img" src="" alt="Screenshot"/>
</div>

<div class="toast" id="fqr-toast"></div>

<script>${JS}</script>
</body>
</html>`;
}

// ─── serve.js generator ───────────────────────────────────────────────────────

function generateServeJs(outDir: string): void {
  const content = `const http=require('http'),fs=require('fs'),path=require('path');
const dir=__dirname,runsDir=path.join(dir,'runs'),port=process.env.PORT||4000;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webm':'video/webm','.mp4':'video/mp4','.png':'image/png'};
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,DELETE,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method==='DELETE'&&req.url.startsWith('/api/delete/')){
    const id=decodeURIComponent(req.url.slice('/api/delete/'.length));
    const hf=path.join(runsDir,'.hidden.json');
    let h=[];try{h=JSON.parse(fs.readFileSync(hf,'utf8'));}catch{}
    if(!h.includes(id)){h.push(id);fs.writeFileSync(hf,JSON.stringify(h));}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));return;
  }
  const fp=path.join(dir,req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!fp.startsWith(dir)){res.writeHead(403);res.end();return;}
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});res.end(data);
  });
}).listen(port,()=>console.log('Quality Report → http://localhost:'+port));
`;
  fs.writeFileSync(path.join(outDir, 'serve.js'), content, 'utf8');
}

// ─── Reporter class ───────────────────────────────────────────────────────────

class FoleonHTMLReporter implements Reporter {
  private outputFile: string;
  private suites: SuiteData[] = [];
  private startTime = new Date();

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? 'custom-report/index.html';
  }

  onBegin(_config: FullConfig, _suite: Suite) {
    this.startTime = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (test.location.file.endsWith('.setup.ts')) return;
    const suiteName = test.parent?.title || test.titlePath()[0] || 'Tests';
    let suite = this.suites.find(s => s.title === suiteName);
    if (!suite) { suite = { title: suiteName, tests: [] }; this.suites.push(suite); }

    const screenshots: string[] = [];
    for (const att of result.attachments) {
      if (!att.contentType?.startsWith('image/')) continue;
      const buf = att.body ?? (att.path && fs.existsSync(att.path) ? fs.readFileSync(att.path) : null);
      if (buf) screenshots.push(`data:${att.contentType};base64,${buf.toString('base64')}`);
    }

    let videoPath: string | null = null;
    let videoMaxSize = -1;
    const outDir = path.dirname(path.resolve(process.cwd(), this.outputFile));
    for (const att of result.attachments) {
      if (att.contentType?.startsWith('video/') && att.path && fs.existsSync(att.path)) {
        const size = fs.statSync(att.path).size;
        if (size > videoMaxSize) {
          videoMaxSize = size;
          videoPath = path.relative(outDir, att.path);
        }
      }
    }

    suite.tests.push({
      title: test.title,
      status: result.status,
      duration: result.duration,
      steps: collectSteps(result.steps),
      screenshots,
      videoPath,
      error: result.error?.message,
    });
  }

  onEnd(_result: FullResult) {
    const duration = Date.now() - this.startTime.getTime();
    const out = path.resolve(process.cwd(), this.outputFile);
    const outDir = path.dirname(out);
    const runsDir = path.join(outDir, 'runs');
    fs.mkdirSync(runsDir, { recursive: true });

    // Compute stats for this run
    const all = this.suites.flatMap(s => s.tests);
    const passed = all.filter(t => t.status === 'passed').length;
    const failed = all.filter(t => !['passed', 'skipped'].includes(t.status)).length;
    const id = this.startTime.toISOString().replace(/[:.]/g, '-');

    // Save current run as JSON (video paths are relative to outDir)
    const entry: RunEntry = {
      id,
      startTime: this.startTime.toISOString(),
      duration,
      status: failed > 0 ? 'failed' : 'passed',
      passed,
      failed,
      total: all.length,
      suites: this.suites,
    };
    fs.writeFileSync(path.join(runsDir, `${id}.json`), JSON.stringify(entry), 'utf8');

    // Load all non-hidden runs (newest first)
    const hiddenFile = path.join(runsDir, '.hidden.json');
    const hidden: string[] = fs.existsSync(hiddenFile)
      ? JSON.parse(fs.readFileSync(hiddenFile, 'utf8'))
      : [];

    const allRuns: RunEntry[] = fs.readdirSync(runsDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('.'))
      .flatMap(f => {
        try { return [JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8')) as RunEntry]; }
        catch { return []; }
      })
      .filter(r => !hidden.includes(r.id))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Keep only 10 newest on disk — delete the rest to avoid unbounded growth
    allRuns.slice(10).forEach(r => {
      const jsonPath = path.join(runsDir, `${r.id}.json`);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
    });
    const runs = allRuns.slice(0, 10);

    const html = buildMultiRunHTML(runs);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, html, 'utf8');

    generateServeJs(outDir);

    console.log(`\n  ✦ Quality Report → file://${out}`);
    console.log(`  ✦ Serve locally:   node ${path.join(outDir, 'serve.js')}\n`);
  }
}

export default FoleonHTMLReporter;
export { buildMultiRunHTML, generateServeJs };
export type { RunEntry };

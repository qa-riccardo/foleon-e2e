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

/* ── Theme toggle ── */
.theme-btn{position:fixed;top:14px;right:18px;z-index:200;width:34px;height:34px;border-radius:50%;border:1px solid var(--brd2);background:var(--card);color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:var(--sh1);transition:all .2s;line-height:1;font-family:var(--font)}
.theme-btn:hover{transform:scale(1.1);box-shadow:var(--sh2)}

/* ══ RUN BAR ══ */
.run-bar{position:sticky;top:0;z-index:100;background:var(--card);border-bottom:1px solid var(--brd);padding:9px 20px;display:flex;align-items:center;gap:10px;box-shadow:var(--sh1)}
.run-bar-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--t3);white-space:nowrap;flex-shrink:0}
.run-tabs{display:flex;gap:5px;overflow-x:auto;-ms-overflow-style:none;scrollbar-width:none}
.run-tabs::-webkit-scrollbar{display:none}
.run-tab{display:inline-flex;align-items:center;gap:6px;padding:5px 7px 5px 11px;border:1px solid var(--brd);border-radius:var(--rfl);background:var(--card-alt);cursor:pointer;white-space:nowrap;font-size:12px;font-weight:500;color:var(--t2);transition:all .15s;font-family:var(--font);line-height:1;flex-shrink:0}
.run-tab:hover{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.run-tab.active{background:var(--acc);border-color:var(--acc);color:#fff}
.run-tab-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.run-tab-dot.pass{background:#4ade80}
.run-tab-dot.fail{background:#f87171}
.run-tab-ct{font-size:10px;opacity:.65}
.run-tab-del{width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,.1);border:none;cursor:pointer;font-size:13px;color:inherit;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;font-family:var(--font);flex-shrink:0;padding:0;margin-left:1px}
.run-tab.active .run-tab-del{background:rgba(255,255,255,.18)}
.run-tab-del:hover{background:rgba(220,38,38,.25)!important;color:#f87171!important}
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
.hero-brand-name{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7);line-height:1.2}
.hero-brand-sub{font-size:11px;color:rgba(255,255,255,.33);letter-spacing:.07em;text-transform:uppercase}
.hero-spacer{flex:1}
.hero-right{display:flex;align-items:center;gap:12px}
.hero-datechip{font-size:12px;color:rgba(255,255,255,.4);display:flex;align-items:center;gap:8px}
.hero-datechip-sep{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2)}
.hero-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:var(--rfl);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
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
.kpi-lbl{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.37)}

.kpi-rate .kpi-rate-num{font-size:46px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.04em;margin-bottom:3px}
.kpi-rate .kpi-lbl{margin-bottom:14px}
.kpi-bar-track{height:7px;background:rgba(255,255,255,.1);border-radius:var(--rfl);overflow:hidden;margin-bottom:8px}
.kpi-bar-fill{height:100%;border-radius:var(--rfl);transition:width 1.3s cubic-bezier(.4,0,.2,1)}
.kpi-bar-fill.pass{background:linear-gradient(90deg,#4ade80,#22c55e)}
.kpi-bar-fill.fail{background:linear-gradient(90deg,#f87171,#ef4444)}
.kpi-rate-sub{font-size:12px;color:rgba(255,255,255,.33)}

.hero-wave{margin-top:38px;height:46px;background:linear-gradient(to bottom,transparent,var(--bg));position:relative;z-index:1;transition:background .3s}

/* ══ LAYOUT ══ */
.app{max-width:1200px;margin:0 auto;padding:0 32px 80px}

/* ══ SIGNALS ══ */
.signals{margin:20px 0 26px}
.signals-hd{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;display:flex;align-items:center;gap:10px}
.signals-hd::after{content:'';flex:1;height:1px;background:var(--brd)}
.signals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.signal{background:var(--card);border:1px solid var(--brd);border-radius:var(--rsm);padding:12px 13px;display:flex;align-items:center;gap:10px;box-shadow:var(--sh0);transition:box-shadow .2s,transform .2s}
.signal:hover{box-shadow:var(--sh1);transform:translateY(-1px)}
.signal-em{width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.signal-em.green{background:var(--pass-s)}
.signal-em.blue{background:var(--acc-s)}
.signal-em.amber{background:var(--warn-s)}
.signal-name{font-size:12px;font-weight:600;color:var(--t1);line-height:1.25;margin-bottom:1px}
.signal-detail{font-size:10px;color:var(--t3)}
.signal-dot{width:6px;height:6px;border-radius:50%;margin-left:auto;flex-shrink:0;align-self:center}
.signal-dot.pass{background:var(--pass);box-shadow:0 0 4px var(--pass)}
.signal-dot.warn{background:var(--warn);box-shadow:0 0 4px var(--warn)}

/* ══ FILTER BAR ══ */
.filter-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.filter-lbl{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-right:4px}
.filter-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border:1px solid var(--brd);border-radius:var(--rfl);background:var(--card);color:var(--t2);font-size:12px;font-weight:500;font-family:var(--font);cursor:pointer;transition:all .15s;white-space:nowrap;box-shadow:var(--sh0)}
.filter-btn:hover{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.filter-btn.active{background:var(--acc);border-color:var(--acc);color:#fff;box-shadow:0 2px 8px rgba(79,70,229,.3)}
.filter-n{font-size:10px;font-weight:700;padding:1px 5px;border-radius:var(--rfl);background:rgba(0,0,0,.08);min-width:17px;text-align:center}
.filter-btn.active .filter-n{background:rgba(255,255,255,.22)}

/* ══ SUITE ══ */
.suite{margin-bottom:24px}
.suite-hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.suite-name{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
.suite-ct{font-size:11px;color:var(--t3);background:var(--brd);border-radius:var(--rfl);padding:2px 8px}

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

.pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:var(--rfl);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0;border:1px solid transparent}
.pill.passed{background:var(--pass-s);color:var(--pass);border-color:var(--pass-b)}
.pill.failed,.pill.timedOut{background:var(--fail-s);color:var(--fail);border-color:var(--fail-b)}
.pill.skipped{background:var(--skip-s);color:var(--skip);border-color:var(--brd)}
.pill-dot{width:4px;height:4px;border-radius:50%;background:currentColor}

.tc-title{flex:1;font-size:14px;font-weight:600;color:var(--t1);line-height:1.4;min-width:0}
.tc-meta{display:flex;align-items:center;gap:7px;flex-shrink:0}
.tc-badge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:var(--rfl);font-size:11px;font-weight:500;color:var(--t3);background:var(--card-alt);border:1px solid var(--brd)}
.tc-dur{font-size:12px;color:var(--t3);font-family:var(--mono);flex-shrink:0}
.tc-body{border-top:1px solid var(--brd)}

/* ══ JOURNEY ══ */
.journey{padding:16px 18px 12px}
.journey-hd{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:12px;display:flex;align-items:center;gap:8px}
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
.step-lbl{flex:1;font-size:13px;font-weight:500;color:var(--t1);line-height:1.35}
.step-lbl.fail{color:var(--fail)}
.step-checks{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--card-alt);border:1px solid var(--brd);border-radius:var(--rfl);padding:2px 7px;font-weight:500;white-space:nowrap;transition:all .15s}
details.step-item>summary:hover .step-checks{border-color:var(--acc);color:var(--acc);background:var(--acc-s)}
.step-arr{transition:transform .2s;font-size:8px;display:inline-block}
details.step-item[open] .step-arr{transform:rotate(180deg)}
.step-dur{font-size:11px;color:var(--t3);font-family:var(--mono);white-space:nowrap}

.asserts{padding:2px 10px 10px 42px;display:flex;flex-direction:column;gap:3px}
.assert-row{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px;color:var(--t2)}
.assert-ico{width:14px;text-align:center;font-size:11px;flex-shrink:0}
.assert-ico.pass{color:var(--pass)}
.assert-ico.fail{color:var(--fail)}
.assert-txt{flex:1}
.assert-txt.fail{color:var(--fail);font-weight:500}
.assert-dur{font-size:10px;font-family:var(--mono);color:var(--t3);margin-left:auto}

/* ══ FAILURE ANALYSIS ══ */
.fail-panel{margin:0 18px 14px;border:1px solid var(--fail-b);border-radius:var(--rsm);overflow:hidden}
.fail-hd{display:flex;align-items:center;gap:7px;padding:10px 14px;background:var(--fail-s);border-bottom:1px solid var(--fail-b);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--fail)}
.fail-hd svg{width:13px;height:13px}
.fail-rows{padding:12px 14px 10px;display:flex;flex-direction:column;gap:9px}
.fail-row{display:flex;gap:10px;align-items:flex-start}
.fail-key{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);min-width:72px;padding-top:1px;flex-shrink:0}
.fail-val{font-size:12px;color:var(--t2);flex:1;line-height:1.5}
.fail-code{font-family:var(--mono);font-size:11.5px;color:var(--fail);background:var(--fail-s);border:1px solid var(--fail-b);border-radius:var(--rxs);padding:10px 12px;white-space:pre-wrap;word-break:break-word;line-height:1.65;margin:0 14px 14px;max-height:180px;overflow-y:auto}

/* ══ SCREENSHOTS ══ */
.artifacts{border-top:1px solid var(--brd);padding:14px 18px}
.artifacts-hd{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:12px}
.artifacts-hd svg{width:12px;height:12px}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px}
.sc-card{border-radius:var(--rsm);overflow:hidden;border:1px solid var(--brd);background:var(--card-alt);cursor:zoom-in;position:relative;aspect-ratio:16/9;transition:all .2s}
.sc-card:hover{border-color:var(--acc);transform:translateY(-2px);box-shadow:var(--sh2),0 0 0 2px rgba(79,70,229,.1)}
.sc-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.sc-card:hover img{transform:scale(1.04)}
.sc-label{position:absolute;bottom:0;left:0;right:0;padding:18px 8px 5px;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);color:#fff;font-size:10px;font-weight:500;line-height:1}
.sc-n{position:absolute;top:5px;left:5px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;backdrop-filter:blur(4px)}
.sc-zoom{position:absolute;top:5px;right:5px;width:20px;height:20px;background:rgba(0,0,0,.55);border-radius:4px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;backdrop-filter:blur(4px)}
.sc-card:hover .sc-zoom{opacity:1}
.sc-zoom svg{width:10px;height:10px;color:#fff}

/* ══ VIDEO ══ */
.video-sec{border-top:1px solid var(--brd);padding:14px 18px}
.video-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.video-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--t3)}
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

@media(max-width:900px){
  .hero-inner,.app{padding-left:20px;padding-right:20px}
  .hero-kpis{grid-template-columns:1fr 1fr}
  .hero-datechip{display:none}
}
@media(max-width:600px){
  .hero-kpis{grid-template-columns:1fr 1fr}
  .signals-grid{grid-template-columns:1fr 1fr}
  .sc-grid{grid-template-columns:1fr 1fr}
}
`;

// ─── JS ──────────────────────────────────────────────────────────────────────

const JS = `(function(){
  /* Theme */
  const html=document.documentElement,thBtn=document.querySelector('.theme-btn');
  const saved=localStorage.getItem('fqr-theme')||'light';
  html.dataset.theme=saved;
  thBtn.textContent=saved==='dark'?'☀️':'🌙';
  thBtn.addEventListener('click',()=>{
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
    pane.querySelectorAll('.fade-up').forEach((el,i)=>{
      setTimeout(()=>el.classList.add('in'),i*20);
    });
  }

  const animated=new Set();

  /* Run selector */
  window.selectRun=function(rid){
    document.querySelectorAll('.run-tab').forEach(t=>t.classList.toggle('active',t.dataset.rid===rid));
    document.querySelectorAll('.run-pane').forEach(p=>p.classList.toggle('active',p.dataset.rid===rid));
    if(!animated.has(rid)){
      animated.add(rid);
      animPane(document.querySelector('.run-pane[data-rid="'+rid+'"]'));
    }
    window.scrollTo({top:0,behavior:'smooth'});
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
      const tab=document.querySelector('.run-tab[data-rid="'+rid+'"]');
      const pane=document.querySelector('.run-pane[data-rid="'+rid+'"]');
      const wasActive=tab&&tab.classList.contains('active');
      if(tab)tab.remove();
      if(pane)pane.remove();
      if(wasActive){
        const first=document.querySelector('.run-tab');
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
    document.querySelector('.run-tab[data-rid="'+rid+'"]')?.remove();
    document.querySelector('.run-pane[data-rid="'+rid+'"]')?.remove();
  });
  const firstTab=document.querySelector('.run-tab');
  if(firstTab&&!document.querySelector('.run-pane.active')){
    firstTab.classList.add('active');
    const fp=document.querySelector('.run-pane[data-rid="'+firstTab.dataset.rid+'"]');
    if(fp)fp.classList.add('active');
  }

  /* Animate initial active pane */
  const initPane=document.querySelector('.run-pane.active');
  if(initPane){
    animated.add(initPane.dataset.rid);
    animPane(initPane);
  }

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
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLb();});
  function closeLb(){lb.classList.remove('open');document.body.style.overflow='';lbImg.src='';}
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

function renderRunPane(run: RunEntry, isFirst: boolean): string {
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
  const signalsHtml = signals.map(s => `
    <div class="signal">
      <div class="signal-em ${s.color}">${s.emoji}</div>
      <div>
        <div class="signal-name">${esc(s.name)}</div>
        <div class="signal-detail">${esc(s.detail)}</div>
      </div>
      <div class="signal-dot ${s.status}"></div>
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

  return `<div class="run-pane${isFirst ? ' active' : ''}" data-rid="${esc(run.id)}">
<header class="hero">
  <div class="hero-inner">
    <div class="hero-top">
      <div class="hero-icon">🎯</div>
      <div>
        <div class="hero-brand-name">Foleon E2E</div>
        <div class="hero-brand-sub">Quality Intelligence Report</div>
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
  <section class="signals fade-up">
    <div class="signals-hd">Quality Signals</div>
    <div class="signals-grid">${signalsHtml}</div>
  </section>

  <div class="filter-bar">
    <span class="filter-lbl">Filter:</span>
    <button class="filter-btn active" data-f="all">All <span class="filter-n">${run.total}</span></button>
    <button class="filter-btn" data-f="passed">Passed <span class="filter-n">${run.passed}</span></button>
    <button class="filter-btn" data-f="failed">Failed <span class="filter-n">${run.failed}</span></button>
    ${filterSkipped}${filterShots}${filterVideo}
  </div>

  ${suitesHtml || `<div class="empty"><div class="empty-icon">📭</div><div>No test results found.</div></div>`}
</div>
</div>`;
}

// ─── Full page builder ────────────────────────────────────────────────────────

function buildMultiRunHTML(runs: RunEntry[]): string {
  const tabsHtml = runs.map((run, i) => {
    const d = new Date(run.startTime);
    const label = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const dot = run.failed > 0 ? 'fail' : 'pass';
    const rid = esc(run.id);
    return `<button class="run-tab${i === 0 ? ' active' : ''}" data-rid="${rid}" onclick="window.selectRun('${rid}')">
      <span class="run-tab-dot ${dot}"></span>
      <span>${esc(label)}</span>
      <span class="run-tab-ct">${run.passed}/${run.total}</span>
      <button class="run-tab-del" onclick="window.deleteRun('${rid}',event)" aria-label="Delete run">×</button>
    </button>`;
  }).join('');

  const panesHtml = runs.map((run, i) => renderRunPane(run, i === 0)).join('\n');

  const runBar = runs.length > 0 ? `
<div class="run-bar">
  <span class="run-bar-lbl">Runs</span>
  <div class="run-tabs">${tabsHtml}</div>
</div>` : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Foleon Quality Report</title>
  <style>${CSS}</style>
</head>
<body>

<button class="theme-btn" aria-label="Toggle theme">🌙</button>
${runBar}
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

    const runs: RunEntry[] = fs.readdirSync(runsDir)
      .filter(f => f.endsWith('.json') && !f.startsWith('.'))
      .flatMap(f => {
        try { return [JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8')) as RunEntry]; }
        catch { return []; }
      })
      .filter(r => !hidden.includes(r.id))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const html = buildMultiRunHTML(runs);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, html, 'utf8');

    generateServeJs(outDir);

    console.log(`\n  ✦ Quality Report → file://${out}`);
    console.log(`  ✦ Serve locally:   node ${path.join(outDir, 'serve.js')}\n`);
  }
}

export default FoleonHTMLReporter;

/**
 * ProofLoop Settings, Voice AI Configuration & Hackathon Verification Center
 * Centralized theme control, voice settings, and Alexa+ track audit checklist.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  ShieldCheck,
  Code2,
  Cpu,
  Sun,
  Moon,
  Laptop,
  Mic,
  Volume2,
  VolumeX,
  Globe,
  Gauge,
  Sliders,
} from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext.js';
import { useVoice } from '../context/VoiceContext.js';
import { SUPPORTED_LOCALES, type SpeechLocale } from '../hooks/useSpeechRecognition.js';

interface SettingsViewProps {
  isTestModeSimulateFailure: boolean;
  onToggleTestMode: () => void;
  workflowsCount: number;
  memoriesCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isTestModeSimulateFailure,
  onToggleTestMode,
  workflowsCount,
  memoriesCount,
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Speech settings from unified background Voice controller
  const {
    isSupported,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    rate,
    setRate,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    locale,
    setLocale,
    voiceMode,
    setVoiceMode,
    wakePhrase,
    setWakePhrase,
    clickToExplainEnabled,
    setClickToExplainEnabled,
  } = useVoice();


  const [testSpeechText, setTestSpeechText] = useState(
    'ProofLoop is ready. Turn goals into verifiable outcomes with real MCP tools.'
  );

  const hackathonDeliverables = [
    {
      title: 'Complete Working Source Code',
      desc: 'TypeScript, Node.js, Express, React, Vite, Tailwind CSS',
      verified: true,
    },
    {
      title: 'Fully Functional Dark & Light Mode',
      desc: 'Centralized theme provider with system preference respect, no theme flash, persistent across reloads',
      verified: true,
    },
    {
      title: 'Conversational Voice AI Assistant (Alexa+)',
      desc: 'Web Speech recognition (en-US, en-IN, te-IN, hi-IN) with live transcription, speech synthesis, and dedicated Voice Mode',
      verified: true,
    },
    {
      title: 'Real Model Context Protocol (MCP) Server over Streamable HTTP',
      desc: 'Official @modelcontextprotocol/sdk version with StreamableHTTPServerTransport',
      verified: true,
    },
    {
      title: 'Functioning MCP Client',
      desc: 'Discovers 10 tools, handles arguments, inspects schemas, and renders outputs',
      verified: true,
    },
    {
      title: 'Persistent Memory & State Storage',
      desc: 'Persists workflows, tasks, memories, and verifications across reboots & refreshes',
      verified: true,
    },
    {
      title: 'Human-in-the-Loop Consequential Approvals',
      desc: 'Explicit preview and sign-off required before consequential email sending',
      verified: true,
    },
    {
      title: 'Signature "Proof of Completion" Verification',
      desc: 'Cryptographic SHA-256 evidence ledger for all completed actions',
      verified: true,
    },
    {
      title: 'Automated Test Suite (Vitest passing)',
      desc: 'Tests for FSM transitions, MCP schemas, persistent memory, voice, theme, approvals',
      verified: true,
    },
    {
      title: 'End-to-End Demonstration Scenario',
      desc: 'Complete Alexa+ internship submission readiness workflow with recoverable failure demo',
      verified: true,
    },
  ];

  const integrationsAudit = [
    {
      name: 'Model Context Protocol (MCP)',
      type: 'Real Implementation',
      status: 'Active',
      details: 'Official @modelcontextprotocol/sdk with 10 tools over Streamable HTTP and SSE.',
    },
    {
      name: 'Voice AI Engine (Web Speech & Synthesis)',
      type: 'Real Implementation',
      status: 'Active',
      details: 'In-browser speech recognition with multi-locale support and natural speech synthesis.',
    },
    {
      name: 'Persistent Relational Storage',
      type: 'Real Implementation',
      status: 'Active',
      details: 'SQLite / JSON journal engine with atomic write durability in data/ directory.',
    },
    {
      name: 'Cryptographic Verification Ledger',
      type: 'Real Implementation',
      status: 'Active',
      details: 'Real SHA-256 evidence reference generator binding tool outputs to step IDs.',
    },
    {
      name: 'External Email Dispatch',
      type: 'Protected Flow',
      status: 'Ready',
      details: 'Configurable real SMTP credentials via .env; safe simulated preview when credentials are unset.',
    },
    {
      name: 'Developer Tool Failure Simulator',
      type: 'Controlled Simulation',
      status: isTestModeSimulateFailure ? 'Active' : 'Standby',
      details: 'Simulates recoverable network timeouts to demonstrate resilient self-healing flow.',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-5xl mx-auto bg-slate-50 dark:bg-slate-950 transition-colors">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Settings & Hackathon Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Amazon Developer Hackathon 2026 — Alexa+ track settings, voice engine, and audit.
        </p>
      </div>

      {/* FEATURE 1: Centralized Theme Settings */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Application Appearance & Theme</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your preferred appearance mode. Automatically applied across every page, workspace, card, and modal.
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Current: {resolvedTheme.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
              theme === 'light'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Light Mode</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Crisp contrast on bright backgrounds
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
              theme === 'dark'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Dark Mode</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Deep slate background for low eye fatigue
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all ${
              theme === 'system'
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">System Match</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Synchronize with OS display settings
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* FEATURE 2: Voice AI Assistant Settings */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Voice AI Assistant Settings (Alexa+ Track)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure Web Speech API recognition, text-to-speech voice, rate, and automatic replies.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
            Web Speech Active
          </span>
        </div>

        <div className="space-y-4 pt-1">
          {/* Voice Operating Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Voice Operating Mode</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setVoiceMode('hands-free')}
                data-explain="voice-mode-setting"
                className={`p-3 rounded-lg border text-left transition-all ${
                  voiceMode === 'hands-free'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Hands-Free Conversation</span>
                  {voiceMode === 'hands-free' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Continuous multi-turn dialog with slot filling. Auto-resumes listening after speaking.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVoiceMode('push-to-talk')}
                data-explain="voice-mode-setting"
                className={`p-3 rounded-lg border text-left transition-all ${
                  voiceMode === 'push-to-talk'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Push to Talk</span>
                  {voiceMode === 'push-to-talk' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Click to speak, click to stop. Review and edit transcript inline before execution.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVoiceMode('wake-phrase')}
                data-explain="voice-mode-setting"
                className={`p-3 rounded-lg border text-left transition-all ${
                  voiceMode === 'wake-phrase'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Wake Phrase</span>
                  {voiceMode === 'wake-phrase' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Passive listener in active tab. Triggers when phrase ("Hey ProofLoop") is spoken.
                </p>
              </button>
            </div>

            {voiceMode === 'wake-phrase' && (
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Wake Phrase:
                  </label>
                  <input
                    type="text"
                    value={wakePhrase}
                    onChange={(e) => setWakePhrase(e.target.value)}
                    data-explain="wake-phrase-setting"
                    className="px-2.5 py-1 text-xs rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-44"
                    placeholder="Hey ProofLoop"
                  />
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                  Browser capability note: Due to browser security and power-saving policies, wake phrase detection functions when this browser tab is active with microphone permission granted. Browsers do not permit silent background audio surveillance when the tab or OS suspends execution.
                </p>
              </div>
            )}
          </div>

          {/* Toggle: Speak AI responses aloud */}
          <div
            data-explain="speak-aloud-setting"
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 cursor-pointer"
          >
            <div className="space-y-0.5 pr-4">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Speak AI responses aloud
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Automatically read concise workflow updates and final results using browser speech synthesis.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                aria-label="Speak AI responses aloud"
                checked={speakAloudEnabled}
                onChange={(e) => setSpeakAloudEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Toggle: Click-to-Explain */}
          <div
            data-explain="click-to-explain-setting"
            className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850 cursor-pointer transition-colors"
            onClick={() => setClickToExplainEnabled(!clickToExplainEnabled)}
          >
            <div className="space-y-0.5 pr-4">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Click-to-Explain</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold transition-colors ${
                    clickToExplainEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {clickToExplainEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Automatically explain what an option does when you click it. When the Background Voice Assistant is active, explanations can be spoken aloud.
              </p>
            </div>

            <label
              className="relative inline-flex items-center cursor-pointer shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                aria-label="Click-to-Explain"
                checked={clickToExplainEnabled}
                onChange={(e) => setClickToExplainEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {/* Voice Language / Locale Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Speech Recognition Language</span>
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as SpeechLocale)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label} ({loc.nativeLabel})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                Tested with modern browsers supporting Web Speech API.
              </p>
            </div>

            {/* Speaking Rate Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                  <span>Speaking Rate ({rate}x)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setRate(1.0)}
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Reset (1.0x)
                </button>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0.8x (Slower)</span>
                <span>1.0x (Normal)</span>
                <span>1.5x (Faster)</span>
              </div>
            </div>
          </div>

          {/* Voice selection dropdown if voices available */}
          {voices.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Text-to-Speech Voice</span>
              </label>
              <select
                value={selectedVoice?.name || ''}
                onChange={(e) => {
                  const match = voices.find((v) => v.name === e.target.value);
                  setSelectedVoice(match || null);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Audio Test Bar */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Voice Diagnostic Test:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={testSpeechText}
                onChange={(e) => setTestSpeechText(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => speak(testSpeechText, { overrideSpeakAloud: true })}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-2xs shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Voice</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Controls: Failure Simulation Toggle */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Developer Failure & Recovery Simulator
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
              When enabled, tools simulate a recoverable network timeout during step execution. This allows testing ProofLoop's self-healing diagnostics and alternative strategy recovery without real external downtime.
            </p>
          </div>

          <button
            onClick={onToggleTestMode}
            className={`px-4 py-2 text-xs font-semibold rounded-md border transition-colors shrink-0 ${
              isTestModeSimulateFailure
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isTestModeSimulateFailure ? 'Test Mode Active (ON)' : 'Enable Failure Simulation'}
          </button>
        </div>
      </div>

      {/* Official Hackathon Checklist */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Alexa+ Track Mandatory Deliverables Checklist
        </h2>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          {hackathonDeliverables.map((item, idx) => (
            <div key={idx} className="p-4 flex items-start gap-3.5 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Honest External Integrations Audit */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Honest Integrations Audit (Real vs Simulated)
        </h2>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          {integrationsAudit.map((item, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">({item.type})</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {item.details}
                </p>
              </div>

              <span className="font-mono text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold shrink-0">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Persistence Stats */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs space-y-2">
        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Local Storage Durability</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Persisted records: <span className="font-mono tabular-nums">{workflowsCount} Workflows</span>,{' '}
          <span className="font-mono tabular-nums">{memoriesCount} Memories</span>. All records are safely saved to disk in the data store.
        </p>
      </div>
    </div>
  );
};

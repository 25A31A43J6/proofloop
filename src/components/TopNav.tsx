/**
 * ProofLoop Top Navigation Bar
 * Follows Top Bar Contract: Brand Zone (1-line wordmark), Navigation / Context Zone, Primary Action.
 * Anti-slop: unboxed metadata, zero-pill discipline, WCAG AA contrast, centralized theme & voice integration.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  Sun,
  Moon,
  Laptop,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Server,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Repeat,
  Check,
  X,
  Radio,
  Sliders,
  Globe,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import { useVoice, type VoiceMode } from '../context/VoiceContext.js';
import { SUPPORTED_LOCALES, type SpeechLocale } from '../hooks/useSpeechRecognition.js';

interface TopNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isMcpConnected: boolean;
  isTestModeSimulateFailure: boolean;
  onToggleTestMode: () => void;
  onRunDemo: () => void;
  isDemoRunning: boolean;
  pendingApprovalsCount: number;
  onOpenVoiceModal?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  onSelectTab,
  isMcpConnected,
  isTestModeSimulateFailure,
  onToggleTestMode,
  onRunDemo,
  isDemoRunning,
  pendingApprovalsCount,
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme, isDark } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showVoiceSettingsMenu, setShowVoiceSettingsMenu] = useState(false);

  const {
    status: voiceStatus,
    statusLabel,
    isActive: isVoiceActive,
    isListening,
    isSpeaking,
    isPaused,
    voiceMode,
    setVoiceMode,
    wakePhrase,
    locale,
    setLocale,
    continuousMode,
    setContinuousMode,
    stagedTranscript,
    setStagedTranscript,
    submitStagedTranscript,
    clearStagedTranscript,
    pendingApproval,
    explanationFallbackHint,
    toggleVoice,
    muteOrStopAudio,
    confirmVoiceApproval,
    cancelVoiceApproval,
    clearError: clearVoiceError,
  } = useVoice();

  return (
    <header className="h-16 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-4 shrink-0 z-20">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
          PL
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap">
            ProofLoop
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap hidden sm:inline">
            Don't just make a plan. Get it done.
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Breadcrumb & System State */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="text-neutral-400 dark:text-neutral-500 font-mono">
          Amazon Developer Hackathon 2026
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          Alexa+ Track
        </span>
        <span aria-hidden="true">·</span>

        {/* MCP Connection State */}
        <button
          onClick={() => onSelectTab('mcp')}
          data-explain="mcp-server"
          className="flex items-center gap-1.5 hover:text-neutral-900 dark:hover:text-white transition-colors"
          title="Click to inspect MCP Server tools and Streamable HTTP endpoint"
        >
          <Server className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-emerald-700 dark:text-emerald-400">
            {isMcpConnected ? 'MCP Streamable HTTP Active' : 'Connecting to MCP...'}
          </span>
        </button>

        {/* Test Mode Simulator Badge */}
        {isTestModeSimulateFailure && (
          <>
            <span aria-hidden="true">·</span>
            <button
              onClick={onToggleTestMode}
              data-explain="simulate-failure"
              className="flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline"
              title="Click to toggle test mode failure simulation"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Simulated Failure Active</span>
            </button>
          </>
        )}

        {/* Context-Aware Click-to-Explain Fallback Hint (when voice muted/inactive) */}
        {explanationFallbackHint && (
          <>
            <span aria-hidden="true">·</span>
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 text-xs rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 max-w-xs truncate"
              role="status"
              aria-live="polite"
              title={explanationFallbackHint}
            >
              <span className="font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">Info:</span>
              <span className="truncate">{explanationFallbackHint}</span>
            </div>
          </>
        )}
      </div>

      {/* Zone 3: Primary Actions & Background Voice Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Background Voice Assistant Controls (No Separate Panel) */}
        <div className="flex items-center gap-1.5">
          {/* Main Voice Toggle Button with Exact Status Label */}
          <button
            onClick={toggleVoice}
            data-explain="voice-toggle"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all whitespace-nowrap shadow-2xs ${
              statusLabel === 'Listening'
                ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-400/40 animate-pulse'
                : statusLabel === 'Processing'
                ? 'border-violet-400 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 ring-2 ring-violet-400/30'
                : statusLabel === 'Working'
                ? 'border-blue-400 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                : statusLabel === 'Awaiting Approval'
                ? 'border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/40'
                : statusLabel === 'Speaking'
                ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                : statusLabel === 'Error'
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                : statusLabel === 'Paused'
                ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
            title={`ProofLoop Voice Assistant: Status is ${statusLabel}. Mode: ${voiceMode}. Click to start or stop.`}
          >
            {statusLabel === 'Listening' ? (
              <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            ) : statusLabel === 'Processing' ? (
              <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin" />
            ) : statusLabel === 'Working' ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
            ) : statusLabel === 'Awaiting Approval' ? (
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-bounce" />
            ) : statusLabel === 'Speaking' ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            ) : statusLabel === 'Error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            ) : statusLabel === 'Paused' ? (
              <MicOff className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}

            <span>{statusLabel === 'Idle' ? 'Voice Assistant' : statusLabel}</span>
          </button>

          {/* Quick Mute / Stop Audio when assistant is speaking */}
          {isSpeaking && (
            <button
              onClick={muteOrStopAudio}
              className="p-1.5 text-xs rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              title="Stop audio speech"
              aria-label="Stop audio speech"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Compact Voice Mode Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowVoiceSettingsMenu(!showVoiceSettingsMenu)}
              className="p-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
              title={`Voice Mode: ${
                voiceMode === 'hands-free'
                  ? 'Hands-Free (Continuous)'
                  : voiceMode === 'push-to-talk'
                  ? 'Push to Talk'
                  : 'Wake Phrase'
              }. Language: ${locale}. Click to change.`}
              aria-label="Voice Settings Menu"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium hidden md:inline uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {voiceMode === 'hands-free' ? 'Hands-Free' : voiceMode === 'push-to-talk' ? 'PTT' : 'Wake'}
              </span>
            </button>

            {showVoiceSettingsMenu && (
              <div className="absolute right-0 mt-1 w-60 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-2 px-2.5 z-30 text-xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100 dark:border-neutral-700">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">Voice Assistant Mode</span>
                  <button
                    onClick={() => setShowVoiceSettingsMenu(false)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setVoiceMode('hands-free');
                      setShowVoiceSettingsMenu(false);
                    }}
                    className={`w-full p-1.5 text-left rounded flex items-center justify-between transition-colors ${
                      voiceMode === 'hands-free'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs">Hands-Free Conversation</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Continuous multi-turn dialog</div>
                    </div>
                    {voiceMode === 'hands-free' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setVoiceMode('push-to-talk');
                      setShowVoiceSettingsMenu(false);
                    }}
                    className={`w-full p-1.5 text-left rounded flex items-center justify-between transition-colors ${
                      voiceMode === 'push-to-talk'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs">Push to Talk</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Record, review/edit text, submit</div>
                    </div>
                    {voiceMode === 'push-to-talk' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>

                  <button
                    onClick={() => {
                      setVoiceMode('wake-phrase');
                      setShowVoiceSettingsMenu(false);
                    }}
                    className={`w-full p-1.5 text-left rounded flex items-center justify-between transition-colors ${
                      voiceMode === 'wake-phrase'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs">Wake Phrase ("Hey ProofLoop")</div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">Active tab passive listener</div>
                    </div>
                    {voiceMode === 'wake-phrase' && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                </div>

                <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-700 space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    Language ({locale})
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    {SUPPORTED_LOCALES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          setLocale(l.code);
                        }}
                        className={`px-2 py-1 text-left rounded truncate transition-colors ${
                          locale === l.code
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-semibold'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {voiceMode === 'wake-phrase' && (
                  <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 text-[10px] text-amber-800 dark:text-amber-300 leading-tight">
                    Browser note: Wake detection runs only while tab is active with microphone enabled.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mode A: Inline Push-to-Talk Transcript Review Banner */}
          {voiceMode === 'push-to-talk' && stagedTranscript !== null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 rounded-md shadow-xs animate-in fade-in">
              <span className="text-[11px] text-emerald-900 dark:text-emerald-200 font-medium whitespace-nowrap">
                Review:
              </span>
              <input
                type="text"
                value={stagedTranscript}
                onChange={(e) => setStagedTranscript(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitStagedTranscript();
                  }
                }}
                className="w-48 sm:w-64 px-2 py-0.5 text-xs bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-600 rounded text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                placeholder="Edit spoken command..."
              />
              <button
                onClick={submitStagedTranscript}
                className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors whitespace-nowrap"
                title="Execute reviewed command"
              >
                Submit
              </button>
              <button
                onClick={clearStagedTranscript}
                className="p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 rounded"
                title="Discard transcript"
                aria-label="Discard transcript"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Inline Conversational Approval Fallback Control */}
          {pendingApproval && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-md shadow-xs animate-in fade-in">
              <span className="text-[11px] text-amber-900 dark:text-amber-200 font-medium hidden md:inline">
                Say <strong className="font-semibold">"Yes, send it"</strong> or:
              </span>
              <button
                onClick={confirmVoiceApproval}
                className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                title="Approve and execute pending action"
              >
                Approve & Send
              </button>
              <button
                onClick={cancelVoiceApproval}
                className="px-2 py-0.5 text-[11px] font-medium bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded transition-colors"
                title="Cancel pending action"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Test Mode Toggle button */}
        <button
          onClick={onToggleTestMode}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
            isTestModeSimulateFailure
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          title="Toggle developer failure simulation mode"
        >
          {isTestModeSimulateFailure ? 'Failure Test: ON' : 'Test Failures'}
        </button>

        {/* Centralized Theme Toggle with Quick Dropdown */}
        <div className="relative">
          <button
            onClick={toggleTheme}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowThemeMenu(!showThemeMenu);
            }}
            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title={`Current theme: ${theme} (${resolvedTheme}). Click to toggle or right click for options.`}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {showThemeMenu && (
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 z-30 text-xs">
              <button
                onClick={() => {
                  setTheme('light');
                  setShowThemeMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                  theme === 'light' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                onClick={() => {
                  setTheme('dark');
                  setShowThemeMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                  theme === 'dark' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => {
                  setTheme('system');
                  setShowThemeMenu(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                  theme === 'system' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>System</span>
              </button>
            </div>
          )}
        </div>

        {/* Approvals Quick Link with Counter */}
        {pendingApprovalsCount > 0 && (
          <button
            onClick={() => onSelectTab('approvals')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors whitespace-nowrap shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{pendingApprovalsCount} Needed</span>
          </button>
        )}

        {/* 1 Primary Action: Run Hackathon Demo */}
        <button
          onClick={onRunDemo}
          disabled={isDemoRunning}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-md transition-colors shadow-xs whitespace-nowrap"
          title="Executes the full Amazon Hackathon 2026 preparation flow with verifiable outcome proof"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isDemoRunning ? 'Executing Demo...' : 'Run Hackathon Demo'}</span>
        </button>
      </div>
    </header>
  );
};

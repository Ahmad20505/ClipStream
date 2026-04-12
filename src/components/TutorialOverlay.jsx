import { useState, useEffect } from 'react';

const STEPS = [
  {
    title: 'Welcome to ClipStream! 🎬',
    description: "You're about to automate your entire clipping workflow. ClipStream monitors your favorite streamers 24/7 and saves the best moments automatically — no manual work needed.",
    highlight: null,
    icon: '🚀',
  },
  {
    title: 'Find Streamers',
    description: 'Start by searching for any streamer on Twitch, YouTube, or Kick. Click "Find Streamers" in the sidebar to search by name. ClipStream will track when they go live automatically.',
    highlight: 'nav-find',
    icon: '🔍',
  },
  {
    title: 'Active Monitors',
    description: "Once you add a streamer, ClipStream monitors their stream in real time. You'll see live audio levels and chat activity here. The AI learns their baseline energy so it only clips the real highlights.",
    highlight: 'nav-monitors',
    icon: '📡',
  },
  {
    title: 'Clip Gallery',
    description: "Every clip ClipStream saves lands here automatically. Each clip shows a thumbnail, hype score, and timestamp. You can preview or open clips directly from the gallery.",
    highlight: 'nav-gallery',
    icon: '🎞️',
  },
  {
    title: 'Sensitivity & Settings',
    description: "Head to Settings to tune how aggressively ClipStream clips. Use the Sensitivity slider — higher means more clips, lower means only the biggest moments. You can also set your clips folder here.",
    highlight: 'nav-settings',
    icon: '⚙️',
  },
  {
    title: 'Need Help?',
    description: 'Hit the Help button in the sidebar anytime to chat with our AI assistant. It can answer questions about ClipStream, troubleshoot issues, or walk you through any feature.',
    highlight: 'nav-help',
    icon: '💬',
  },
  {
    title: "You're all set!",
    description: "That's everything you need to know. Add your first streamer and let ClipStream do the rest. Welcome to the future of stream clipping.",
    highlight: null,
    icon: '🏆',
  },
];

export default function TutorialOverlay({ onComplete }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const goTo = (next) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 200);
  };

  useEffect(() => {
    // Highlight the relevant nav item
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('tutorial-highlight'));
    if (current.highlight) {
      const el = document.getElementById(current.highlight);
      if (el) el.classList.add('tutorial-highlight');
    }
    return () => {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('tutorial-highlight'));
    };
  }, [step, current.highlight]);

  return (
    <div className="tutorial-backdrop">
      <div className={`tutorial-card ${animating ? 'tutorial-fade-out' : 'tutorial-fade-in'}`}>
        {/* Progress dots */}
        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tutorial-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="tutorial-icon">{current.icon}</div>

        {/* Content */}
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-desc">{current.description}</p>

        {/* Step counter */}
        <p className="tutorial-counter">Step {step + 1} of {STEPS.length}</p>

        {/* Buttons */}
        <div className="tutorial-actions">
          {!isFirst && (
            <button className="tutorial-btn-back" onClick={() => goTo(step - 1)}>
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="tutorial-btn-skip" onClick={onComplete}>
            {isLast ? '' : 'Skip'}
          </button>
          <button className="tutorial-btn-next" onClick={isLast ? onComplete : () => goTo(step + 1)}>
            {isLast ? '🏁 Get Started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

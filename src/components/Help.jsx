import { useState, useRef, useEffect } from 'react';

const SUGGESTED = [
  'How do I add a streamer?',
  'Why are no clips being saved?',
  'How does clip detection work?',
  'How do I change my clips folder?',
  'What platforms are supported?',
];

const KB = [
  {
    patterns: ['add streamer', 'add a streamer', 'how to add', 'find streamer', 'search streamer'],
    answer: `To add a streamer:\n1. Click **Find Streamers** in the left sidebar\n2. Search by their username\n3. Select the platform (Twitch, YouTube, or Kick)\n4. Click **Add & Monitor**\n\nClipStream will immediately start watching for when they go live.`,
  },
  {
    patterns: ['no clips', 'not saving', 'not clipping', 'clips not', 'nothing being saved', 'nothing saved'],
    answer: `If clips aren't being saved, check these things:\n\n1. **Is the streamer live?** ClipStream only clips during live streams\n2. **Is the monitor active?** Check the Active Monitors page — it should show a green dot\n3. **Sensitivity too low?** Go to Settings and increase the Sensitivity slider\n4. **Clips folder set?** In Settings, make sure a clips folder is selected\n5. **streamlink installed?** ClipStream needs streamlink to capture video. Download it at streamlink.github.io`,
  },
  {
    patterns: ['how does', 'clip detection', 'detection work', 'how it works', 'ai detection', 'hype score'],
    answer: `ClipStream uses AI-powered baseline detection:\n\n🎙️ **Audio Analysis** — Monitors volume levels in real time. When audio spikes significantly above the streamer's normal baseline, it flags a potential highlight.\n\n💬 **Chat Activity** — Tracks messages per second. A chat explosion often means something exciting just happened.\n\n🔥 **Hype Score** — Combines both signals into a 0–100% score. The higher the score, the more explosive the moment. Use the Sensitivity slider in Settings to control the threshold.`,
  },
  {
    patterns: ['clips folder', 'change folder', 'save location', 'where are clips', 'where clips saved', 'output folder'],
    answer: `To change where clips are saved:\n\n1. Go to **Settings** in the sidebar\n2. Under **Clips Folder**, click **Browse**\n3. Select any folder on your computer\n\nClipStream will create a subfolder for each streamer inside your chosen folder automatically.`,
  },
  {
    patterns: ['platform', 'platforms', 'twitch', 'youtube', 'kick', 'supported'],
    answer: `ClipStream currently supports:\n\n🟣 **Twitch** — Full support with chat monitoring\n🔴 **YouTube Live** — Full support\n🟢 **Kick** — Full support\n\nMore platforms may be added in future updates.`,
  },
  {
    patterns: ['sensitivity', 'too many clips', 'too few clips', 'clip too much', 'clip too little', 'adjust'],
    answer: `You can tune how aggressively ClipStream clips:\n\n**Go to Settings → Clip Sensitivity**\n\n- **Higher sensitivity (70-100)** — Clips more often, catches smaller moments\n- **Medium (40-70)** — Balanced, good for most streamers\n- **Lower (0-40)** — Only clips the biggest, most explosive moments\n\nFor high-energy streamers like variety or IRL streamers, lower sensitivity works best.`,
  },
  {
    patterns: ['cancel', 'subscription', 'refund', 'billing', 'charge', 'payment'],
    answer: `For subscription and billing questions:\n\n- To **cancel**, go to Settings → Subscription → Cancel Plan\n- For **refunds**, please email support@clipstreams.com within 7 days of your charge\n- Your subscription stays active until the end of your billing period after cancellation`,
  },
  {
    patterns: ['error', 'crash', 'not working', 'broken', 'bug', 'issue', 'problem'],
    answer: `Sorry to hear you're having trouble! Try these steps:\n\n1. **Restart ClipStream** — Close and reopen the app\n2. **Check streamlink** — Many features need streamlink installed (streamlink.github.io)\n3. **Check your internet** — ClipStream needs internet to monitor streams\n4. **Reinstall** — Download the latest version from our website\n\nIf the problem persists, email us at support@clipstreams.com with a description of what happened.`,
  },
  {
    patterns: ['streamlink', 'install streamlink', 'ffmpeg'],
    answer: `ClipStream needs **streamlink** to capture video from streams.\n\n**To install streamlink:**\n1. Go to **streamlink.github.io**\n2. Download the installer for your OS (Mac or Windows)\n3. Run the installer\n4. Restart ClipStream\n\nstreamlink is free and open source. ClipStream uses it behind the scenes to record stream video.`,
  },
  {
    patterns: ['monitor', 'monitoring', 'start monitor', 'stop monitor'],
    answer: `**To start monitoring:**\n1. Go to **Find Streamers**, add a streamer\n2. They'll appear in **Active Monitors** as soon as they go live\n\n**To stop monitoring:**\n1. Go to **Active Monitors**\n2. Click the **Stop** button next to the streamer\n\nYou can also manage all your monitored streamers from the Dashboard.`,
  },
  {
    patterns: ['notification', 'notify', 'alert'],
    answer: `ClipStream sends desktop notifications when:\n\n🔴 A streamer you monitor goes **live**\n🎬 A new **clip is saved**\n\nMake sure you've allowed notifications for ClipStream in your System Settings → Notifications.`,
  },
  {
    patterns: ['hello', 'hi', 'hey', 'sup', 'help'],
    answer: `Hey! 👋 I'm the ClipStream assistant. I can help you with:\n\n- Adding streamers\n- Fixing clipping issues\n- Adjusting settings\n- Billing questions\n- General how-tos\n\nWhat do you need help with?`,
  },
  {
    patterns: ['thank', 'thanks', 'awesome', 'great', 'perfect', 'nice'],
    answer: `Happy to help! 🎉 Let me know if you have any other questions.`,
  },
];

function getResponse(input) {
  const lower = input.toLowerCase();
  for (const entry of KB) {
    if (entry.patterns.some(p => lower.includes(p))) {
      return entry.answer;
    }
  }
  return `I'm not sure about that one. For more help, email us at **support@clipstreams.com** and we'll get back to you within 24 hours.\n\nYou can also try rephrasing your question — I know about adding streamers, clips, settings, billing, and troubleshooting.`;
}

function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export default function Help() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hi! 👋 I'm the ClipStream assistant. Ask me anything about the app — I'm here to help!",
      id: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');

    setMessages(prev => [...prev, { role: 'user', text: msg, id: Date.now() }]);
    setTyping(true);

    setTimeout(() => {
      const response = getResponse(msg);
      setTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: response, id: Date.now() }]);
    }, 800 + Math.random() * 600);
  };

  return (
    <div className="page help-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Help & Support</h1>
          <p className="page-subtitle">Ask anything about ClipStream</p>
        </div>
      </div>

      <div className="help-container">
        {/* Chat window */}
        <div className="help-chat">
          <div className="help-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`help-msg help-msg-${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="help-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div
                  className="help-bubble"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                />
              </div>
            ))}

            {typing && (
              <div className="help-msg help-msg-bot">
                <div className="help-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="help-bubble help-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && (
            <div className="help-suggestions">
              {SUGGESTED.map(s => (
                <button key={s} className="help-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="help-input-row">
            <input
              className="help-input"
              placeholder="Ask a question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button
              className="help-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || typing}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Contact card */}
        <div className="help-contact-card">
          <div className="help-contact-icon">📧</div>
          <h3>Still need help?</h3>
          <p>Our support team typically responds within 24 hours.</p>
          <a href="mailto:support@clipstreams.com" className="help-contact-btn">
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
}

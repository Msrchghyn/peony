"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Search, Send, Sparkles } from "lucide-react";

const gardens = {
  job: {
    cols: ["Role", "Company", "Status", "Last email"],
    rows: [
      ["Design engineer", "Acme", "Interview tomorrow", "Invite for 10:30 AM"],
      ["Product designer", "Northwind Studio", "Applied", "2 days ago"],
      ["Frontend engineer", "Fieldnote", "Gone quiet", "6 days ago"],
      ["Design lead", "Orchard", "Gone quiet", "8 days ago"],
    ],
    questions: [
      ["Which have gone quiet?", [2, 3], <> <b>2 applications</b> haven't heard back in 6 days or more. Peony can draft a polite nudge for each.</>],
      ["What is coming up?", [0], <><b>Interview with Acme</b> tomorrow at 10:30 AM. It's already on your calendar.</>],
    ],
  },
  work: {
    cols: ["Thread", "With", "Status", "Due"],
    rows: [
      ["Onboarding documents", "Adam", "Reply ready", "Today"],
      ["Design proposal", "Katherine", "No reply yet", "Follow up"],
      ["Weekly check-in", "Jason", "Time changed", "3:00 PM"],
      ["Logo V3", "Cheng", "New file", "This week"],
    ],
    questions: [
      ["What is due today?", [0], <><b>Onboarding documents</b> for Adam. A reply with the file attached is ready to send.</>],
      ["Who has not replied?", [1], <><b>Katherine</b> hasn't answered your design proposal request. Peony suggests a follow-up.</>],
    ],
  },
  buy: {
    cols: ["Order", "Shop", "Status", "Arrives"],
    rows: [
      ["Order A20", "Hollis & Co", "On the way", "Sep 26"],
      ["Order 366", "Paper Goods", "Shipped", "Sep 29"],
      ["Invoice 1042", "Acme Supplies", "Ready for review", "No delivery"],
    ],
    questions: [
      ["What is arriving soon?", [0, 1], <><b>2 deliveries</b> are coming, the first on Sep 26.</>],
      ["Anything to review?", [2], <><b>Invoice 1042</b> is ready for your review.</>],
    ],
  },
} as const;

type GardenKey = keyof typeof gardens;

const statusClass = (value: string) => {
  if (value.includes("Interview") || value.includes("Time")) return "pill iris";
  if (value.includes("Gone") || value.includes("Ready")) return "pill butter";
  if (value.includes("Reply") || value.includes("New")) return "pill rose";
  if (value.includes("Shipped") || value.includes("way")) return "pill iris";
  return "pill";
};

export default function PeonyPreview() {
  const [garden, setGarden] = useState<GardenKey>("job");
  const [question, setQuestion] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const askRef = useRef<HTMLDivElement>(null);
  const data = gardens[garden];
  const selectedQuestion = question === null ? null : data.questions[question];
  const highlightedRows: readonly number[] = selectedQuestion?.[1] ?? [];

  useEffect(() => {
    const node = askRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        const timers = [0, 1000, 2000].map((delay, index) => window.setTimeout(() => setStep(index), 700 + delay));
        window.setTimeout(() => setStep(3), 3450);
        return () => timers.forEach(window.clearTimeout);
      }
    }, { threshold: 0.7 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const run = () => {
    if (running) return;
    setRunning(true); setStep(-1);
    [0, 1, 2].forEach((index) => window.setTimeout(() => setStep(index), index * 1000));
    window.setTimeout(() => { setStep(3); setRunning(false); }, 3100);
  };

  const actionSteps: Array<{ title: string; idle: string; done: string; icon: ReactNode }> = [
    { title: "Find", idle: "Search invoices from Acme", done: "Found 3 invoices from Acme", icon: <Search size={16} /> },
    { title: "Mark", idle: "Mark them as paid", done: "Marked all 3 as paid", icon: <Check size={16} /> },
    { title: "Send", idle: "Send them to Lena", done: "Sent to Lena in accounting", icon: <Send size={16} /> },
  ];

  return (
    <>
      <section className="section" id="notice">
        <div className="wrap">
          <div className="sec-head"><h2>Peony notices what matters.</h2><p>Instead of making you process every email equally, Peony gently surfaces what needs action, collects what is useful, and lets the rest stay quiet until you need it.</p></div>
          <div className="counts">
            <div className="count"><div className="n">3</div><div className="l"><span className="dot rose" />Priority</div><p>Brought forward, with a reply already drafted.</p></div>
            <div className="count"><div className="n">8</div><div className="l"><span className="dot mint" />Updates</div><p>Summarized in a line so you can skim and go.</p></div>
            <div className="count"><div className="n">21</div><div className="l"><span className="dot iris" />Later</div><p>Kept out of your way until you go looking.</p></div>
          </div>
          <p className="quiet-note"><b>29 messages didn't need you</b> this morning. Peony handled them quietly.</p>
        </div>
      </section>

      <section className="section" id="gardens" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><h2>Related emails grow into gardens.</h2><p>Job applications, work threads and orders don't scatter across your inbox. Peony plants them together so each one becomes a little space you can open.</p></div>
          <div className="ws">
            <div className="ws-tabs" role="tablist">
              {([['job','✿','Job Search','12'],['work','✿','Work','28'],['buy','✿','Purchases','9']] as const).map(([key, flower, name, count]) => (
                <button key={key} className="ws-tab" role="tab" aria-selected={garden === key} onClick={() => { setGarden(key); setQuestion(null); }}>
                  <span className="tab-flower">{flower}</span>{name}<span className="cnt">{count}</span>
                </button>
              ))}
            </div>
            <div className="ws-scroll">
              <table><thead><tr>{data.cols.map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>
                {data.rows.map((row, rowIndex) => <tr className={question !== null && highlightedRows.includes(rowIndex) ? "hit" : ""} key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 2 ? <span className={statusClass(cell)}>{cell}</span> : cell}</td>)}</tr>)}
              </tbody></table>
            </div>
            <div className="ws-ask"><span className="ask-l"><Sparkles size={16} />Ask Peony</span>{data.questions.map(([text], index) => <button key={text} className="qchip" aria-pressed={question === index} onClick={() => setQuestion(question === index ? null : index)}>{text}</button>)}</div>
            <p className="ws-answer">{selectedQuestion === null ? "Pick a question and Peony will point to the rows." : selectedQuestion[2]}</p>
          </div>
        </div>
      </section>

      <section className="section" id="act" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head"><h2>See the next step without digging.</h2><p>Ask once, in plain words. Peony finds it, does the tedious part, and shows you exactly what it did.</p></div>
          <div className="ask-card" ref={askRef}>
            <div className="prompt"><Search size={16} /><span>Find last month's invoices from Acme, mark them paid, and send them to Lena.</span><button className="btn btn-ink" type="button" onClick={run} disabled={running}>{step >= 3 ? "Run it again" : "Ask Peony"}</button></div>
            <ol className="chain">
              {actionSteps.map((item, index) => (
                <li
                  className={`step ${step === index ? "active" : ""} ${step > index ? "done" : ""}`}
                  key={item.title}
                >
                  <span className="st-ic">{item.icon}</span>
                  <div>
                    <b>{item.title}</b>
                    <small>{step > index ? item.done : item.idle}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import logo from './khatabook-logo.png';
import axios from 'axios';

const REQUIRED_COLUMNS = [
  'Title',
  'Body',
  'CTA',
  'Delivery Date Time',
  'Campaign Name',
  'Deep Link',
  'Segment',
  'Image',
  'Language',
];

const COLUMN_TO_PAYLOAD: Record<string, string> = {
  'Title': 'title',
  'Body': 'body',
  'CTA': 'cta',
  'Delivery Date Time': 'deliveryDateTime',
  'Campaign Name': 'campaignName',
  'Deep Link': 'deeplink',
  'Segment': 'segmentID',
  'Image': 'backgroundImageLink',
  'Language': 'language',
};

type Campaign = {
  title: string;
  body: string;
  cta: string;
  deliveryDateTime: string;
  campaignName: string;
  deeplink: string;
  segmentID: string;
  backgroundImageLink: string;
  language: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failure';
  failureReason?: string;
};

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [csvProcessed, setCsvProcessed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

  // Timer effect
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  // Progress effect
  useEffect(() => {
    if (campaigns.length > 0) {
      const done = campaigns.filter(c => c.status === 'Completed' || c.status === 'Failure').length;
      setProgress(Math.round((done / campaigns.length) * 100));
      if (done === campaigns.length && timerActive) {
        setTimerActive(false);
      }
    } else {
      setProgress(0);
    }
  }, [campaigns, timerActive]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCampaigns([]);
    setCsvProcessed(false);
    setProgress(0);
    setTimer(0);
    setTimerActive(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSV(text);
    };
    reader.readAsText(file);
  };

  const processCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setCsvError('CSV must have at least one data row.');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim());
    const missing = REQUIRED_COLUMNS.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      setCsvError('Incorrect CSV format. Missing columns: ' + missing.join(', '));
      return;
    }
    const data: Campaign[] = lines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      headers.forEach((h, i) => {
        if (COLUMN_TO_PAYLOAD[h]) {
          row[COLUMN_TO_PAYLOAD[h]] = values[i]?.trim() || '';
        }
      });
      row.status = 'Pending';
      return row as Campaign;
    });
    setCampaigns(data);
    setCsvProcessed(true);
  };

  const handleCreateCampaigns = async () => {
    setIsProcessing(true);
    setTimer(0);
    setTimerActive(true);
    // Set all to Processing
    setCampaigns(prev => prev.map(c => ({ ...c, status: 'Processing', failureReason: undefined })));
    try {
      const response = await axios.post(`${backendUrl}/api/create-campaigns`, {
        campaigns: campaigns.map(({ status, failureReason, ...rest }) => rest),
      });
      const results = response.data.results;
      setCampaigns(prev => prev.map((c, idx) => {
        const result = results.find((r: any) => r.idx === idx);
        if (!result) return c;
        if (result.status === 'Completed') {
          return { ...c, status: 'Completed', failureReason: undefined };
        } else {
          return { ...c, status: 'Failure', failureReason: typeof result.reason === 'string' ? result.reason : JSON.stringify(result.reason) };
        }
      }));
    } catch (err: any) {
      setCampaigns(prev => prev.map(c => ({ ...c, status: 'Failure', failureReason: 'Backend error' })));
    }
    setIsProcessing(false);
  };

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="ct-root">
      <div className="ct-logo-fixed">
        <img src={logo} alt="Khatabook Logo" className="ct-logo" />
      </div>
      <header className="ct-header">
        <h1 className="ct-title">CleverTap API Campaign Creator</h1>
      </header>
      <hr className="ct-divider" />
      <div className="ct-content">
        <div className="ct-upload-section">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="ct-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload CSV
          </button>
          {csvError && <div className="ct-error">{csvError}</div>}
          {csvProcessed && !csvError && (
            <>
              <div className="ct-success">CSV processed successfully!</div>
              <div className="ct-campaign-count">Number of campaigns displayed: <b>{campaigns.length}</b></div>
            </>
          )}
          {/* Progress Bar and Timer */}
          {campaigns.length > 0 && (
            <div style={{ width: '100%', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, background: '#eee', borderRadius: 8, height: 14, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: '#b71c1c', transition: 'width 0.3s', borderRadius: 8 }} />
                </div>
                <span style={{ minWidth: 48, color: '#b71c1c', fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ marginTop: 4, color: '#888', fontSize: 13 }}>
                {progress === 100 && campaigns.length > 0
                  ? `All campaigns processed in ${formatTime(timer)}.`
                  : timerActive || timer > 0
                  ? `Elapsed time: ${formatTime(timer)}`
                  : null}
              </div>
            </div>
          )}
        </div>
        <button
          className="ct-create-btn"
          disabled={!csvProcessed || !!csvError || isProcessing}
          onClick={handleCreateCampaigns}
        >
          {isProcessing ? 'Processing...' : 'Create Campaigns'}
        </button>
        <div className="ct-preview-section">
          <h2>Campaign Preview</h2>
          <div className="ct-campaign-list">
            {campaigns.length === 0 && <div className="ct-empty">No campaigns to preview.</div>}
            {campaigns.map((c, idx) => (
              <div className="ct-campaign-card" key={idx}>
                <div className="ct-campaign-header-block">
                  <span className="ct-campaign-label">{c.campaignName}</span>
                  <span className={`ct-status ct-status-${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
                <div className="ct-campaign-details" style={{flexDirection: 'column', gap: '0.3rem', color: '#222'}}>
                  <span><b>Title:</b> {c.title}</span>
                  <span><b>Description:</b> {c.body}</span>
                  <span><b>CTA:</b> {c.cta}</span>
                  <span><b>Deeplink:</b> {c.deeplink}</span>
                  <span><b>Language:</b> {c.language}</span>
                  <span><b>Delivery Date Time:</b> {c.deliveryDateTime}</span>
                  {c.backgroundImageLink && c.backgroundImageLink !== '' && (
                    <span style={{marginTop: '0.5rem'}}>
                      <b>Image Preview:</b><br />
                      <img src={c.backgroundImageLink} alt="Campaign Visual" style={{maxWidth: '320px', maxHeight: '120px', borderRadius: '8px', border: '1px solid #eee', marginTop: '0.3rem'}} />
                    </span>
                  )}
                  {c.status === 'Failure' && c.failureReason && (
                    <details className="ct-failure-dropdown">
                      <summary>Show Reason</summary>
                      <div>{c.failureReason}</div>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

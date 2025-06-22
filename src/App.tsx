import { useState, useEffect } from 'react';
import './App.css';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface Stock {
  Symbol: string;
  Security: string;
  Market: string;
}

interface AiResult {
  forecast: { date: string; price: number }[];
  summary: string;
}

const getUnit = (market: string) => (market === 'KOSPI' || market === 'KOSDAQ') ? '원' : '달러';

const apiUrl = import.meta.env.VITE_API_URL;

const getApiUrl = (path: string) => {
  if (!apiUrl || apiUrl === 'undefined') return path;
  // apiUrl이 /로 끝나면 중복 방지
  return apiUrl.replace(/\/$/, '') + path;
};

function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stock[]>([]);
  const [selected, setSelected] = useState<Stock | null>(null);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [latestPrice, setLatestPrice] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);

  // CSV 파싱 함수
  const parseCSV = (csv: string): Stock[] => {
    const lines = csv.split('\n');
    return lines.slice(1).map(line => {
      const cols = line.replace(/\r/g, '').split(',');
      if (cols.length < 3) return null;
      return {
        Symbol: cols[0],
        Security: cols[1],
        Market: cols[2],
      };
    }).filter(Boolean) as Stock[];
  };

  // 종목 데이터 불러오기
  useEffect(() => {
    Promise.all([
      fetch('/us_stocks.csv').then(res => res.text()),
      fetch('/kospi_stocks.csv').then(res => res.text()),
      fetch('/nyse_stocks.csv').then(res => res.text()),
      fetch('/kosdaq_stocks.csv').then(res => res.text()),
    ]).then(([us, ko, nyse, kosdaq]) => {
      setAllStocks([
        ...parseCSV(us),
        ...parseCSV(ko),
        ...parseCSV(nyse),
        ...parseCSV(kosdaq),
      ]);
    });
  }, []);

  // 검색
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    setResults(
      allStocks.filter(
        s => s.Symbol.toLowerCase().includes(q) || s.Security.toLowerCase().includes(q)
      ).slice(0, 20)
    );
  }, [query, allStocks]);

  // 종목 선택 시 최신 종가 조회
  useEffect(() => {
    if (!selected) {
      setLatestPrice(null);
      setAiResult(null);
      return;
    }
    setLoadingPrice(true);
    setLatestPrice(null);
    fetch(getApiUrl(`/api/price?symbol=${selected.Symbol}&market=${selected.Market}`))
      .then(async res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => setLatestPrice(data.close))
      .catch(() => setLatestPrice(null))
      .finally(() => setLoadingPrice(false));
  }, [selected]);

  // AI 분석 요청
  const handleAiAnalyze = () => {
    if (!selected) return;
    setLoadingAi(true);
    setAiResult(null);
    fetch(getApiUrl(`/api/ai?symbol=${selected.Symbol}&market=${selected.Market}`))
      .then(async res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => setAiResult(data))
      .catch(() => setAiResult(null))
      .finally(() => setLoadingAi(false));
  };

  return (
    <>
      <div className="title-main">AI 기반 주식 분석</div>
      <div className="title-sub">미국(NASDAQ, NYSE, S&P500, DOWJONES) · 한국(KOSPI, KOSDAQ) 실시간 AI 예측</div>
      <div className="container">
        <h1>주식 종목 검색</h1>
        <input
          type="text"
          placeholder="종목코드 또는 회사명 입력"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          className="search-input"
        />
        {query && results.length > 0 && !selected && (
          <ul className="search-results">
            {results.map((stock: Stock) => (
              <li
                key={stock.Market + stock.Symbol}
                onClick={() => setSelected(stock)}
              >
                {stock.Security} ({stock.Symbol}) [{stock.Market}]
              </li>
            ))}
          </ul>
        )}
        {selected && (
          <div className="selected-stock">
            <h2>선택한 종목</h2>
            <p>
              <b>{selected.Security}</b> ({selected.Symbol}) [{selected.Market}]
            </p>
            <p>
              {loadingPrice
                ? '최신 종가 조회 중...'
                : latestPrice !== null
                  ? `가장 최근 종가: ${latestPrice.toLocaleString()}${getUnit(selected.Market)}`
                  : `최신 종가 정보를 불러올 수 없습니다.`}
            </p>
            <button onClick={handleAiAnalyze} disabled={loadingAi}>
              {loadingAi ? 'AI 분석 중...' : 'AI 분석하기'}
            </button>
            {aiResult && (
              <div className="ai-result">
                <h3>AI 예측 요약</h3>
                <p>{aiResult.summary}</p>
                <h4>예측 차트(향후)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={aiResult.forecast} margin={{ left: 10, right: 10 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={10} />
                    <YAxis tickFormatter={(v: number) => v.toLocaleString()} />
                    <Tooltip formatter={(value: number) => `${Number(value).toLocaleString()}${getUnit(selected.Market)}`} />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
      <a
        className="financial-juice-link"
        href="https://www.financialjuice.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Financial Juice 실시간 뉴스 바로가기
      </a>
    </>
  );
}

export default App;

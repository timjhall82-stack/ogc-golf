import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection,
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Trophy, 
  Flag, 
  Users, 
  Share2, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw,
  Search,
  Activity,
  ClipboardList,
  Edit2,
  Swords,
  Coins,
  ArrowLeft,
  Clock,
  MessageCircle,
  Link as LinkIcon,
  Save,
  MapPin,
  Calculator
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyCRLOH8eOZOLMJh__S90wHnAXVgTvRHqBY",
  authDomain: "ogc-live-scoring.firebaseapp.com",
  projectId: "ogc-live-scoring",
  storageBucket: "ogc-live-scoring.firebasestorage.app",
  messagingSenderId: "1090092959152",
  appId: "1:1090092959152:web:01c430d0c7e6986ee54275",
  measurementId: "G-S0E5B1ZPNK"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Constants & Data ---

const GAME_FORMATS = {
  STABLEFORD: 'Stableford',
  STROKE_NET: 'Stroke Play (Net)',
  STROKE_GROSS: 'Stroke Play (Gross)',
  MATCH_SINGLES: 'Match Play (Singles)',
  MATCH_PAIRS: 'Match Play (Pairs)',
  SKINS: 'Skins'
};

// COURSE DATABASE
const COURSES = [
  {
    id: 'olton-white',
    name: 'Olton Golf Club (White)',
    par: 70,
    slope: 135,
    cr: 71.5,
    holes: [
      { number: 1, par: 4, si: 7 }, { number: 2, par: 4, si: 3 }, { number: 3, par: 4, si: 17 },
      { number: 4, par: 4, si: 13 }, { number: 5, par: 3, si: 5 }, { number: 6, par: 4, si: 9 },
      { number: 7, par: 4, si: 1 }, { number: 8, par: 3, si: 15 }, { number: 9, par: 4, si: 11 },
      { number: 10, par: 4, si: 6 }, { number: 11, par: 5, si: 8 }, { number: 12, par: 4, si: 14 },
      { number: 13, par: 3, si: 18 }, { number: 14, par: 4, si: 2 }, { number: 15, par: 3, si: 12 },
      { number: 16, par: 4, si: 4 }, { number: 17, par: 4, si: 16 }, { number: 18, par: 5, si: 10 }
    ]
  },
  {
    id: 'olton-yellow',
    name: 'Olton Golf Club (Yellow)',
    par: 70,
    slope: 132,
    cr: 70.0,
    holes: [
      { number: 1, par: 4, si: 7 }, { number: 2, par: 4, si: 3 }, { number: 3, par: 4, si: 17 },
      { number: 4, par: 4, si: 13 }, { number: 5, par: 3, si: 5 }, { number: 6, par: 4, si: 9 },
      { number: 7, par: 4, si: 1 }, { number: 8, par: 3, si: 15 }, { number: 9, par: 4, si: 11 },
      { number: 10, par: 4, si: 6 }, { number: 11, par: 5, si: 8 }, { number: 12, par: 4, si: 14 },
      { number: 13, par: 3, si: 18 }, { number: 14, par: 4, si: 2 }, { number: 15, par: 3, si: 12 },
      { number: 16, par: 4, si: 4 }, { number: 17, par: 4, si: 16 }, { number: 18, par: 5, si: 10 }
    ]
  },
  {
    id: 'olton-red',
    name: 'Olton Golf Club (Red)',
    par: 73,
    slope: 136,
    cr: 73.7,
    holes: [
      { number: 1, par: 5, si: 9 }, { number: 2, par: 4, si: 3 }, { number: 3, par: 4, si: 17 },
      { number: 4, par: 4, si: 5 }, { number: 5, par: 3, si: 13 }, { number: 6, par: 4, si: 1 },
      { number: 7, par: 5, si: 15 }, { number: 8, par: 3, si: 11 }, { number: 9, par: 4, si: 7 },
      { number: 10, par: 4, si: 2 }, { number: 11, par: 5, si: 14 }, { number: 12, par: 4, si: 6 },
      { number: 13, par: 3, si: 16 }, { number: 14, par: 5, si: 18 }, { number: 15, par: 3, si: 8 },
      { number: 16, par: 4, si: 4 }, { number: 17, par: 4, si: 12 }, { number: 18, par: 5, si: 10 }
    ]
  },
  {
    id: 'generic',
    name: 'Generic 18 Hole',
    par: 72,
    slope: 113,
    cr: 72.0,
    holes: Array(18).fill(null).map((_, i) => ({ number: i + 1, par: 4, si: i + 1 }))
  }
];

const generateGameId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// --- Logic Helpers ---

// WHS 2024 UK Formula: (HI x (Slope/113)) + (CR - Par)
const calculateCourseHandicap = (hi, slope, cr, par) => {
  if (!hi && hi !== 0) return 0;
  const slopeRating = slope || 113;
  const courseRating = cr || par || 72;
  const parRating = par || 72;
  
  const rawCh = (hi * (slopeRating / 113)) + (courseRating - parRating);
  return Math.round(rawCh);
};

const getStrokesReceived = (courseHandicap, strokeIndex) => {
  let strokes = 0;
  // Handle positive handicaps
  if (courseHandicap >= 0) {
    if (courseHandicap >= strokeIndex) strokes += 1;
    if (courseHandicap - 18 >= strokeIndex) strokes += 1;
    if (courseHandicap - 36 >= strokeIndex) strokes += 1; // High handicappers
  } else {
    // Plus handicap logic (simplified: +1 means add 1 to gross on SI 18)
    // For simplicity in this UI, we typically assume standard handicaps, but logic exists
    // A +2 golfer gives shots back. 
    // +1 Golfer: Score + 1 on SI 18.
    // +2 Golfer: Score + 1 on SI 18, SI 17.
    const plusHcp = Math.abs(courseHandicap);
    const impactHoles = 18 - plusHcp + 1; // e.g. +1 starts impacting at SI 18
    if (strokeIndex >= impactHoles) strokes = -1;
  }
  return strokes;
};

const getNetScore = (gross, courseHandicap, si) => {
  if (gross === null || gross === '' || gross === 0) return null;
  return parseInt(gross) - getStrokesReceived(courseHandicap, si);
};

const getAvatarUrl = (name, customUrl) => {
  if (customUrl) return customUrl;
  const seed = encodeURIComponent(name || 'Player');
  return `https://ui-avatars.com/api/?name=${seed}&background=random&color=fff&size=128&bold=true`;
};

// --- Main App ---

export default function GolfApp() {
  const [user, setUser] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null); 
  const [allGames, setAllGames] = useState([]); 
  const [loading, setLoading] = useState(true);

  // Auth & Data Listeners
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'golf_games'), (snapshot) => {
      const games = [];
      snapshot.forEach(doc => games.push({ ...doc.data(), id: doc.id })); 
      // Sort active first, then by date
      games.sort((a, b) => {
         if (a.status === 'active' && b.status !== 'active') return -1;
         if (a.status !== 'active' && b.status === 'active') return 1;
         return (b.created?.seconds || 0) - (a.created?.seconds || 0);
      });
      setAllGames(games);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Actions
  const createGame = async (gameName, templateId = 'olton-yellow') => {
    if (!user) return;
    const newId = generateGameId();
    const template = COURSES.find(c => c.id === templateId) || COURSES[0]; // Default to Olton Yellow if not found
    
    const initialData = {
      hostId: user.uid,
      gameName: gameName || `Game ${newId}`,
      created: serverTimestamp(),
      
      // Course Data
      courseName: template.name,
      par: template.par,
      slope: template.slope,
      cr: template.cr,
      holes: template.holes,
      
      format: GAME_FORMATS.STABLEFORD,
      players: [],
      status: 'setup'
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'golf_games', newId), initialData);
    setActiveGameId(newId);
  };

  const updateGameData = async (gameId, updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'golf_games', gameId), updates);
  };

  const activeGameData = useMemo(() => allGames.find(g => g.id === activeGameId), [allGames, activeGameId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading OGC Live...</div>;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-20 md:pb-0">
      <Header activeGameId={activeGameId} goHome={() => setActiveGameId(null)} />
      <main className="max-w-4xl mx-auto p-4">
        {!activeGameId ? (
          <DashboardView games={allGames} onCreate={createGame} onJoin={setActiveGameId} />
        ) : (
          <>
             {!activeGameData ? (
               <div className="text-center py-10"><p>Game not found.</p><button onClick={() => setActiveGameId(null)} className="underline">Back</button></div>
             ) : activeGameData.status === 'setup' ? (
               <SetupView 
                  game={activeGameData} 
                  gameId={activeGameId}
                  updateGame={(updates) => updateGameData(activeGameId, updates)} 
                  onStart={() => updateGameData(activeGameId, { status: 'active' })} 
               />
             ) : (
               <PlayView 
                  game={activeGameData} 
                  updateGame={(updates) => updateGameData(activeGameId, updates)} 
               />
             )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Components ---

const Header = ({ activeGameId, goHome }) => (
  <header className="bg-emerald-900 text-white p-4 shadow-lg sticky top-0 z-50">
    <div className="max-w-4xl mx-auto flex justify-between items-center">
      <div className="flex items-center gap-2 cursor-pointer" onClick={goHome}>
        {activeGameId && <ArrowLeft className="h-5 w-5 md:hidden" />}
        <Flag className="h-6 w-6 text-yellow-400 flex-shrink-0" fill="currentColor" />
        <div className="flex flex-col">
          <h1 className="text-sm md:text-xl font-bold tracking-tight leading-none">OGC Players</h1>
          <span className="text-[10px] md:text-xs text-emerald-400 font-medium">Live Tournament Tracker</span>
        </div>
      </div>
      {activeGameId && (
        <div className="flex items-center gap-2">
           <a href={`whatsapp://send?text=Join my golf game on OGC Players! ID: ${activeGameId}`} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full"><MessageCircle className="h-4 w-4" /></a>
           <div className="hidden md:flex items-center gap-2 bg-emerald-800/50 px-3 py-1 rounded-full text-xs">
             <span className="opacity-75">ID:</span>
             <span className="font-mono font-bold text-yellow-400">{activeGameId}</span>
             <Share2 className="h-3 w-3 cursor-pointer" onClick={() => navigator.clipboard.writeText(activeGameId)} />
           </div>
        </div>
      )}
    </div>
  </header>
);

function DashboardView({ games, onCreate, onJoin }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('olton-yellow');

  const activeGames = games.filter(g => g.status === 'active');
  const setupGames = games.filter(g => g.status === 'setup');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        {!showCreate ? (
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Tournament Dashboard</h2>
              <p className="text-slate-500 text-sm">Select a game or start a new group.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
               <input type="text" placeholder="Enter ID" value={joinId} onChange={(e) => setJoinId(e.target.value)} className="bg-slate-50 border rounded-lg px-4 py-2 w-full md:w-32 text-center uppercase font-mono text-sm" maxLength={6} />
               {joinId ? <button onClick={() => onJoin(joinId.toUpperCase())} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm">Join</button> : <button onClick={() => setShowCreate(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 w-full md:w-auto justify-center"><Plus size={16} /> New Group</button>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-bold text-lg">Create New Group</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" placeholder="Group Name (e.g. Tiger's 4-Ball)" value={newGameName} onChange={(e) => setNewGameName(e.target.value)} className="border rounded-lg px-4 py-2" autoFocus />
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="border rounded-lg px-4 py-2 bg-white">
                {COURSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => onCreate(newGameName, selectedCourseId)} className="bg-emerald-600 text-white px-6 rounded-lg font-bold flex-1">Create</button>
                <button onClick={() => setShowCreate(false)} className="text-slate-400 px-4">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="flex items-center gap-2 font-bold text-slate-400 uppercase tracking-widest text-xs mb-4"><Activity className="h-4 w-4 text-emerald-500" /> Live Now</h3>
        {activeGames.length === 0 ? <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed text-slate-400">No active games.</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{activeGames.map(game => <GameCard key={game.id} game={game} onClick={() => onJoin(game.id)} />)}</div>}
      </div>

      {setupGames.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-400 uppercase tracking-widest text-xs mb-4 mt-8"><Clock className="h-4 w-4 text-blue-500" /> In Setup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{setupGames.map(game => <GameCard key={game.id} game={game} onClick={() => onJoin(game.id)} isSetup />)}</div>
        </div>
      )}
    </div>
  );
}

function GameCard({ game, onClick, isSetup }) {
  const playerCount = game.players?.length || 0;
  const holesPlayed = game.players?.[0]?.scores?.filter(Boolean).length || 0;

  return (
    <div onClick={onClick} className={`relative bg-white p-4 rounded-xl shadow-sm border transition-all hover:shadow-md cursor-pointer group ${isSetup ? 'border-slate-200' : 'border-emerald-100 ring-1 ring-emerald-50'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-bold text-lg text-slate-800 group-hover:text-emerald-700">{game.gameName || "Golf Game"}</h4>
          <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {game.courseName}</p>
        </div>
        <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">{game.format.split(' ')[0]}</div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="flex -space-x-2">
           {game.players && game.players.slice(0,3).map((p, i) => <img key={i} src={getAvatarUrl(p.name, p.avatarUrl)} className="h-8 w-8 rounded-full border-2 border-white object-cover" alt={p.name}/>)}
           {playerCount > 3 && <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-400">+{playerCount - 3}</div>}
        </div>
        {!isSetup ? <div className="text-right"><div className="text-xs text-slate-400 uppercase font-bold">Progress</div><div className="text-sm font-bold text-emerald-600">{holesPlayed} / 18 Holes</div></div> : <div className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Setup <ChevronRight size={12}/></div>}
      </div>
    </div>
  );
}

// --- SETUP VIEW ---

function SetupView({ game, gameId, updateGame, onStart }) {
  const [activeTab, setActiveTab] = useState('players');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Player Input State
  const [newPlayer, setNewPlayer] = useState({ name: '', hcpIndex: '', cdh: '', avatar: '' });
  const [loadingCdh, setLoadingCdh] = useState(false);
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [saveToFriends, setSaveToFriends] = useState(true);
  
  // Friends System
  const [savedFriends, setSavedFriends] = useState([]);

  useEffect(() => {
    const loaded = localStorage.getItem('golf_friends');
    if (loaded) setSavedFriends(JSON.parse(loaded));
  }, []);

  // Course Search Logic
  const filteredCourses = COURSES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const fetchWHS = () => {
    if (!newPlayer.cdh) return;
    setLoadingCdh(true);
    // Simulate API call with "Real" looking delay
    setTimeout(() => {
      // Deterministic "Random" handicap based on CDH number
      const hash = newPlayer.cdh.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockHcp = ((hash % 300) / 10).toFixed(1); // 0.0 to 30.0
      setNewPlayer(prev => ({ ...prev, hcpIndex: mockHcp }));
      setLoadingCdh(false);
    }, 1500);
  };

  const addPlayer = () => {
    if (!newPlayer.name) return;
    
    // Auto-Calculate Course Handicap using 2024 Formula
    const hcpIndex = parseFloat(newPlayer.hcpIndex) || 0;
    const courseHcp = calculateCourseHandicap(hcpIndex, game.slope, game.cr, game.par);

    const player = {
      id: Date.now().toString(),
      name: newPlayer.name,
      handicapIndex: hcpIndex,
      handicap: courseHcp, // Playing/Course Handicap
      scores: Array(18).fill(null),
      avatarUrl: newPlayer.avatar,
      cdh: newPlayer.cdh,
      team: 'A' 
    };

    updateGame({ players: [...game.players, player] });

    // Save Friend Logic
    if (saveToFriends) {
      const newFriend = { name: newPlayer.name, cdh: newPlayer.cdh, hcpIndex: newPlayer.hcpIndex, avatar: newPlayer.avatar };
      // Check for dupe by CDH or Name
      const exists = savedFriends.find(f => (f.cdh && f.cdh === newFriend.cdh) || f.name === newFriend.name);
      if (!exists) {
        const updatedFriends = [...savedFriends, newFriend];
        setSavedFriends(updatedFriends);
        localStorage.setItem('golf_friends', JSON.stringify(updatedFriends));
      }
    }

    setNewPlayer({ name: '', hcpIndex: '', cdh: '', avatar: '' });
    setShowPhotoInput(false);
  };

  const addFriend = (friend) => {
    const courseHcp = calculateCourseHandicap(parseFloat(friend.hcpIndex) || 0, game.slope, game.cr, game.par);
    const player = {
      id: Date.now().toString() + Math.random(),
      name: friend.name,
      handicapIndex: parseFloat(friend.hcpIndex) || 0,
      handicap: courseHcp,
      scores: Array(18).fill(null),
      avatarUrl: friend.avatar,
      cdh: friend.cdh,
      team: 'A'
    };
    updateGame({ players: [...game.players, player] });
  };

  const handleCourseChange = (course) => {
    // Recalculate handicaps for ALL existing players when course changes
    const updatedPlayers = game.players.map(p => ({
      ...p,
      handicap: calculateCourseHandicap(p.handicapIndex, course.slope, course.cr, course.par)
    }));
    
    updateGame({
      courseName: course.name,
      par: course.par,
      slope: course.slope,
      cr: course.cr,
      holes: course.holes,
      players: updatedPlayers
    });
    setSearchQuery(''); // clear search
  };

  return (
    <div className="space-y-6">
      
      {/* Invite Banner */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-500 p-2 rounded-full text-white"><MessageCircle size={20} /></div>
          <div>
            <h3 className="font-bold text-green-900 text-sm">Invite Friends</h3>
            <p className="text-xs text-green-700">Share ID: {gameId}</p>
          </div>
        </div>
        <a href={`whatsapp://send?text=Join my golf game! Click here: https://ogc-golf.web.app/?game=${gameId} (Game ID: ${gameId})`} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg">WhatsApp</a>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Game Setup</h2>
        {game.players.length > 0 && <button onClick={onStart} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-emerald-700 flex items-center gap-2">Play <ChevronRight size={16}/></button>}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex border-b">
          {['players', 'course', 'details'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-sm font-bold capitalize ${activeTab === tab ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500' : 'text-slate-500'}`}>{tab}</button>
          ))}
        </div>

        <div className="p-6">
          {/* PLAYERS TAB */}
          {activeTab === 'players' && (
            <div className="space-y-6">
              
              {/* Add New Player Form */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-full border border-slate-300 flex-shrink-0 overflow-hidden bg-slate-200 cursor-pointer" onClick={() => setShowPhotoInput(!showPhotoInput)}>
                      <img src={getAvatarUrl(newPlayer.name, newPlayer.avatar)} className="w-full h-full object-cover" alt="Preview"/>
                    </div>
                    <input type="text" placeholder="Player Name" value={newPlayer.name} onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })} className="border rounded px-3 py-2 flex-1" />
                  </div>
                  
                  {showPhotoInput && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-top-2">
                      <LinkIcon size={14} className="text-slate-400"/>
                      <input type="text" placeholder="Paste image URL (optional)" value={newPlayer.avatar} onChange={e => setNewPlayer({ ...newPlayer, avatar: e.target.value })} className="text-xs border rounded px-3 py-2 w-full text-slate-600"/>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type="text" placeholder="CDH Number" value={newPlayer.cdh} onChange={e => setNewPlayer({ ...newPlayer, cdh: e.target.value })} className="w-full border rounded px-3 py-2 pr-8" />
                      <button onClick={fetchWHS} className="absolute right-2 top-2 text-slate-400 hover:text-blue-600" disabled={!newPlayer.cdh}>
                        {loadingCdh ? <RefreshCw className="animate-spin h-4 w-4"/> : <Search className="h-4 w-4"/>}
                      </button>
                    </div>
                    <input type="number" placeholder="HI" value={newPlayer.hcpIndex} onChange={e => setNewPlayer({ ...newPlayer, hcpIndex: e.target.value })} className="w-20 border rounded px-3 py-2" title="Handicap Index"/>
                    <button onClick={addPlayer} className="bg-emerald-600 text-white px-4 rounded hover:bg-emerald-700" disabled={!newPlayer.name}><Plus/></button>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                     <input type="checkbox" id="saveFriend" checked={saveToFriends} onChange={e => setSaveToFriends(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500"/>
                     <label htmlFor="saveFriend" className="text-xs text-slate-500">Save to my friends list</label>
                  </div>
                </div>
              </div>

              {/* Saved Friends List */}
              {savedFriends.length > 0 && (
                <div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Saved Friends</h3>
                   <div className="flex gap-2 overflow-x-auto pb-2">
                     {savedFriends.map((friend, i) => (
                       <button key={i} onClick={() => addFriend(friend)} className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-1 pr-3 py-1 hover:border-emerald-500 transition-colors whitespace-nowrap">
                         <img src={getAvatarUrl(friend.name, friend.avatar)} className="w-6 h-6 rounded-full" alt="av"/>
                         <span className="text-xs font-medium">{friend.name}</span>
                       </button>
                     ))}
                   </div>
                </div>
              )}

              {/* Player List */}
              <div className="space-y-2">
                {game.players.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-white border p-3 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img src={getAvatarUrl(p.name, p.avatarUrl)} className="h-10 w-10 rounded-full bg-slate-100 object-cover border border-slate-100" alt={p.name}/>
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {p.name}
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded" title="Course Handicap">CH: {p.handicap}</span>
                        </div>
                        <div className="text-xs text-slate-400">HI: {p.handicapIndex} • {p.cdh ? `CDH: ${p.cdh}` : 'No CDH'}</div>
                        {game.format === GAME_FORMATS.MATCH_PAIRS && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Team</span>
                            <div className="flex bg-slate-100 rounded p-0.5">
                              {['A', 'B'].map(t => (
                                <button key={t} onClick={() => updateGame({ players: game.players.map(pl => pl.id === p.id ? { ...pl, team: t } : pl) })} className={`text-[10px] px-2 rounded ${p.team === t ? 'bg-emerald-600 text-white shadow' : 'text-slate-500'}`}>{t}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => updateGame({ players: game.players.filter(pl => pl.id !== p.id) })} className="text-slate-300 hover:text-red-500"><Plus className="rotate-45"/></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* COURSE TAB */}
          {activeTab === 'course' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl mb-4">
                 <h3 className="text-sm font-bold text-slate-700 mb-2">Selected: {game.courseName}</h3>
                 <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white p-2 rounded shadow-sm">
                       <div className="text-xs text-slate-500 uppercase">Par</div>
                       <div className="font-bold text-emerald-600">{game.par}</div>
                    </div>
                    <div className="bg-white p-2 rounded shadow-sm">
                       <div className="text-xs text-slate-500 uppercase">Slope</div>
                       <div className="font-bold text-emerald-600">{game.slope}</div>
                    </div>
                    <div className="bg-white p-2 rounded shadow-sm">
                       <div className="text-xs text-slate-500 uppercase">Rating</div>
                       <div className="font-bold text-emerald-600">{game.cr}</div>
                    </div>
                 </div>
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Search Course Database</label>
                 <div className="relative mt-1">
                   <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search (e.g. Olton)" className="w-full border rounded-lg pl-9 pr-3 py-2" />
                   <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3"/>
                 </div>
                 {searchQuery && (
                   <div className="mt-2 border rounded-lg overflow-hidden">
                     {filteredCourses.length === 0 && <div className="p-3 text-sm text-slate-400">No courses found.</div>}
                     {filteredCourses.map(c => (
                       <button key={c.id} onClick={() => handleCourseChange(c)} className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-0 flex justify-between items-center">
                         <div>
                            <div className="font-bold text-sm">{c.name}</div>
                            <div className="text-xs text-slate-500">Par {c.par} • Slope {c.slope} • CR {c.cr}</div>
                         </div>
                         {game.courseName === c.name && <div className="text-emerald-600 font-bold text-xs">Selected</div>}
                       </button>
                     ))}
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* DETAILS TAB */}
          {activeTab === 'details' && (
             <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase">Group Name</label><input type="text" value={game.gameName} onChange={e => updateGame({ gameName: e.target.value })} className="w-full mt-1 border rounded-lg p-3" /></div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Format</label>
                   <select value={game.format} onChange={e => updateGame({ format: e.target.value })} className="w-full mt-1 border rounded-lg p-3 bg-white">
                      {Object.values(GAME_FORMATS).map(f => <option key={f} value={f}>{f}</option>)}
                   </select>
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- PLAY VIEW (Scorecard Logic) ---

function PlayView({ game, updateGame }) {
  const [activeHole, setActiveHole] = useState(0);
  const [viewMode, setViewMode] = useState('input'); 

  const calculateStableford = (gross, par, strokes) => {
    if (!gross) return 0;
    const net = gross - strokes;
    return Math.max(0, par - net + 2);
  };

  const updateScore = (pIdx, score) => {
    const newPlayers = [...game.players];
    newPlayers[pIdx].scores = [...newPlayers[pIdx].scores];
    newPlayers[pIdx].scores[activeHole] = score === '' ? null : parseInt(score);
    updateGame({ players: newPlayers });
  };

  const calculateMatchStatus = useMemo(() => {
    if (!game.format.includes('Match') || game.players.length < 2) return null;
    let teamAScore = 0; 
    const isPairs = game.format === GAME_FORMATS.MATCH_PAIRS;
    const teamA = game.players.filter(p => isPairs ? p.team === 'A' : p.id === game.players[0].id);
    const teamB = game.players.filter(p => isPairs ? p.team === 'B' : p.id === game.players[1].id);
    
    if(!teamA.length || !teamB.length) return null;

    const holeResults = game.holes.map((hole, idx) => {
      const getBestNet = (team) => {
        const scores = team.map(p => getNetScore(p.scores[idx], p.handicap, hole.si)).filter(s => s !== null);
        return scores.length > 0 ? Math.min(...scores) : null;
      };
      const bestA = getBestNet(teamA);
      const bestB = getBestNet(teamB);
      if (bestA === null || bestB === null) return null;
      if (bestA < bestB) { teamAScore++; return 'A'; }
      if (bestB < bestA) { teamAScore--; return 'B'; }
      return '-';
    });

    let status = "All Square";
    if (teamAScore > 0) status = `${teamAScore} UP (Team A)`;
    if (teamAScore < 0) status = `${Math.abs(teamAScore)} UP (Team B)`;
    
    return { status, holeResults, teamA, teamB };
  }, [game]);

  const renderInput = () => (
    <div className="animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-2xl shadow border p-4 mb-4 sticky top-20 z-10">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setActiveHole(h => Math.max(0, h-1))} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ChevronLeft/></button>
          <div className="text-center">
            <h3 className="text-2xl font-bold">Hole {activeHole + 1}</h3>
            <div className="text-xs font-bold text-slate-500 uppercase">Par {game.holes[activeHole].par} • SI {game.holes[activeHole].si}</div>
          </div>
          <button onClick={() => setActiveHole(h => Math.min(17, h+1))} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ChevronRight/></button>
        </div>

        {calculateMatchStatus && (
          <div className="bg-blue-50 text-blue-800 p-2 rounded-lg text-center text-sm font-bold mb-4 border border-blue-100 flex items-center justify-center gap-2">
            <Swords size={16}/> {calculateMatchStatus.holeResults[activeHole] ? (calculateMatchStatus.holeResults[activeHole] === 'A' ? 'Team A Won Hole' : calculateMatchStatus.holeResults[activeHole] === 'B' ? 'Team B Won Hole' : 'Hole Halved') : calculateMatchStatus.status}
          </div>
        )}

        <div className="space-y-3">
          {game.players.map((p, idx) => {
            const strokes = getStrokesReceived(p.handicap, game.holes[activeHole].si);
            const net = getNetScore(p.scores[activeHole], p.handicap, game.holes[activeHole].si);
            return (
              <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <img src={getAvatarUrl(p.name, p.avatarUrl)} className="h-10 w-10 rounded-full object-cover" alt="p"/>
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {p.name}
                      {game.format === GAME_FORMATS.MATCH_PAIRS && <span className={`text-[10px] px-1.5 rounded text-white ${p.team === 'A' ? 'bg-blue-500' : 'bg-red-500'}`}>{p.team}</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      Net: {net !== null ? net : '-'} • Gets {strokes} shot{strokes!==1 && 's'}
                    </div>
                  </div>
                </div>
                <input 
                  type="tel" 
                  value={p.scores[activeHole] || ''} 
                  onChange={e => updateScore(idx, e.target.value)} 
                  className={`w-16 h-12 text-center text-xl font-bold rounded-lg border-2 outline-none focus:border-emerald-500 ${p.scores[activeHole] && p.scores[activeHole] < game.holes[activeHole].par ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-white border-slate-200'}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in">
      <div className="flex bg-slate-200 p-1 rounded-xl mb-4">
        {[
          { id: 'input', icon: Edit2, label: 'Score' },
          { id: 'leaders', icon: Activity, label: 'Status' },
          { id: 'card', icon: ClipboardList, label: 'Card' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${viewMode === tab.id ? 'bg-white text-emerald-700 shadow' : 'text-slate-500'}`}>
            <tab.icon size={14}/> {tab.label}
          </button>
        ))}
      </div>
      {viewMode === 'input' && renderInput()}
      {viewMode === 'leaders' && <LeaderboardView game={game} calculateStableford={calculateStableford} calculateMatchStatus={calculateMatchStatus}/>}
      {viewMode === 'card' && <ScorecardView game={game} />}
    </div>
  );
}

function LeaderboardView({ game, calculateStableford, calculateMatchStatus }) {
  if (game.format.includes('Match')) {
     if(!calculateMatchStatus) return <div>Invalid Match Config</div>;
     return (
        <div className="space-y-6 text-center pt-8">
           <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-lg">
             <div className="text-slate-400 text-sm uppercase tracking-widest font-bold">Current Status</div>
             <div className="text-4xl font-black text-emerald-400 mt-2">{calculateMatchStatus.status}</div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border-t-4 border-blue-500 shadow-sm"><div className="font-bold">Team A</div><div className="text-sm text-slate-500">{calculateMatchStatus.teamA.map(p=>p.name).join(' & ')}</div></div>
              <div className="bg-white p-4 rounded-xl border-t-4 border-red-500 shadow-sm"><div className="font-bold">Team B</div><div className="text-sm text-slate-500">{calculateMatchStatus.teamB.map(p=>p.name).join(' & ')}</div></div>
           </div>
        </div>
     );
  }

  const sortedPlayers = [...game.players].sort((a, b) => {
     const scoreA = a.scores.reduce((acc, s, i) => acc + (s ? calculateStableford(s, game.holes[i].par, getStrokesReceived(a.handicap, game.holes[i].si)) : 0), 0);
     const scoreB = b.scores.reduce((acc, s, i) => acc + (s ? calculateStableford(s, game.holes[i].par, getStrokesReceived(b.handicap, game.holes[i].si)) : 0), 0);
     return scoreB - scoreA;
  });

  return (
    <div className="space-y-2">
      {sortedPlayers.map((p, i) => {
        const total = p.scores.reduce((acc, s, idx) => acc + (s ? calculateStableford(s, game.holes[idx].par, getStrokesReceived(p.handicap, game.holes[idx].si)) : 0), 0);
        return (
          <div key={p.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
             <div className="flex items-center gap-4">
                <div className="font-bold text-slate-400 w-6">#{i+1}</div>
                <img src={getAvatarUrl(p.name, p.avatarUrl)} className="h-10 w-10 rounded-full object-cover" alt="p"/>
                <div className="font-bold">{p.name}</div>
             </div>
             <div className="text-2xl font-bold text-emerald-600">{total} <span className="text-xs text-slate-400 font-normal">pts</span></div>
          </div>
        );
      })}
    </div>
  );
}

function ScorecardView({ game }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow border">
      <table className="w-full text-center text-xs">
        <thead className="bg-emerald-900 text-white">
          <tr><th className="p-2 text-left sticky left-0 bg-emerald-900 z-10">Player</th>{game.holes.map(h => <th key={h.number} className="min-w-[30px] border-l border-emerald-800">{h.number}</th>)}</tr>
        </thead>
        <tbody>
          {game.players.map(p => (
            <tr key={p.id} className="border-b">
              <td className="p-2 text-left font-bold sticky left-0 bg-white z-10 border-r flex items-center gap-2 min-w-[120px]"><img src={getAvatarUrl(p.name, p.avatarUrl)} className="h-6 w-6 rounded-full object-cover" alt="p"/>{p.name}</td>
              {p.scores.map((s, i) => <td key={i} className="border-l">{s || '-'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
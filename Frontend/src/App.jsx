import { useState, useRef, useEffect } from 'react'

const PASTEL_COLORS = ["#fecaca", "#bfdbfe", "#bbf7d0", "#e9d5ff", "#fde68a", "#a5f3fc", "#fbcfe8", "#99f6e4"]
const DRAW_COLORS = ["#000000", "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#ffffff"]

const playTone = (freq, type = 'sine', duration = 0.1, vol = 0.05) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
    gain.gain.setValueAtTime(vol, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + duration)
  } catch (e) { console.log("Audio not supported") }
}

function App() {
  const [view, setView] = useState('home') 
  const viewRef = useRef(view)
  
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isHost, setIsHost] = useState(false)
  
  // Shared Local Players (T&D & Charades)
  const [localPlayers, setLocalPlayers] = useState([]) 
  const [activeDeck, setActiveDeck] = useState(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  
  // Truth or Dare State
  const [tdMode, setTdMode] = useState('icebreaker')
  const [bottleRotation, setBottleRotation] = useState(0)
  const [tdState, setTdState] = useState('idle') 
  const [tdTurnResult, setTdTurnResult] = useState(null)
  const [injectedCount, setInjectedCount] = useState(0)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customType, setCustomType] = useState('truth')
  const [tdTimeLeft, setTdTimeLeft] = useState(null)

  // Charades State
  const [chMode, setChMode] = useState('charades_movies')
  const [chFormat, setChFormat] = useState('freeplay') 
  const [chTimeLimit, setChTimeLimit] = useState(120)
  const [chTotalRounds, setChTotalRounds] = useState(1)
  const [chCurrentRound, setChCurrentRound] = useState(1)
  const [teamP1, setTeamP1] = useState('')
  const [teamP2, setTeamP2] = useState('')
  const [chCurrentPlayerIdx, setChCurrentPlayerIdx] = useState(0)
  const [chGameState, setChGameState] = useState('pre_turn') 
  const [chTimeLeft, setChTimeLeft] = useState(0)
  const [chCurrentWord, setChCurrentWord] = useState('')
  const [chRemainingWords, setChRemainingWords] = useState([])
  const [chRoundScore, setChRoundScore] = useState(0)
  const [chBgColor, setChBgColor] = useState('bg-slate-900') 
  
  // Imposter Multiplayer State
  const [impPlayers, setImpPlayers] = useState({})
  const [impPhase, setImpPhase] = useState('lobby')
  const [impTurnOrder, setImpTurnOrder] = useState([])
  const [impCurrentTurn, setImpCurrentTurn] = useState(0)
  const [impMyRole, setImpMyRole] = useState(null)
  const [impMyWord, setImpMyWord] = useState(null)
  const [impIsAlive, setImpIsAlive] = useState(true)
  const [impResolution, setImpResolution] = useState(null)

  // Scribble Multiplayer State
  const [scPhase, setScPhase] = useState('lobby')
  const [scPlayers, setScPlayers] = useState({})
  const [scCurrentRound, setScCurrentRound] = useState(1)
  const [scTotalRounds, setScTotalRounds] = useState(2)
  const [scTimeLimit, setScTimeLimit] = useState(60)
  const [scCurrentDrawerId, setScCurrentDrawerId] = useState(null)
  const [scDisplayWord, setScDisplayWord] = useState('')
  const [scWordOptions, setScWordOptions] = useState([])
  const [scCorrectGuessers, setScCorrectGuessers] = useState([])
  const [scScores, setScScores] = useState({})
  const [scChat, setScChat] = useState([])
  const [scGuessInput, setScGuessInput] = useState('')
  const [scTimeLeft, setScTimeLeft] = useState(60)
  const [scBrushColor, setScBrushColor] = useState('#000000')
  const [scBrushSize, setScBrushSize] = useState(4)

  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const chatScrollRef = useRef(null)
  
  const clientId = useRef(localStorage.getItem('ph_clientId') || Math.random().toString(36).substring(2, 10))
  const socketRef = useRef(null)

  useEffect(() => { viewRef.current = view }, [view])

  useEffect(() => {
    localStorage.setItem('ph_clientId', clientId.current)
    const style = document.createElement('style')
    style.innerHTML = `@keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }`
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // Auto-scroll chat in Scribble
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [scChat])

  // Scribble Active Drawing Timer & Hint Triggers
  useEffect(() => {
    if (scPhase === 'drawing' && scTimeLeft > 0) {
      const id = setTimeout(() => {
        setScTimeLeft(t => t - 1)
        if (scTimeLeft === Math.floor(scTimeLimit * 0.6) || scTimeLeft === Math.floor(scTimeLimit * 0.3)) {
          if (clientId.current === scCurrentDrawerId) {
            socketRef.current?.send(JSON.stringify({ action: 'sc_reveal_hint' }))
          }
        }
        if (scTimeLeft <= 10) playTone(800, 'square', 0.04, 0.05)
      }, 1000)
      return () => clearTimeout(id)
    } else if (scPhase === 'drawing' && scTimeLeft === 0) {
      if (clientId.current === scCurrentDrawerId) {
        socketRef.current?.send(JSON.stringify({ action: 'sc_turn_timeout' }))
      }
    }
  }, [scPhase, scTimeLeft, scCurrentDrawerId])

  // Timers (T&D and Charades)
  useEffect(() => {
    if (tdTimeLeft !== null && tdTimeLeft > 0) {
      const id = setTimeout(() => {
        setTdTimeLeft(t => t - 1)
        if (tdTimeLeft <= 5) playTone(900, 'square', 0.05, 0.1) 
      }, 1000)
      return () => clearTimeout(id)
    } else if (tdTimeLeft === 0) {
      playTone(200, 'sawtooth', 0.6, 0.2) 
    }
  }, [tdTimeLeft])

  useEffect(() => {
    if (chGameState === 'active' && chTimeLeft > 0) {
      const id = setTimeout(() => {
        setChTimeLeft(t => t - 1)
        if (chTimeLeft <= 10) playTone(900, 'square', 0.05, 0.1) 
      }, 1000)
      return () => clearTimeout(id)
    } else if (chGameState === 'active' && chTimeLeft === 0) {
      endCharadesTurn()
    }
  }, [chTimeLeft, chGameState])

  const connectWebSocket = (code) => {
    const ws = new WebSocket(`ws://${window.location.hostname}:8000/ws/${code}/${clientId.current}`)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'room_state') {
        setIsHost(data.is_host)
        if (data.is_host && !data.game_selected) setView('select_game')
        if (!data.is_host && data.game_selected === 'imposter') setView('imp_join')
        if (!data.is_host && data.game_selected === 'scribble') setView('sc_join')
      }
      
      if (data.type === 'game_selected') {
        if (data.game_id === 'truth_or_dare') setView('td_setup')
        if (data.game_id === 'charades') setView('ch_setup')
        if (data.game_id === 'imposter') setView('imp_join')
        if (data.game_id === 'scribble') setView('sc_join')
      }
      
      if (data.type === 'deck_result') {
        setActiveDeck(data.deck)
        playTone(600, 'sine', 0.15)
        if (viewRef.current === 'td_setup') setView('td_inject')
        if (viewRef.current === 'ch_setup') {
            setChRemainingWords([...data.deck].sort(() => Math.random() - 0.5)) 
            setView('ch_game')
            setChGameState('pre_turn')
            setChCurrentPlayerIdx(0)
            setChCurrentRound(1)
        }
      }
      
      if (data.type === 'imposter_sync') {
         setImpPhase(data.phase)
         setImpPlayers(data.players)
         setImpTurnOrder(data.turn_order)
         setImpCurrentTurn(data.current_turn)
         setImpMyRole(data.my_role)
         setImpMyWord(data.my_word)
         setImpIsAlive(data.is_alive)
         setImpResolution(data.resolution)
         if (viewRef.current === 'imp_join' && data.players[clientId.current]?.name) setView('imp_main')
      }

      if (data.type === 'scribble_sync') {
        setScPhase(data.phase)
        setScPlayers(data.players)
        setScCurrentRound(data.current_round)
        setScTotalRounds(data.total_rounds)
        setScTimeLimit(data.time_limit)
        setScCurrentDrawerId(data.current_drawer_id)
        setScDisplayWord(data.display_word)
        setScWordOptions(data.word_options)
        setScCorrectGuessers(data.correct_guessers)
        setScScores(data.scores)
        setScChat(data.chat)
        
        if (data.phase === 'drawing' && viewRef.current !== 'sc_drawing_active') {
          setScTimeLeft(data.time_limit)
          setView('sc_main')
        }
        if (viewRef.current === 'sc_join' && data.players[clientId.current]?.name) setView('sc_main')
      }

      if (data.type === 'sc_draw_stroke') {
        drawReceivedStroke(data.data)
      }

      if (data.type === 'sc_clear_canvas') {
        clearCanvasLocal()
      }
    }
    ws.onclose = (e) => { if (e.code === 4003) { setErrorMessage("Room is full."); setView('join') } }
    socketRef.current = ws
  }

  const handleMakeRoom = async () => {
    try {
      playTone(400, 'sine', 0.05) 
      const response = await fetch(`http://${window.location.hostname}:8000/create-room`, { method: 'POST' })
      const data = await response.json()
      setRoomCode(data.room_code)
      connectWebSocket(data.room_code)
    } catch (error) { console.error(error) }
  }

  const handleJoinRoom = () => {
    if (joinCode.length === 4) {
      playTone(400, 'sine', 0.05)
      setErrorMessage('')
      setRoomCode(joinCode)
      connectWebSocket(joinCode)
    }
  }

  const quitGame = () => window.location.reload()

  // --- TRUTH OR DARE LOGIC ---
  const addTdPlayer = (e) => {
    e.preventDefault()
    const name = newPlayerName.trim()
    if (!name || localPlayers.length >= 20) return
    
    if (localPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        playTone(200, 'square', 0.1)
        setErrorMessage(`${name} is already playing!`)
        setTimeout(() => setErrorMessage(''), 2500)
        return
    }

    setLocalPlayers([...localPlayers, { id: Date.now(), name, score: 0, color: PASTEL_COLORS[localPlayers.length % PASTEL_COLORS.length], strikes: 0, eliminated: false }])
    setNewPlayerName('')
    playTone(800, 'sine', 0.05)
  }

  const requestTdDeck = () => localPlayers.length >= 2 && socketRef.current?.send(JSON.stringify({ action: 'fetch_deck', mode: tdMode }))
  
  const injectPrompt = (e) => {
    e.preventDefault()
    if (!customPrompt.trim() || injectedCount >= localPlayers.length) return
    
    setActiveDeck(prevDeck => {
      const safeDeck = prevDeck || { truth: [], dare: [] };
      return {
        ...safeDeck,
        [customType]: [...(safeDeck[customType] || []), customPrompt.trim()]
      }
    });
    
    setCustomPrompt('')
    setInjectedCount(c => c + 1)
    playTone(700, 'sine', 0.1)
  }

  const handleChickenOut = () => {
    playTone(300, 'square', 0.2)
    const updatedPlayers = [...localPlayers]
    const pIndex = updatedPlayers.findIndex(p => p.name === tdTurnResult.victim.name)
    
    updatedPlayers[pIndex].strikes += 1
    if (updatedPlayers[pIndex].strikes >= 3) updatedPlayers[pIndex].eliminated = true
    
    setLocalPlayers(updatedPlayers)
    setTdTimeLeft(null)
    setTdState('idle')
  }

  const spinBottle = () => {
    if (tdState === 'spinning') return
    const active = localPlayers.filter(p => !p.eliminated)
    if (active.length < 2) {
        alert("Not enough players left! Game Over.")
        return quitGame()
    }
    
    playTone(300, 'triangle', 0.1)
    if (navigator.vibrate) navigator.vibrate(30)
    setTdState('spinning')
    setTdTimeLeft(null)
    
    const victim = active[Math.floor(Math.random() * active.length)]
    const targetIdx = localPlayers.findIndex(p => p.name === victim.name)
    
    const isTruth = Math.random() > 0.5
    const type = isTruth ? 'truth' : 'dare'
    const safeDeck = activeDeck || { truth: ["Tell a secret."], dare: ["Do a dance."] }
    const promptList = safeDeck[type] && safeDeck[type].length > 0 ? safeDeck[type] : ["Provide a prompt manually next time!"]
    const randomPrompt = promptList[Math.floor(Math.random() * promptList.length)]
    
    const arc = 360 / localPlayers.length
    const offset = (Math.random() - 0.5) * (arc * 0.8)
    const extraSpins = 360 * (Math.floor(Math.random() * 3) + 7) 
    
    setBottleRotation(bottleRotation + extraSpins + (targetIdx * arc) + offset - (bottleRotation % 360))
    
    let delay = 30
    const tickSound = () => {
      playTone(800, 'sine', 0.01, 0.01)
      delay *= 1.12 
      if (delay < 1200) setTimeout(tickSound, delay)
    }
    tickSound()
    
    setTimeout(() => {
      playTone(800, 'sine', 0.3, 0.1)
      playTone(1200, 'sine', 0.4, 0.1)
      if (navigator.vibrate) navigator.vibrate([50, 30, 50])
      setTdTurnResult({ victim, type: type.toUpperCase(), text: randomPrompt })
      setTdState('result')
    }, 5000)
  }

  // --- CHARADES LOGIC ---
  const addChPlayerFreeplay = (e) => {
    e.preventDefault()
    const name = newPlayerName.trim()
    if (!name || localPlayers.length >= 20) return
    
    if (localPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        playTone(200, 'square', 0.1)
        setErrorMessage(`${name} is already playing!`)
        setTimeout(() => setErrorMessage(''), 2500)
        return
    }

    setLocalPlayers([...localPlayers, { id: Date.now(), name, score: 0, color: PASTEL_COLORS[localPlayers.length % PASTEL_COLORS.length], isTeam: false }])
    setNewPlayerName('')
  }

  const addChTeam = (e) => {
    e.preventDefault()
    const p1 = teamP1.trim()
    const p2 = teamP2.trim()
    if (!p1 || !p2 || p1.toLowerCase() === p2.toLowerCase()) return alert("Enter two different names.")
    
    const teamName = `${p1} & ${p2}`
    if (localPlayers.some(p => p.name.toLowerCase() === teamName.toLowerCase())) {
        playTone(200, 'square', 0.1)
        setErrorMessage(`That team already exists!`)
        setTimeout(() => setErrorMessage(''), 2500)
        return
    }

    setLocalPlayers([...localPlayers, { id: Date.now(), name: teamName, p1, p2, score: 0, color: PASTEL_COLORS[localPlayers.length % PASTEL_COLORS.length], isTeam: true }])
    setTeamP1(''); setTeamP2('')
  }

  const removeLocalPlayer = (id) => setLocalPlayers(localPlayers.filter(p => p.id !== id))

  const requestChDeck = () => {
    if (localPlayers.length >= 2) socketRef.current?.send(JSON.stringify({ action: 'fetch_deck', mode: chMode }))
  }

  const startCharadesTurn = () => {
    setChRoundScore(0)
    setChTimeLeft(chTimeLimit)
    setChBgColor('bg-slate-900')
    nextCharadesWord()
    setChGameState('active')
    playTone(600, 'sine', 0.3)
  }

  const nextCharadesWord = () => {
    if (chRemainingWords.length === 0) {
      const freshDeck = [...activeDeck].sort(() => Math.random() - 0.5)
      setChCurrentWord(freshDeck[0])
      setChRemainingWords(freshDeck.slice(1))
    } else {
      setChCurrentWord(chRemainingWords[0])
      setChRemainingWords(chRemainingWords.slice(1))
    }
  }

  const endCharadesTurn = () => {
    playTone(200, 'sawtooth', 0.5, 0.2)
    const updated = [...localPlayers]
    updated[chCurrentPlayerIdx].score += chRoundScore
    setLocalPlayers(updated)
    setChGameState('post_turn')
  }

  const nextCharadesPlayer = () => {
    const nextIdx = chCurrentPlayerIdx + 1
    if (nextIdx >= localPlayers.length) {
      if (chCurrentRound < chTotalRounds) {
        setChCurrentRound(r => r + 1)
        setChCurrentPlayerIdx(0)
        setChGameState('pre_turn')
      } else {
        const sorted = [...localPlayers].sort((a, b) => b.score - a.score)
        setLocalPlayers(sorted)
        setChGameState('podium')
      }
    } else {
      setChCurrentPlayerIdx(nextIdx)
      setChGameState('pre_turn')
    }
  }

  const touchStartY = useRef(0)
  const handleTouchStart = (e) => {
    if (chGameState !== 'active') return
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e) => {
    if (chGameState !== 'active') return
    const touchEndY = e.changedTouches[0].clientY
    const deltaY = touchEndY - touchStartY.current

    if (deltaY > 60) {
      setChRoundScore(s => s + 1)
      setChBgColor('bg-emerald-500')
      playTone(1000, 'sine', 0.1)
      setTimeout(() => setChBgColor('bg-slate-900'), 300)
      nextCharadesWord()
    } else if (deltaY < -60) {
      setChRoundScore(s => s - 0.5)
      setChBgColor('bg-red-500')
      playTone(300, 'square', 0.1)
      setTimeout(() => setChBgColor('bg-slate-900'), 300)
      nextCharadesWord()
    }
  }

  // --- IMPOSTER MULTIPLAYER LOGIC ---
  const joinImposter = (e) => {
    e.preventDefault()
    const cleanName = newPlayerName.trim()
    if (!cleanName) return
    
    const nameExists = Object.values(impPlayers).some(p => p.name && p.name.toLowerCase() === cleanName.toLowerCase())
    if (nameExists) {
        playTone(200, 'square', 0.1)
        setErrorMessage(`${cleanName} is already taken!`)
        setTimeout(() => setErrorMessage(''), 2500)
        return
    }

    socketRef.current?.send(JSON.stringify({ action: 'imp_join', name: cleanName }))
    playTone(600, 'sine', 0.1)
  }

  const startImposterOrdering = () => {
    if (Object.values(impPlayers).length < 3) return alert("Need at least 3 players!")
    setImpTurnOrder([])
    socketRef.current?.send(JSON.stringify({ action: 'imp_set_order', order: [] })) 
    setView('imp_ordering')
  }
  
  const handleImpOrderTap = (pid) => {
    playTone(800, 'sine', 0.05)
    if (!impTurnOrder.includes(pid)) setImpTurnOrder([...impTurnOrder, pid])
    else setImpTurnOrder(impTurnOrder.filter(id => id !== pid))
  }
  
  const submitImpOrder = () => {
    if (impTurnOrder.length !== Object.keys(impPlayers).length) return alert("Select all players in order!")
    socketRef.current?.send(JSON.stringify({ action: 'imp_set_order', order: impTurnOrder }))
    setView('imp_main')
    playTone(600, 'sine', 0.2)
  }

  const sendImpReady = () => {
    playTone(700, 'sine', 0.1)
    socketRef.current?.send(JSON.stringify({ action: 'imp_ready' }))
  }

  const submitHint = () => {
    playTone(500, 'triangle', 0.1)
    socketRef.current?.send(JSON.stringify({ action: 'imp_hint_given' }))
  }
  
  const submitVote = (targetId) => {
    playTone(400, 'square', 0.1)
    socketRef.current?.send(JSON.stringify({ action: 'imp_vote', target: targetId }))
  }

  // --- SCRIBBLE MULTIPLAYER LOGIC ---
  const joinScribble = (e) => {
    e.preventDefault()
    const cleanName = newPlayerName.trim()
    if (!cleanName) return
    
    const nameExists = Object.values(scPlayers).some(p => p.name && p.name.toLowerCase() === cleanName.toLowerCase())
    if (nameExists) {
      playTone(200, 'square', 0.1)
      setErrorMessage(`${cleanName} is already taken!`)
      setTimeout(() => setErrorMessage(''), 2500)
      return
    }

    socketRef.current?.send(JSON.stringify({ action: 'sc_join', name: cleanName }))
    playTone(600, 'sine', 0.1)
  }

  const startScribbleGame = () => {
    if (Object.values(scPlayers).length < 2) return alert("Need at least 2 players to draw & guess!")
    socketRef.current?.send(JSON.stringify({ action: 'sc_start_game' }))
  }

  const selectScribbleWord = (word) => {
    playTone(800, 'sine', 0.1)
    socketRef.current?.send(JSON.stringify({ action: 'sc_select_word', word }))
  }

  const sendScribbleGuess = (e) => {
    e.preventDefault()
    if (!scGuessInput.trim()) return
    socketRef.current?.send(JSON.stringify({ action: 'sc_guess', text: scGuessInput.trim(), time_left: scTimeLeft }))
    setScGuessInput('')
  }

  // Normalized Canvas Drawing (Works on any mobile screen size)
  const getNormalizedPos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    }
  }

  const startDrawing = (e) => {
    if (clientId.current !== scCurrentDrawerId || scPhase !== 'drawing') return
    isDrawing.current = true
    const pos = getNormalizedPos(e)
    lastPos.current = pos
  }

  const drawMove = (e) => {
    if (!isDrawing.current || clientId.current !== scCurrentDrawerId || scPhase !== 'drawing') return
    const pos = getNormalizedPos(e)
    const strokeData = {
      x0: lastPos.current.x,
      y0: lastPos.current.y,
      x1: pos.x,
      y1: pos.y,
      color: scBrushColor,
      size: scBrushSize
    }
    drawReceivedStroke(strokeData)
    socketRef.current?.send(JSON.stringify({ action: 'sc_stroke', data: strokeData }))
    lastPos.current = pos
  }

  const stopDrawing = () => {
    isDrawing.current = false
  }

  const drawReceivedStroke = (data) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height

    ctx.strokeStyle = data.color
    ctx.lineWidth = data.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(data.x0 * w, data.y0 * h)
    ctx.lineTo(data.x1 * w, data.y1 * h)
    ctx.stroke()
  }

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const triggerClearCanvas = () => {
    if (clientId.current !== scCurrentDrawerId) return
    clearCanvasLocal()
    socketRef.current?.send(JSON.stringify({ action: 'sc_clear' }))
  }

  const isCrowded = localPlayers.length > 10

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center font-sans select-none overflow-x-hidden tracking-tight">
      
      {view !== 'home' && view !== 'join' && view !== 'select_game' && view !== 'imp_join' && view !== 'sc_join' && (
        <div className="absolute top-4 right-4 z-50">
           <button onClick={quitGame} className="bg-white border border-slate-200 text-slate-500 font-bold px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all text-sm">Quit</button>
        </div>
      )}

      <div className="z-10 w-full max-w-md flex-1 flex flex-col items-center justify-center p-4 transition-all duration-300 relative h-full">

        {/* ========================================= */}
        {/*               HUB MENUS                   */}
        {/* ========================================= */}
        
        {view === 'home' && (
          <div className="text-center w-full space-y-12 animate-fade-in-up">
            <div>
              <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter mb-2">Party Hub</h1>
              <p className="text-slate-500 font-medium">Local & True Multiplayer Games</p>
            </div>
            <div className="flex flex-col gap-4 w-full px-4">
              <button onClick={handleMakeRoom} className="w-full bg-slate-900 active:scale-[0.98] transition-all text-white font-semibold py-4 rounded-2xl shadow-sm">Host a Game</button>
              <button onClick={() => setView('join')} className="w-full bg-white active:scale-[0.98] transition-all text-slate-700 font-semibold py-4 rounded-2xl shadow-sm border border-slate-200">Join Lobby</button>
            </div>
          </div>
        )}

        {view === 'join' && (
          <div className="text-center w-full space-y-6 animate-fade-in-up px-4">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8">Enter Code</h2>
            <input type="text" maxLength="4" value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))} className="w-full text-center text-6xl font-mono font-bold tracking-widest bg-white border border-slate-200 rounded-3xl py-8 focus:outline-none focus:border-slate-400 text-slate-800 shadow-sm uppercase" placeholder="0000" autoFocus />
            {errorMessage && <p className="text-red-500 font-medium">{errorMessage}</p>}
            <button onClick={handleJoinRoom} disabled={joinCode.length !== 4} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-4 rounded-2xl mt-6">Enter</button>
            <button onClick={() => { setView('home'); setJoinCode(''); setErrorMessage(''); }} className="text-slate-500 font-medium mt-4">Cancel</button>
          </div>
        )}

        {view === 'select_game' && (
          <div className="w-full space-y-6 animate-fade-in-up px-2">
            <div className="text-center bg-white rounded-3xl py-4 border border-slate-100 shadow-sm mb-6">
              <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold">Room Code</p>
              <div className="text-4xl font-mono font-bold text-slate-900">{roomCode}</div>
            </div>
            
            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-4">Choose a Game</h2>
            
            <div className="space-y-3">
              <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'select_game', game_id: 'scribble' }))} className="w-full relative bg-amber-500 text-white p-5 rounded-3xl text-left active:scale-[0.98] transition-all shadow-md">
                <div className="absolute top-4 right-4 bg-amber-600 text-amber-100 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Multi-Device</div>
                <h3 className="text-xl font-black mb-1">Scribble</h3>
                <p className="text-amber-100 text-xs font-medium">Draw live on your phone while everyone else races to guess the word in chat.</p>
              </button>

              <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'select_game', game_id: 'imposter' }))} className="w-full relative bg-slate-900 p-5 rounded-3xl text-left active:scale-[0.98] transition-all shadow-md">
                <div className="absolute top-4 right-4 bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Multi-Device</div>
                <h3 className="text-xl font-bold text-white mb-1">The Imposter</h3>
                <p className="text-slate-400 text-xs">Everyone plays on their own phone. Blend in, give hints, and vote out the liar.</p>
              </button>
              
              <div className="pt-2 pb-1 text-center"><span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Or Single Device</span></div>

              <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'select_game', game_id: 'truth_or_dare' }))} className="w-full relative bg-white border border-slate-200 p-4 rounded-3xl text-left active:scale-[0.98] transition-all shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Truth or Dare</h3>
                <p className="text-slate-500 text-xs">Pass the phone. Classic spin the bottle.</p>
              </button>
              
              <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'select_game', game_id: 'charades' }))} className="w-full relative bg-white border border-slate-200 p-4 rounded-3xl text-left active:scale-[0.98] transition-all shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Dumb Charades</h3>
                <p className="text-slate-500 text-xs">Phone on forehead. Free-play or Teams.</p>
              </button>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/*             SCRIBBLE VIEWS                */}
        {/* ========================================= */}
        
        {view === 'sc_join' && (
          <div className="text-center w-full space-y-6 animate-fade-in-up px-4">
            <div className="inline-block bg-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Scribble</div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Join Lobby</h2>
            <p className="text-slate-500 text-sm mb-8">Enter your nickname to join the drawing room.</p>
            <form onSubmit={joinScribble}>
              <input type="text" maxLength="12" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="w-full text-center text-3xl font-bold bg-white border border-slate-200 rounded-2xl py-6 focus:outline-none focus:border-slate-400 text-slate-800 shadow-sm mb-2" placeholder="Your Name" autoFocus />
              {errorMessage && <p className="text-red-500 font-medium text-sm mb-4">{errorMessage}</p>}
              <button type="submit" disabled={!newPlayerName.trim()} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-4 rounded-2xl shadow-sm mt-4">Join Room</button>
            </form>
          </div>
        )}

        {view === 'sc_main' && (
          <div className="w-full flex flex-col h-full animate-fade-in-up py-1">
            
            {/* LOBBY PHASE */}
            {scPhase === 'lobby' && (
              <div className="text-center flex flex-col h-full">
                <div className="mb-6">
                  <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold mb-1">Room Code</p>
                  <div className="text-5xl font-mono font-black text-slate-900">{roomCode}</div>
                </div>

                {isHost && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-1">Rounds</label>
                        <select value={scTotalRounds} onChange={(e) => socketRef.current?.send(JSON.stringify({ action: 'sc_config', rounds: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 outline-none text-center">
                          <option value={2}>2 Rounds</option>
                          <option value={3}>3 Rounds</option>
                          <option value={4}>4 Rounds</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-1">Draw Time</label>
                        <select value={scTimeLimit} onChange={(e) => socketRef.current?.send(JSON.stringify({ action: 'sc_config', time_limit: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 outline-none text-center">
                          <option value={45}>45s</option>
                          <option value={60}>60s</option>
                          <option value={80}>80s</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 bg-white rounded-3xl border border-slate-100 p-5 shadow-sm text-left overflow-y-auto mb-4">
                  <p className="text-slate-400 text-xs tracking-widest font-black uppercase mb-4">Players ({Object.keys(scPlayers).length})</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(scPlayers).map((p) => (
                      <div key={p.id} className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-800 shadow-sm border border-slate-200">
                        {p.name} {p.id === clientId.current && "(You)"}
                      </div>
                    ))}
                  </div>
                </div>

                {isHost ? (
                  <button onClick={startScribbleGame} disabled={Object.keys(scPlayers).length < 2} className="w-full bg-amber-500 disabled:bg-slate-300 text-white font-black py-5 rounded-2xl shadow-lg active:scale-[0.98]">Start Scribble</button>
                ) : (
                  <div className="w-full bg-slate-200 text-slate-500 font-bold py-5 rounded-2xl">Waiting for Host to start...</div>
                )}
              </div>
            )}

            {/* WORD SELECT PHASE */}
            {scPhase === 'word_select' && (
              <div className="text-center flex flex-col h-full justify-center">
                {clientId.current === scCurrentDrawerId ? (
                  <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                    <p className="text-amber-500 font-black uppercase tracking-widest text-xs mb-2">Your Turn to Draw</p>
                    <h2 className="text-3xl font-black text-slate-900 mb-6">Choose a Word</h2>
                    <div className="space-y-3">
                      {scWordOptions.map((w) => (
                        <button key={w} onClick={() => selectScribbleWord(w)} className="w-full bg-slate-900 text-white text-xl font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all">
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Round {scCurrentRound} of {scTotalRounds}</p>
                    <h2 className="text-2xl font-black text-slate-900 mb-4">{scPlayers[scCurrentDrawerId]?.name} is choosing a word...</h2>
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mt-6"></div>
                  </div>
                )}
              </div>
            )}

            {/* DRAWING / GUESSING PHASE */}
            {scPhase === 'drawing' && (
              <div className="flex flex-col h-full">
                
                {/* Header Bar */}
                <div className="flex justify-between items-center bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm mb-2">
                  <div className="font-mono text-2xl font-black text-slate-900">{scTimeLeft}s</div>
                  <div className="font-mono text-xl font-bold tracking-widest text-slate-800">
                    {clientId.current === scCurrentDrawerId ? `Draw: ${scDisplayWord}` : scDisplayWord}
                  </div>
                  <div className="text-xs font-bold text-slate-400">R {scCurrentRound}/{scTotalRounds}</div>
                </div>

                {/* HTML5 Canvas */}
                <div className="relative w-full aspect-square bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden mb-2 touch-none">
                  <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={400} 
                    className="w-full h-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={drawMove}
                    onMouseUp={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={drawMove}
                    onTouchEnd={stopDrawing}
                  />
                  {clientId.current !== scCurrentDrawerId && (
                    <div className="absolute top-2 right-2 bg-slate-900/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-[10px] font-bold">
                      {scPlayers[scCurrentDrawerId]?.name} drawing
                    </div>
                  )}
                </div>

                {/* Drawer Palette Controls */}
                {clientId.current === scCurrentDrawerId ? (
                  <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-slate-200 shadow-sm mb-2">
                    <div className="flex gap-1 overflow-x-auto">
                      {DRAW_COLORS.map((c) => (
                        <button key={c} onClick={() => setScBrushColor(c)} className={`w-7 h-7 rounded-full border-2 transition-all ${scBrushColor === c ? 'scale-110 border-slate-900' : 'border-slate-200'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex gap-1 items-center ml-2">
                      <button onClick={() => setScBrushSize(3)} className={`px-2 py-1 text-xs font-bold rounded-lg ${scBrushSize === 3 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>S</button>
                      <button onClick={() => setScBrushSize(7)} className={`px-2 py-1 text-xs font-bold rounded-lg ${scBrushSize === 7 ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>M</button>
                      <button onClick={triggerClearCanvas} className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded-lg border border-red-200">Clear</button>
                    </div>
                  </div>
                ) : (
                  /* Guesser Chat Log */
                  <div ref={chatScrollRef} className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 overflow-y-auto mb-2 space-y-1 max-h-[120px]">
                    {scChat.map((msg, idx) => (
                      <div key={idx} className={`text-xs ${msg.is_correct ? 'text-emerald-600 font-bold bg-emerald-50 p-1 rounded-md' : 'text-slate-700'}`}>
                        <span className="font-bold">{msg.sender}:</span> {msg.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Guesser Input Box */}
                {clientId.current !== scCurrentDrawerId && (
                  <form onSubmit={sendScribbleGuess} className="flex gap-2">
                    <input 
                      type="text" 
                      value={scGuessInput} 
                      onChange={(e) => setScGuessInput(e.target.value)} 
                      disabled={scCorrectGuessers.includes(clientId.current)}
                      placeholder={scCorrectGuessers.includes(clientId.current) ? "You guessed it! 🎉" : "Type your guess here..."} 
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none font-bold text-slate-800 shadow-sm disabled:bg-emerald-50 disabled:text-emerald-700" 
                    />
                    <button type="submit" disabled={scCorrectGuessers.includes(clientId.current) || !scGuessInput.trim()} className="bg-slate-900 disabled:bg-slate-300 text-white font-bold px-5 rounded-xl shadow-sm text-sm">Send</button>
                  </form>
                )}
              </div>
            )}

            {/* TURN END SUMMARY */}
            {scPhase === 'turn_end' && (
              <div className="text-center flex flex-col h-full justify-center animate-fade-in-up">
                <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 mb-6">
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-2">The Word Was</p>
                  <h2 className="text-4xl font-black text-amber-500 mb-6 uppercase">{scDisplayWord}</h2>
                  
                  <div className="space-y-2">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Live Leaderboard</p>
                    {Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0)).map((p, idx) => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{idx+1}.</span>
                          <span>{p.name}</span>
                        </div>
                        <span className="text-slate-900">{scScores[p.id] || 0} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {isHost && (
                  <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'sc_next_turn' }))} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-md text-lg active:scale-95 transition-all">Next Turn</button>
                )}
              </div>
            )}

            {/* FINAL PODIUM */}
            {scPhase === 'podium' && (
              <div className="w-full text-center animate-fade-in-up">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Game Over</p>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-8">Results</h2>

                <div className="flex items-end justify-center gap-2 mb-10 h-40">
                  {Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[1] && (
                    <div className="flex flex-col items-center w-1/3">
                      <div className="text-xs font-bold text-slate-700 truncate w-full mb-1">{Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[1].name}</div>
                      <div className="w-full bg-slate-200 h-24 rounded-t-xl flex flex-col items-center justify-center border border-slate-300">
                        <span className="font-black text-slate-500 text-xl">2</span>
                        <span className="text-[10px] font-bold text-slate-600">{scScores[Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[1].id]} pts</span>
                      </div>
                    </div>
                  )}
                  {Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[0] && (
                    <div className="flex flex-col items-center w-1/3 z-10">
                      <div className="text-sm font-black text-amber-500 truncate w-full mb-1">{Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[0].name}</div>
                      <div className="w-full bg-amber-400 h-32 rounded-t-xl flex flex-col items-center justify-center border border-amber-500 shadow-lg">
                        <span className="font-black text-amber-100 text-3xl">1</span>
                        <span className="text-xs font-black text-amber-900">{scScores[Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[0].id]} pts</span>
                      </div>
                    </div>
                  )}
                  {Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[2] && (
                    <div className="flex flex-col items-center w-1/3">
                      <div className="text-xs font-bold text-slate-600 truncate w-full mb-1">{Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[2].name}</div>
                      <div className="w-full bg-amber-700/60 h-16 rounded-t-xl flex flex-col items-center justify-center border border-amber-900/20">
                        <span className="font-black text-amber-900/60 text-lg">3</span>
                        <span className="text-[10px] font-bold text-amber-950">{scScores[Object.values(scPlayers).sort((a,b) => (scScores[b.id]||0) - (scScores[a.id]||0))[2].id]} pts</span>
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'sc_play_again' }))} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-md text-lg active:scale-95 transition-all">Play Again</button>
              </div>
            )}

          </div>
        )}

        {/* ========================================= */}
        {/*           TRUTH OR DARE VIEWS             */}
        {/* ========================================= */}
        
        {view === 'td_setup' && (
          <div className="w-full flex flex-col h-full animate-fade-in-up py-2">
            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-6">Setup Table</h2>
            <div className="grid grid-cols-3 gap-2 mb-6">
                {['family', 'icebreaker', 'lums'].map(mode => (
                  <button key={mode} onClick={() => { setTdMode(mode); playTone(500, 'sine', 0.05) }} className={`py-3 px-1 rounded-xl text-xs font-bold transition-all border ${tdMode === mode ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                    {mode === 'lums' ? 'LUMS Edition' : mode.replace(/^\w/, c => c.toUpperCase())}
                  </button>
                ))}
            </div>
            
            <form onSubmit={addTdPlayer} className="flex flex-col gap-2 mb-4">
              <div className="flex gap-2">
                 <input type="text" maxLength="12" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player name..." className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none font-medium" />
                 <button type="submit" disabled={!newPlayerName.trim()} className="bg-slate-900 disabled:bg-slate-300 text-white font-semibold px-5 rounded-xl">Add</button>
              </div>
              {errorMessage && <p className="text-red-500 font-medium text-sm text-center">{errorMessage}</p>}
            </form>

            <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm overflow-y-auto mb-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-slate-400 text-[10px] tracking-widest font-black uppercase">Players</p>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{localPlayers.length} / 20</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {localPlayers.map(player => (
                  <div key={player.id} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full shadow-sm" style={{ backgroundColor: player.color }}>
                    <span className="font-bold text-sm text-slate-900">{player.name}</span>
                    <button onClick={() => removeLocalPlayer(player.id)} className="w-6 h-6 flex items-center justify-center bg-black/10 hover:bg-black/20 rounded-full">&times;</button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={requestTdDeck} disabled={localPlayers.length < 2} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl text-lg">Next Step</button>
          </div>
        )}

        {view === 'td_inject' && (
          <div className="w-full flex flex-col h-full animate-fade-in-up py-4 px-2 text-center">
             <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Secret Additions</h2>
             <p className="text-slate-500 text-sm mb-8">Pass the phone around. Each player can secretly add exactly one Truth or Dare to the deck.</p>
             
             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
               <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                  <button onClick={() => setCustomType('truth')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${customType === 'truth' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Truth</button>
                  <button onClick={() => setCustomType('dare')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${customType === 'dare' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Dare</button>
               </div>
               
               {injectedCount < localPlayers.length ? (
                   <form onSubmit={injectPrompt}>
                     <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows="3" placeholder="Type your custom prompt here..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:border-slate-400 font-medium text-slate-900 mb-4 resize-none" />
                     <button type="submit" disabled={!customPrompt.trim()} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl shadow-sm">Add to Deck</button>
                   </form>
               ) : (
                   <div className="py-6 bg-emerald-50 border border-emerald-100 rounded-xl mb-4">
                       <p className="text-emerald-700 font-extrabold text-lg">Locked & Loaded!</p>
                       <p className="text-emerald-600 text-sm font-medium mt-1">All {localPlayers.length} players have added a prompt.</p>
                   </div>
               )}
               <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-6">{injectedCount} / {localPlayers.length} Prompts Added</p>
             </div>

             <button 
               onClick={() => { playTone(600, 'sine', 0.2); setView('td_game') }} 
               disabled={injectedCount < localPlayers.length}
               className="w-full disabled:bg-slate-300 disabled:text-slate-500 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all text-lg"
             >
              {injectedCount < localPlayers.length ? 'Waiting for prompts...' : 'Start Game'}
             </button>
          </div>
        )}

        {view === 'td_game' && (
           <div className="w-full flex flex-col items-center justify-center relative h-full animate-fade-in-up">
            <div className={`relative w-[340px] h-[340px] rounded-full flex items-center justify-center transition-all duration-700 ${tdState === 'result' ? 'scale-95 opacity-50 blur-[1px]' : 'scale-100'}`}>
              <div className="absolute inset-0 bg-white rounded-full shadow-md border border-slate-100"></div>
              
              <div 
                className="absolute z-30 origin-center" 
                style={{ 
                  width: '64px', height: '176px', 
                  transform: `rotate(${bottleRotation}deg)`, 
                  transition: 'transform 5s cubic-bezier(0.1, 0.9, 0.2, 1)' 
                }}
              >
                <svg viewBox="0 0 100 250" fill="none" className="w-full h-full drop-shadow-xl">
                  <path d="M30 100 Q30 80 42 60 L45 30 L45 10 L55 10 L55 30 L58 60 Q70 80 70 100 L70 230 Q70 240 60 240 L40 240 Q30 240 30 230 Z" fill="rgba(255,255,255,0.8)" stroke="#E2E8F0" strokeWidth="3" className="backdrop-blur-md"/>
                  <rect x="42" y="20" width="16" height="8" rx="2" fill="#F1F5F9"/>
                  <path d="M38 110 L38 220" stroke="white" strokeOpacity="0.9" strokeWidth="5" strokeLinecap="round"/>
                </svg>
              </div>

              {localPlayers.map((player, i) => {
                const angle = (i / localPlayers.length) * 360
                const radius = 175 
                const x = Math.cos((angle - 90) * (Math.PI / 180)) * radius
                const y = Math.sin((angle - 90) * (Math.PI / 180)) * radius
                
                return (
                  <div key={player.id} className={`absolute flex flex-col items-center justify-center z-40 transition-opacity ${player.eliminated ? 'opacity-20 grayscale' : 'opacity-100'}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
                    <div className={`${isCrowded ? 'w-10 h-10 text-md border-2' : 'w-14 h-14 text-2xl border-4'} rounded-full flex items-center justify-center font-bold shadow-md border-white text-slate-900`} style={{ backgroundColor: player.color }}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`${isCrowded ? 'text-[9px] px-1' : 'text-xs px-2'} font-semibold mt-1 py-1 rounded-lg bg-white/90 backdrop-blur shadow-sm border border-slate-100 text-slate-700 whitespace-nowrap`}>
                      {player.name}
                    </span>
                    {player.eliminated && <div className="absolute top-0 right-0 bg-red-500 w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-black">X</div>}
                  </div>
                )
              })}
            </div>
            
            <div className="absolute bottom-6 w-full flex flex-col items-center px-4 z-50">
              {tdState === 'idle' && ( <button onClick={spinBottle} className="w-full max-w-[200px] bg-slate-900 text-white font-bold py-5 rounded-full shadow-lg text-xl tracking-widest">SPIN</button> )}
              
              {tdState === 'result' && (
                <div className="w-full bg-white/95 backdrop-blur-xl border border-slate-100 p-6 rounded-[2rem] shadow-2xl text-center relative overflow-hidden">
                  <h3 className="text-3xl font-extrabold text-slate-900 mb-2">{tdTurnResult.victim.name}</h3>
                  <div className="inline-block px-4 py-1 rounded-xl text-md font-bold tracking-widest mb-4 shadow-sm" style={{ backgroundColor: tdTurnResult.victim.color }}>{tdTurnResult.type}</div>
                  <p className="text-xl font-medium leading-relaxed mb-6 text-slate-700">"{tdTurnResult.text}"</p>
                  
                  {tdTimeLeft === null ? (
                     <button onClick={() => { playTone(600, 'sine', 0.1); setTdTimeLeft(30) }} className="text-slate-400 font-bold text-sm mb-6 underline hover:text-slate-600">Start 30s Timer</button>
                  ) : (
                     <div className={`text-4xl font-black mb-6 ${tdTimeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>00:{tdTimeLeft < 10 ? `0${tdTimeLeft}` : tdTimeLeft}</div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleChickenOut} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-4 rounded-xl font-semibold text-sm">Chicken Out ({tdTurnResult.victim.strikes}/3)</button>
                    <button onClick={() => { setTdState('idle'); setTdTimeLeft(null); playTone(400, 'sine', 0.05) }} className="flex-1 bg-slate-900 py-4 rounded-xl font-semibold text-white text-md">Complete</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/*             CHARADES VIEWS                */}
        {/* ========================================= */}
        
        {view === 'ch_setup' && (
           <div className="w-full flex flex-col h-full animate-fade-in-up py-4">
            <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-6">Setup Game</h2>
            
            <div className="mb-5">
              <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-2">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'charades_movies', label: 'Movies' },
                  { id: 'charades_celebrities', label: 'Celebrities' },
                  { id: 'charades_sportsmen', label: 'Sportsmen' },
                  { id: 'charades_politicians', label: 'Politicians' }
                ].map(cat => (
                  <button key={cat.id} onClick={() => { setChMode(cat.id); playTone(500, 'sine', 0.05) }} className={`py-3 px-2 rounded-xl text-sm font-bold transition-all border ${chMode === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setChFormat('freeplay'); setLocalPlayers([]); playTone(500, 'sine', 0.05) }} className={`p-3 rounded-xl transition-all border text-left flex flex-col justify-center ${chFormat === 'freeplay' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <span className="font-bold text-sm">Free Play</span>
                  <span className={`text-[10px] mt-1 ${chFormat === 'freeplay' ? 'text-slate-300' : 'text-slate-400'}`}>Solo guessing, pass around.</span>
                </button>
                <button onClick={() => { setChFormat('team'); setLocalPlayers([]); playTone(500, 'sine', 0.05) }} className={`p-3 rounded-xl transition-all border text-left flex flex-col justify-center ${chFormat === 'team' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <span className="font-bold text-sm">Team Up</span>
                  <span className={`text-[10px] mt-1 ${chFormat === 'team' ? 'text-slate-300' : 'text-slate-400'}`}>Play in pairs.</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex-1">
                 <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-2">Rounds</label>
                 <div className="flex gap-2">
                   {[1, 2, 3].map(r => (
                      <button key={r} onClick={() => { setChTotalRounds(r); playTone(500, 'sine', 0.05) }} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${chTotalRounds === r ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {r}
                      </button>
                   ))}
                 </div>
              </div>
              <div className="flex-1">
                 <label className="block text-slate-400 uppercase tracking-widest text-[10px] font-black mb-2">Time</label>
                 <div className="flex gap-2">
                   {[60, 90, 120].map(t => (
                      <button key={t} onClick={() => { setChTimeLimit(t); playTone(500, 'sine', 0.05) }} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all border ${chTimeLimit === t ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {t}s
                      </button>
                   ))}
                 </div>
              </div>
            </div>

            {chFormat === 'freeplay' ? (
              <form onSubmit={addChPlayerFreeplay} className="flex flex-col gap-2 mb-4">
                <div className="flex gap-2">
                  <input type="text" maxLength="12" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player name..." className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none font-medium shadow-sm" />
                  <button type="submit" disabled={!newPlayerName.trim()} className="bg-slate-900 disabled:bg-slate-300 text-white font-semibold px-5 rounded-xl shadow-sm">Add</button>
                </div>
                {errorMessage && <p className="text-red-500 font-medium text-sm text-center">{errorMessage}</p>}
              </form>
            ) : (
              <form onSubmit={addChTeam} className="flex flex-col gap-2 mb-4 bg-white p-3 border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex gap-2">
                  <input type="text" maxLength="10" value={teamP1} onChange={(e) => setTeamP1(e.target.value)} placeholder="Teammate 1..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none font-medium text-center" />
                  <span className="font-black text-slate-400 flex items-center">&</span>
                  <input type="text" maxLength="10" value={teamP2} onChange={(e) => setTeamP2(e.target.value)} placeholder="Teammate 2..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none font-medium text-center" />
                </div>
                <button type="submit" disabled={!teamP1.trim() || !teamP2.trim()} className="bg-slate-900 disabled:bg-slate-300 text-white font-bold py-2 rounded-xl text-sm shadow-sm">Create Team</button>
                {errorMessage && <p className="text-red-500 font-medium text-sm text-center">{errorMessage}</p>}
              </form>
            )}

            <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm overflow-y-auto mb-4 min-h-[100px]">
              <div className="flex flex-wrap gap-2">
                {localPlayers.map(player => (
                  <div key={player.id} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full shadow-sm border border-slate-200" style={{ backgroundColor: player.color }}>
                    <span className="font-bold text-sm text-slate-900">{player.name}</span>
                    <button onClick={() => removeLocalPlayer(player.id)} className="w-6 h-6 flex items-center justify-center bg-black/10 rounded-full">&times;</button>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={requestChDeck} disabled={localPlayers.length < 2} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl text-lg shadow-sm">Start Game</button>
          </div>
        )}

        {view === 'ch_game' && (
          <div className="w-full flex flex-col items-center justify-center h-full">
            {chGameState === 'pre_turn' && (
               <div className="text-center animate-fade-in-up w-full">
                 <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 mb-8">
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Round {chCurrentRound} of {chTotalRounds}</p>
                   <h2 className="text-4xl font-black text-slate-900 mb-2">{localPlayers[chCurrentPlayerIdx].name}</h2>
                   {localPlayers[chCurrentPlayerIdx].isTeam && (
                     <p className="text-slate-500 font-medium text-sm mt-2 bg-slate-50 py-2 rounded-lg border border-slate-100">
                       <span className="font-bold text-slate-800">{localPlayers[chCurrentPlayerIdx].p1}</span> guesses, <span className="font-bold text-slate-800">{localPlayers[chCurrentPlayerIdx].p2}</span> acts.
                     </p>
                   )}
                 </div>
                 
                 <div className="mb-12">
                   <div className="w-32 h-16 border-4 border-slate-800 rounded-xl mx-auto flex items-center justify-center mb-4 relative">
                      <div className="w-2 h-2 bg-slate-800 rounded-full absolute left-2"></div>
                   </div>
                   <p className="text-slate-500 font-bold">Hold phone on forehead.<br/>Landscape mode.</p>
                 </div>
                 <button onClick={startCharadesTurn} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl text-xl tracking-wider active:scale-95 transition-all">I'M READY</button>
               </div>
            )}

            {chGameState === 'active' && (
               <div 
                 className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-colors duration-200 ${chBgColor}`}
                 onTouchStart={handleTouchStart}
                 onTouchEnd={handleTouchEnd}
               >
                 <div className="absolute top-6 font-mono text-5xl font-black text-white/90 tracking-widest drop-shadow-md">
                   {Math.floor(chTimeLeft / 60)}:{(chTimeLeft % 60).toString().padStart(2, '0')}
                 </div>
                 <div className="text-center px-6">
                   <h1 className="text-7xl font-black text-white drop-shadow-lg leading-tight uppercase tracking-tighter" style={{ transform: 'rotate(90deg)' }}>
                     {chCurrentWord}
                   </h1>
                 </div>
                 <div className="absolute left-8 top-1/2 -translate-y-1/2 text-white/30 font-bold rotate-90 tracking-widest uppercase">Swipe Down <br/> Correct</div>
                 <div className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 font-bold -rotate-90 tracking-widest uppercase">Swipe Up <br/> Skip</div>
               </div>
            )}

            {chGameState === 'post_turn' && (
               <div className="w-full text-center animate-fade-in-up">
                 <h2 className="text-3xl font-black text-slate-900 mb-2">Time's Up!</h2>
                 <p className="text-slate-500 font-bold mb-8">{localPlayers[chCurrentPlayerIdx].name} scored <span className="text-emerald-500 text-2xl ml-1">+{chRoundScore}</span></p>

                 <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 mb-8">
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-3">Live Standings</p>
                   <div className="space-y-2">
                     {[...localPlayers].sort((a,b) => b.score - a.score).map((p, idx) => (
                       <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                         <div className="flex items-center gap-3">
                           <span className="font-black text-slate-300 w-4">{idx + 1}</span>
                           <span className="font-bold text-slate-800">{p.name}</span>
                         </div>
                         <span className="font-black text-slate-900">{p.score} pts</span>
                       </div>
                     ))}
                   </div>
                 </div>
                 <button onClick={nextCharadesPlayer} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-md text-lg active:scale-95 transition-all">Next Turn</button>
               </div>
            )}

            {chGameState === 'podium' && (
               <div className="w-full text-center animate-fade-in-up">
                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Game Over</p>
                 <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-10">Results</h2>

                 <div className="flex items-end justify-center gap-2 mb-12 h-40">
                   {localPlayers[1] && (
                     <div className="flex flex-col items-center w-1/3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                       <div className="text-sm font-bold text-slate-700 truncate w-full mb-2">{localPlayers[1].name}</div>
                       <div className="w-full bg-slate-200 h-24 rounded-t-xl flex items-center justify-center border border-slate-300">
                         <span className="font-black text-slate-500 text-2xl">2</span>
                       </div>
                     </div>
                   )}
                   {localPlayers[0] && (
                     <div className="flex flex-col items-center w-1/3 animate-fade-in-up z-10" style={{ animationDelay: '0.4s' }}>
                       <div className="text-lg font-black text-amber-500 truncate w-full mb-2">{localPlayers[0].name}</div>
                       <div className="w-full bg-amber-400 h-32 rounded-t-xl flex flex-col items-center justify-start pt-2 border border-amber-500 shadow-xl">
                         <span className="font-black text-amber-100 text-4xl">1</span>
                         <span className="font-bold text-amber-800 text-xs mt-1">{localPlayers[0].score} pts</span>
                       </div>
                     </div>
                   )}
                   {localPlayers[2] && (
                     <div className="flex flex-col items-center w-1/3 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                       <div className="text-xs font-bold text-slate-600 truncate w-full mb-2">{localPlayers[2].name}</div>
                       <div className="w-full bg-amber-700/80 h-20 rounded-t-xl flex items-center justify-center border border-amber-900/20">
                         <span className="font-black text-amber-900/50 text-xl">3</span>
                       </div>
                     </div>
                   )}
                 </div>
                 <button onClick={quitGame} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-md text-lg active:scale-95 transition-all">Play Again</button>
               </div>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/*          IMPOSTER MULTIPLAYER VIEWS       */}
        {/* ========================================= */}
        
        {view === 'imp_join' && (
           <div className="text-center w-full space-y-6 animate-fade-in-up px-4">
             <div className="inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4">The Imposter</div>
             <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Join the Game</h2>
             <p className="text-slate-500 text-sm mb-8">Everyone will play on their own device. What should we call you?</p>
             <form onSubmit={joinImposter}>
               <input type="text" maxLength="12" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="w-full text-center text-3xl font-bold bg-white border border-slate-200 rounded-2xl py-6 focus:outline-none focus:border-slate-400 text-slate-800 shadow-sm mb-2" placeholder="Your Name" autoFocus />
               {errorMessage && <p className="text-red-500 font-medium text-sm mb-4">{errorMessage}</p>}
               <button type="submit" disabled={!newPlayerName.trim()} className="w-full bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-4 rounded-2xl shadow-sm mt-4">Join Lobby</button>
             </form>
           </div>
        )}

        {view === 'imp_ordering' && isHost && (
           <div className="w-full flex flex-col h-full animate-fade-in-up py-4">
             <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Sitting Plan</h2>
                <p className="text-slate-500 text-sm">Tap the players in order (e.g. clockwise around the room) so the game knows whose turn it is.</p>
             </div>
             
             <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-2 overflow-y-auto mb-6 shadow-sm">
                {Object.values(impPlayers).map(p => (
                  <button 
                     key={p.id} 
                     onClick={() => handleImpOrderTap(p.id)}
                     className={`w-full text-left px-4 py-4 rounded-2xl mb-2 font-bold transition-all flex justify-between items-center ${impTurnOrder.includes(p.id) ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}
                  >
                     <span>{p.name}</span>
                     {impTurnOrder.includes(p.id) && <span className="bg-white text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs">{impTurnOrder.indexOf(p.id) + 1}</span>}
                  </button>
                ))}
             </div>
             
             <div className="flex gap-2">
                <button onClick={() => {setImpTurnOrder([]); setView('imp_main')}} className="flex-1 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl">Cancel</button>
                <button onClick={submitImpOrder} disabled={impTurnOrder.length !== Object.keys(impPlayers).length} className="flex-[2] bg-slate-900 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl shadow-sm">Lock Order</button>
             </div>
           </div>
        )}

        {view === 'imp_main' && (
           <div className="w-full flex flex-col h-full animate-fade-in-up py-2">
              {impPhase === 'lobby' && (
                 <div className="text-center flex flex-col h-full">
                    <div className="mb-8">
                       <p className="text-slate-400 uppercase tracking-widest text-xs font-semibold mb-2">Room Code</p>
                       <div className="text-5xl font-mono font-black text-slate-900">{roomCode}</div>
                    </div>
                    
                    <div className="flex-1 bg-white rounded-3xl border border-slate-100 p-5 shadow-sm text-left">
                       <p className="text-slate-400 text-xs tracking-widest font-black uppercase mb-4">Players ({Object.keys(impPlayers).length})</p>
                       <div className="flex flex-wrap gap-2">
                          {Object.values(impPlayers).map((p) => (
                             <div key={p.id} className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-bold text-slate-800 shadow-sm border border-slate-200">
                                {p.name} {p.id === clientId.current && "(You)"}
                             </div>
                          ))}
                       </div>
                    </div>
                    
                    {isHost ? (
                       <button onClick={startImposterOrdering} disabled={Object.keys(impPlayers).length < 3} className="w-full mt-6 bg-slate-900 disabled:bg-slate-300 text-white font-bold py-5 rounded-2xl shadow-lg active:scale-[0.98]">Set Turn Order & Start</button>
                    ) : (
                       <div className="w-full mt-6 bg-slate-200 text-slate-500 font-bold py-5 rounded-2xl">Waiting for Host...</div>
                    )}
                 </div>
              )}

              {impPhase === 'rules' && (
                 <div className="text-center flex flex-col h-full justify-center">
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-8 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
                       <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-2">Your Secret Word</p>
                       <h2 className="text-4xl font-black text-slate-900 mb-6">{impMyWord}</h2>
                       <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left">
                          <ul className="text-sm text-slate-600 font-medium space-y-2">
                             <li>🎯 <strong>Goal:</strong> Describe your word with 1 hint.</li>
                             <li>🕵️‍♂️ <strong>Imposters:</strong> Blend in. You have a slightly different word.</li>
                             <li>🗳️ <strong>Voting:</strong> After everyone hints, vote out the liar.</li>
                          </ul>
                       </div>
                    </div>
                    
                    {impPlayers[clientId.current]?.ready ? (
                       <div className="w-full bg-slate-200 text-slate-500 font-bold py-5 rounded-2xl">Waiting for others...</div>
                    ) : (
                       <button onClick={sendImpReady} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-[0.98]">Got It!</button>
                    )}
                 </div>
              )}

              {impPhase === 'playing' && (
                 <div className="flex flex-col h-full">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm mb-6 text-center">
                       <p className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-1">Your Word</p>
                       <h3 className="text-2xl font-black text-slate-900">{impMyWord}</h3>
                    </div>
                    
                    <div className="flex-1">
                       <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-4 text-center">Sitting Order</p>
                       <div className="space-y-2">
                          {impTurnOrder.map((pid, idx) => {
                             const p = impPlayers[pid];
                             if (!p || !p.is_alive) return null;
                             const isCurrent = idx === impCurrentTurn;
                             const hasGone = idx < impCurrentTurn;
                             return (
                                <div key={pid} className={`flex items-center px-4 py-3 rounded-2xl transition-all ${isCurrent ? 'bg-slate-900 text-white shadow-md scale-105' : hasGone ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-800 border border-slate-200'}`}>
                                   <div className="flex-1 font-bold">{p.name} {p.id === clientId.current && "(You)"}</div>
                                   {isCurrent && <div className="text-xs font-black uppercase tracking-widest animate-pulse">Speaking...</div>}
                                   {hasGone && <div className="text-xs font-bold text-emerald-600">✓ Done</div>}
                                </div>
                             )
                          })}
                       </div>
                    </div>

                    <div className="mt-6">
                       {!impIsAlive ? (
                          <div className="w-full bg-red-100 text-red-600 font-bold py-5 rounded-2xl text-center border border-red-200">You are dead. Spectating.</div>
                       ) : impTurnOrder[impCurrentTurn] === clientId.current ? (
                          <button onClick={submitHint} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 transition-all text-lg">Hint Given</button>
                       ) : (
                          <div className="w-full bg-slate-200 text-slate-500 font-bold py-5 rounded-2xl text-center">Listen carefully...</div>
                       )}
                    </div>
                 </div>
              )}

              {impPhase === 'voting' && (
                 <div className="flex flex-col h-full">
                    <div className="text-center mb-6">
                       <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Vote!</h2>
                       <p className="text-slate-500 text-sm">Who is the imposter?</p>
                    </div>
                    
                    {!impIsAlive ? (
                       <div className="flex-1 flex items-center justify-center text-slate-400 font-bold">Dead players cannot vote.</div>
                    ) : (
                       <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                          {Object.values(impPlayers).filter(p => p.is_alive && p.id !== clientId.current).map(p => (
                             <button key={p.id} onClick={() => submitVote(p.id)} className="bg-white border border-slate-200 text-slate-900 font-bold py-6 rounded-2xl shadow-sm hover:border-slate-400 active:scale-95 transition-all">
                                {p.name}
                             </button>
                          ))}
                          <button onClick={() => submitVote('skip')} className="col-span-2 mt-4 bg-slate-200 text-slate-700 font-black py-5 rounded-2xl shadow-sm hover:bg-slate-300 active:scale-95 transition-all">
                             Skip Vote
                          </button>
                       </div>
                    )}
                 </div>
              )}

              {impPhase === 'resolution' && impResolution && (
                 <div className="flex flex-col h-full justify-center text-center animate-fade-in-up">
                    {impResolution.winner ? (
                       <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 mb-8">
                          <h2 className={`text-5xl font-black mb-4 ${impResolution.winner === 'imposters' ? 'text-red-500' : 'text-emerald-500'}`}>
                             {impResolution.winner === 'imposters' ? 'Imposters Win!' : 'Innocents Win!'}
                          </h2>
                          <p className="text-slate-600 font-bold text-lg">
                             The Imposters were: <br/>
                             <span className="text-slate-900 font-black text-xl">
                                {Object.values(impPlayers).filter(p => p.role === 'imposter').map(p => p.name).join(", ")}
                             </span>
                          </p>
                       </div>
                    ) : (
                       <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-8">
                          {impResolution.eliminated_id ? (
                             <>
                                <h3 className="text-3xl font-black text-slate-900 mb-4">{impPlayers[impResolution.eliminated_id]?.name} was eliminated.</h3>
                                <p className={`text-xl font-bold px-4 py-2 rounded-xl inline-block ${impResolution.eliminated_role === 'imposter' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                   They were an {impResolution.eliminated_role}.
                                </p>
                             </>
                          ) : (
                             <h3 className="text-3xl font-black text-slate-900 mb-4">No one was eliminated.<br/><span className="text-lg text-slate-500">(Tie or Skip)</span></h3>
                          )}
                       </div>
                    )}
                    
                    {isHost && (
                       impResolution.winner ? (
                          <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'imp_play_again' }))} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95">Play Again</button>
                       ) : (
                          <button onClick={() => socketRef.current?.send(JSON.stringify({ action: 'imp_next_round' }))} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95">Next Round</button>
                       )
                    )}
                    {!isHost && <div className="text-slate-400 font-bold mt-4">Waiting for host...</div>}
                 </div>
              )}
           </div>
        )}

      </div>
    </div>
  )
}

export default App
